import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import { DomainHttpException } from '../src/common/errors/domain-http.exception';
import {
  decodeZipEntryName,
  decodeZipText,
  MAX_ZIP_ENTRIES,
  MAX_ZIP_METADATA_BYTES,
  MAX_TOTAL_MARKDOWN_BYTES,
  parseBookletZip,
} from '../src/modules/booklet/parse-booklet-zip';
import type { Entry } from 'yauzl';

async function zipOf(files: Record<string, string | Uint8Array>): Promise<Buffer> {
  const zip = new JSZip();
  for (const [name, content] of Object.entries(files)) {
    zip.file(name, content);
  }
  return zip.generateAsync({ type: 'nodebuffer' });
}

describe('parseBookletZip', () => {
  it('兼容未声明 UTF-8 的 GBK 文件名和正文', () => {
    const entry = {
      fileName: '╥╡╡╜.md',
      fileNameRaw: Buffer.from([0xd5, 0xc2, 0xbd, 0xda, 0x2e, 0x6d, 0x64]),
      generalPurposeBitFlag: 0,
      extraFields: [],
    } as unknown as Entry;
    expect(decodeZipEntryName(entry)).toBe('章节.md');
    expect(decodeZipText(Buffer.from([0xd6, 0xd0, 0xce, 0xc4]))).toBe('中文');
  });

  it('兼容未声明 UTF-8 标志的 UTF-8 中文文件名', () => {
    const entry = {
      fileName: '闄勫綍.md',
      fileNameRaw: Buffer.from('附录.md', 'utf8'),
      generalPurposeBitFlag: 0,
      extraFields: [],
    } as unknown as Entry;
    expect(decodeZipEntryName(entry)).toBe('附录.md');
  });

  it('拒绝路径穿越', async () => {
    const zip = await zipOf({ '../escape.md': '# 逃逸' });
    await expect(parseBookletZip(zip, 'demo')).rejects.toBeInstanceOf(DomainHttpException);
  });

  it('拒绝压缩比异常的 ZIP bomb', async () => {
    const zip = new JSZip();
    zip.file('huge.md', Buffer.alloc(2 * 1024 * 1024, 0x61));
    const buffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
    await expect(parseBookletZip(buffer, 'bomb')).rejects.toBeInstanceOf(DomainHttpException);
  });

  it('在读取第 1001 个章节前拒绝超出章节数上限的 ZIP', async () => {
    const files = Object.fromEntries(
      Array.from({ length: 1001 }, (_, index) => [`${String(index).padStart(4, '0')}.md`, '# x']),
    );
    const zip = await zipOf(files);

    await expect(parseBookletZip(zip, 'too-many')).rejects.toThrow('章节数量超过限制');
  });

  it('在缓存全部 ZIP 条目前拒绝超出总条目上限的 ZIP', async () => {
    const zip = new JSZip();
    for (let index = 0; index <= MAX_ZIP_ENTRIES; index += 1) {
      zip.file(`assets/${String(index).padStart(5, '0')}.bin`, 'x');
    }
    const buffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'STORE' });

    await expect(parseBookletZip(buffer, 'too-many-entries')).rejects.toThrow(
      'ZIP 条目数量超过限制',
    );
  });

  it('累计文件名元数据超限时在读取章节正文前拒绝', async () => {
    const zip = new JSZip();
    for (let index = 0; index < 145; index += 1) {
      zip.file(`${String(index).padStart(3, '0')}-${'x'.repeat(60_000)}.bin`, 'x');
    }
    const buffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'STORE' });

    expect(MAX_ZIP_METADATA_BYTES).toBe(8 * 1024 * 1024);
    await expect(parseBookletZip(buffer, 'long-names')).rejects.toThrow(
      'ZIP 文件名及元数据总量超过限制',
    );
  });

  it('限制 ZIP 中逐文件告警数量', async () => {
    const files = Object.fromEntries(
      Array.from({ length: 120 }, (_, index) => [`assets/${index}.txt`, 'ignored']),
    );
    const zip = await zipOf({ 'chapter.md': '# 正文', ...files });
    const parsed = await parseBookletZip(zip, 'warnings');

    expect(parsed.warnings).toHaveLength(101);
    expect(parsed.warnings.at(-1)).toBe('其余告警已省略');
  });

  it('拒绝超过固定 Markdown 正文总量上限的 ZIP', async () => {
    const files = {
      '01.md': 'a'.repeat(600),
      '02.md': 'b'.repeat(600),
    };
    const zip = await zipOf(files);

    await expect(parseBookletZip(zip, 'too-large', undefined, 1000)).rejects.toThrow(
      'Markdown 正文总量超过限制',
    );
    expect(MAX_TOTAL_MARKDOWN_BYTES).toBe(64 * 1024 * 1024);
  });

  it('解析合法章节与 meta.json', async () => {
    const zip = await zipOf({
      'booklet/meta.json': JSON.stringify({ title: '导入小册', summary: '摘要', tags: ['React'] }),
      'booklet/01-intro.md': '# 引言\n\n正文。',
      'booklet/notes.txt': 'ignore me',
    });
    const parsed = await parseBookletZip(zip, 'fallback');
    expect(parsed.title).toBe('导入小册');
    expect(parsed.chapters).toHaveLength(1);
    expect(parsed.chapters[0]?.title).toBe('引言');
    expect(parsed.warnings.some((item) => item.includes('notes.txt'))).toBe(true);
  });
});
