import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import { DomainHttpException } from '../src/common/errors/domain-http.exception';
import { parseBookletZip } from '../src/modules/booklet/parse-booklet-zip';

async function zipOf(files: Record<string, string | Uint8Array>): Promise<Buffer> {
  const zip = new JSZip();
  for (const [name, content] of Object.entries(files)) {
    zip.file(name, content);
  }
  return zip.generateAsync({ type: 'nodebuffer' });
}

describe('parseBookletZip', () => {
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
