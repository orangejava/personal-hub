/**
 * 用文件头魔数核对 MIME，不信任客户端 Content-Type。
 */

export function sniffMimeType(buffer: Uint8Array, declared: string): string | null {
  if (buffer.length < 4) {
    return null;
  }
  const declaredMime = declared.toLowerCase();
  if (isJpeg(buffer) && declaredMime === 'image/jpeg') {
    return 'image/jpeg';
  }
  if (isPng(buffer) && declaredMime === 'image/png') {
    return 'image/png';
  }
  if (isWebp(buffer) && declaredMime === 'image/webp') {
    return 'image/webp';
  }
  if (isPdf(buffer) && declaredMime === 'application/pdf') {
    return 'application/pdf';
  }
  if (isZip(buffer) && isZipFamily(declaredMime)) {
    return declaredMime;
  }
  if (isMp4(buffer) && declaredMime === 'video/mp4') {
    return 'video/mp4';
  }
  return null;
}

function isZipFamily(mime: string): boolean {
  return (
    mime === 'application/zip' ||
    mime === 'application/x-zip-compressed' ||
    mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  );
}

function isJpeg(buffer: Uint8Array): boolean {
  return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
}

function isPng(buffer: Uint8Array): boolean {
  return buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47;
}

function isWebp(buffer: Uint8Array): boolean {
  if (buffer.length < 12) {
    return false;
  }
  const riff = String.fromCharCode(buffer[0], buffer[1], buffer[2], buffer[3]);
  const webp = String.fromCharCode(buffer[8], buffer[9], buffer[10], buffer[11]);
  return riff === 'RIFF' && webp === 'WEBP';
}

function isPdf(buffer: Uint8Array): boolean {
  return String.fromCharCode(buffer[0], buffer[1], buffer[2], buffer[3]) === '%PDF';
}

function isZip(buffer: Uint8Array): boolean {
  return buffer[0] === 0x50 && buffer[1] === 0x4b && (buffer[2] === 0x03 || buffer[2] === 0x05 || buffer[2] === 0x07);
}

function isMp4(buffer: Uint8Array): boolean {
  if (buffer.length < 12) {
    return false;
  }
  const brand = String.fromCharCode(buffer[8], buffer[9], buffer[10], buffer[11]);
  return brand === 'ftyp';
}

/** 清理上传文件名，去掉路径与控制字符。 */
export function sanitizeFileName(original: string): string {
  const base = original.replaceAll('\\', '/').split('/').pop() ?? 'file';
  const cleaned = base.replace(/[^\w.\u4e00-\u9fff-]+/g, '_').slice(0, 180);
  return cleaned.length > 0 ? cleaned : 'file';
}
