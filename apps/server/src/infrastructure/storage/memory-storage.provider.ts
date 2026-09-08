import { Injectable } from '@nestjs/common';
import type {
  CompletedPart,
  ObjectHead,
  SignedUploadSession,
  StorageProvider,
} from './storage.types';

/**
 * 测试用内存对象存储，避免 HTTP 用例依赖 MinIO。
 * 生产与本地开发走 S3StorageProvider。
 */
@Injectable()
export class MemoryStorageProvider implements StorageProvider {
  private readonly objects = new Map<string, { body: Buffer; contentType: string }>();
  private readonly multipart = new Map<string, Map<number, Buffer>>();

  async putObject(key: string, body: Buffer, contentType: string): Promise<void> {
    this.objects.set(key, { body, contentType });
  }

  async getObject(key: string): Promise<Buffer> {
    const found = this.objects.get(key);
    if (!found) {
      throw new Error(`对象不存在: ${key}`);
    }
    return found.body;
  }

  async getObjectPrefix(key: string, maxBytes: number): Promise<Buffer> {
    const found = this.objects.get(key);
    if (!found) {
      throw new Error(`对象不存在: ${key}`);
    }
    return found.body.subarray(0, maxBytes);
  }

  async getObjectStream(key: string): Promise<AsyncIterable<Uint8Array>> {
    const found = this.objects.get(key);
    if (!found) {
      throw new Error(`对象不存在: ${key}`);
    }
    return (async function* streamObject() {
      // 分段产出以模拟真实对象存储，确保测试能发现错误的整文件读取。
      const chunkSize = 64 * 1024;
      for (let offset = 0; offset < found.body.length; offset += chunkSize) {
        yield found.body.subarray(offset, offset + chunkSize);
      }
    })();
  }

  async headObject(key: string): Promise<ObjectHead> {
    const found = this.objects.get(key);
    if (!found) {
      throw new Error(`对象不存在: ${key}`);
    }
    return { size: found.body.length, contentType: found.contentType };
  }

  async deleteObject(key: string): Promise<void> {
    this.objects.delete(key);
  }

  async createSignedDownloadUrl(key: string): Promise<string> {
    return `memory://download/${encodeURIComponent(key)}`;
  }

  async createSignedUpload(
    key: string,
    size: number,
    contentType: string,
  ): Promise<SignedUploadSession> {
    void contentType;
    if (size > 20 * 1024 * 1024) {
      const partSize = 8 * 1024 * 1024;
      const partCount = Math.ceil(size / partSize);
      this.multipart.set(key, new Map());
      return {
        mode: 'MULTIPART',
        multipartUploadId: `mem-${key}`,
        partSize,
        parts: Array.from({ length: partCount }, (_, index) => ({
          partNumber: index + 1,
          url: `memory://upload/${encodeURIComponent(key)}/${index + 1}`,
        })),
      };
    }
    return {
      mode: 'SINGLE',
      uploadUrl: `memory://upload/${encodeURIComponent(key)}`,
    };
  }

  async completeMultipartUpload(
    key: string,
    _uploadId: string,
    parts: CompletedPart[],
  ): Promise<void> {
    const staged = this.multipart.get(key) ?? new Map<number, Buffer>();
    const ordered = [...parts].sort((a, b) => a.partNumber - b.partNumber);
    const body = Buffer.concat(
      ordered.map((part) => staged.get(part.partNumber) ?? Buffer.alloc(0)),
    );
    this.objects.set(key, { body, contentType: 'application/octet-stream' });
    this.multipart.delete(key);
  }

  async abortMultipartUpload(key: string): Promise<void> {
    this.multipart.delete(key);
  }

  async copyObject(fromKey: string, toKey: string): Promise<void> {
    const found = this.objects.get(fromKey);
    if (!found) {
      throw new Error(`对象不存在: ${fromKey}`);
    }
    this.objects.set(toKey, found);
  }

  async moveObject(fromKey: string, toKey: string): Promise<void> {
    await this.copyObject(fromKey, toKey);
    this.objects.delete(fromKey);
  }

  /** 测试里模拟浏览器 PUT 分片：写入即将 complete 的 multipart 暂存。 */
  async simulateBrowserPart(key: string, partNumber: number, body: Buffer): Promise<void> {
    const staged = this.multipart.get(key) ?? new Map<number, Buffer>();
    staged.set(partNumber, body);
    this.multipart.set(key, staged);
  }

  /** 测试里模拟浏览器 PUT：把字节写入即将 complete 的 key。 */
  async simulateBrowserPut(key: string, body: Buffer, contentType: string): Promise<void> {
    await this.putObject(key, body, contentType);
  }
}
