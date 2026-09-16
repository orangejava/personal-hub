import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CopyObjectCommand,
  CreateMultipartUploadCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
  UploadPartCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env.schema';
import { shouldUseMultipart } from '../../modules/file/file-policy';
import type {
  CompletedPart,
  ObjectHead,
  SignedUploadSession,
  StorageProvider,
} from './storage.types';

const PART_SIZE = 8 * 1024 * 1024;

@Injectable()
export class S3StorageProvider implements StorageProvider {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(config: ConfigService<Env, true>) {
    const raw = config.getOrThrow('MINIO_ENDPOINT');
    const { endpoint, forcePathStyle, region, useSsl } = parseS3Endpoint(raw);
    this.bucket = config.getOrThrow('MINIO_BUCKET');
    this.client = new S3Client({
      region,
      endpoint,
      // 腾讯 COS 使用虚拟主机风格；本地 MinIO 继续使用 path style。
      forcePathStyle,
      tls: useSsl,
      credentials: {
        accessKeyId: config.getOrThrow('MINIO_ACCESS_KEY'),
        secretAccessKey: config.getOrThrow('MINIO_SECRET_KEY'),
      },
    });
  }

  async checkConnection(): Promise<void> {
    await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
  }

  async putObject(key: string, body: Buffer, contentType: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
  }

  async getObject(key: string): Promise<Buffer> {
    const result = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    const bytes = await result.Body?.transformToByteArray();
    if (!bytes) {
      throw new Error(`对象为空: ${key}`);
    }
    return Buffer.from(bytes);
  }

  async getObjectPrefix(key: string, maxBytes: number): Promise<Buffer> {
    const result = await this.client.send(
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Range: `bytes=0-${Math.max(0, maxBytes - 1)}`,
      }),
    );
    const bytes = await result.Body?.transformToByteArray();
    if (!bytes) {
      throw new Error(`对象为空: ${key}`);
    }
    return Buffer.from(bytes);
  }

  async getObjectStream(key: string): Promise<AsyncIterable<Uint8Array>> {
    const result = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    if (!result.Body || !(Symbol.asyncIterator in result.Body)) {
      throw new Error(`对象为空: ${key}`);
    }
    return result.Body as AsyncIterable<Uint8Array>;
  }

  async headObject(key: string): Promise<ObjectHead> {
    const result = await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
    return { size: result.ContentLength ?? 0, contentType: result.ContentType };
  }

  async deleteObject(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  async createSignedDownloadUrl(key: string, expiresInSeconds: number): Promise<string> {
    return getSignedUrl(this.client, new GetObjectCommand({ Bucket: this.bucket, Key: key }), {
      expiresIn: expiresInSeconds,
    });
  }

  async createSignedUpload(
    key: string,
    size: number,
    contentType: string,
    expiresInSeconds: number,
  ): Promise<SignedUploadSession> {
    if (shouldUseMultipart(size)) {
      const created = await this.client.send(
        new CreateMultipartUploadCommand({
          Bucket: this.bucket,
          Key: key,
          ContentType: contentType,
        }),
      );
      const uploadId = created.UploadId;
      if (!uploadId) {
        throw new Error('S3 未返回 multipart uploadId');
      }
      const partCount = Math.max(1, Math.ceil(size / PART_SIZE));
      const parts = await Promise.all(
        Array.from({ length: partCount }, async (_, index) => {
          const partNumber = index + 1;
          const url = await getSignedUrl(
            this.client,
            new UploadPartCommand({
              Bucket: this.bucket,
              Key: key,
              UploadId: uploadId,
              PartNumber: partNumber,
            }),
            { expiresIn: expiresInSeconds },
          );
          return { partNumber, url };
        }),
      );
      return { mode: 'MULTIPART', multipartUploadId: uploadId, partSize: PART_SIZE, parts };
    }

    const uploadUrl = await getSignedUrl(
      this.client,
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        ContentType: contentType,
      }),
      { expiresIn: expiresInSeconds },
    );
    return { mode: 'SINGLE', uploadUrl };
  }

  async completeMultipartUpload(
    key: string,
    uploadId: string,
    parts: CompletedPart[],
  ): Promise<void> {
    await this.client.send(
      new CompleteMultipartUploadCommand({
        Bucket: this.bucket,
        Key: key,
        UploadId: uploadId,
        MultipartUpload: {
          Parts: parts.map((part) => ({ ETag: part.etag, PartNumber: part.partNumber })),
        },
      }),
    );
  }

  async abortMultipartUpload(key: string, uploadId: string): Promise<void> {
    await this.client.send(
      new AbortMultipartUploadCommand({ Bucket: this.bucket, Key: key, UploadId: uploadId }),
    );
  }

  async copyObject(fromKey: string, toKey: string): Promise<void> {
    await this.client.send(
      new CopyObjectCommand({
        Bucket: this.bucket,
        Key: toKey,
        CopySource: encodeS3CopySource(this.bucket, fromKey),
      }),
    );
  }

  async moveObject(fromKey: string, toKey: string): Promise<void> {
    await this.copyObject(fromKey, toKey);
    await this.deleteObject(fromKey);
  }
}

export function parseS3Endpoint(raw: string): {
  endpoint: string;
  forcePathStyle: boolean;
  region: string;
  useSsl: boolean;
} {
  if (raw.startsWith('http://') || raw.startsWith('https://')) {
    const url = new URL(raw);
    const cosRegion = url.hostname.match(/^cos\.([^.]+)\.myqcloud\.com$/)?.[1];
    return {
      endpoint: `${url.protocol}//${url.host}`,
      forcePathStyle: !cosRegion,
      region: cosRegion ?? 'us-east-1',
      useSsl: url.protocol === 'https:',
    };
  }
  return { endpoint: `http://${raw}`, forcePathStyle: true, region: 'us-east-1', useSsl: false };
}

/**
 * CopySource 走 HTTP 头，中文/空格文件名必须按路径段编码，否则 Node 会抛 TypeError。
 */
export function encodeS3CopySource(bucket: string, key: string): string {
  return `${bucket}/${key.split('/').map(encodeURIComponent).join('/')}`;
}
