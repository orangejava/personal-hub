export const STORAGE_PROVIDER = Symbol('STORAGE_PROVIDER');

export interface SignedUploadSession {
  mode: 'SINGLE' | 'MULTIPART';
  uploadUrl?: string;
  multipartUploadId?: string;
  parts?: Array<{ partNumber: number; url: string }>;
  partSize?: number;
}

export interface CompletedPart {
  partNumber: number;
  etag: string;
}

export interface ObjectHead {
  size: number;
  contentType?: string;
}

/**
 * 业务只依赖这组能力。本地 MinIO 与生产 COS 共用 AWS SDK S3 协议。
 */
export interface StorageProvider {
  /** 只验证 Bucket 是否可访问，不读写业务对象。 */
  checkConnection(): Promise<void>;
  putObject(key: string, body: Buffer, contentType: string): Promise<void>;
  getObject(key: string): Promise<Buffer>;
  /**
   * 只读取校验所需的起始字节，避免完整下载大文件。
   */
  getObjectPrefix(key: string, maxBytes: number): Promise<Buffer>;
  /**
   * 返回对象的可迭代字节流，调用方负责消费以控制内存占用。
   */
  getObjectStream(key: string): Promise<AsyncIterable<Uint8Array>>;
  headObject(key: string): Promise<ObjectHead>;
  deleteObject(key: string): Promise<void>;
  createSignedDownloadUrl(key: string, expiresInSeconds: number): Promise<string>;
  createSignedUpload(
    key: string,
    size: number,
    contentType: string,
    expiresInSeconds: number,
  ): Promise<SignedUploadSession>;
  completeMultipartUpload(key: string, uploadId: string, parts: CompletedPart[]): Promise<void>;
  abortMultipartUpload(key: string, uploadId: string): Promise<void>;
  /**
   * 保留源对象的复制操作。导入事务确认前不得破坏可重试的源 ZIP。
   */
  copyObject(fromKey: string, toKey: string): Promise<void>;
  moveObject(fromKey: string, toKey: string): Promise<void>;
}
