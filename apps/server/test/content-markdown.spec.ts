import { describe, expect, it } from 'vitest';
import { deriveMarkdown } from '../src/modules/content/content-markdown';
import { deriveRichText } from '../src/modules/content/content-rich-text';

describe('deriveMarkdown', () => {
  it('抽出 h2/h3 目录并转义 HTML', () => {
    const result = deriveMarkdown('# 标题\n\n## 第二节\n\n<script>x</script>\n\n正文 **粗**');
    expect(result.toc.some((item) => item.text === '第二节' && item.level === 2)).toBe(true);
    expect(result.html).toContain('<h1');
    expect(result.html).not.toContain('<script>');
    expect(result.html).toContain('&lt;script&gt;');
    expect(result.wordCount).toBeGreaterThan(0);
  });
});

describe('deriveRichText', () => {
  it('净化可公开渲染 HTML，并从正文派生搜索文本和字数', () => {
    const result = deriveRichText({
      html: '<h2>富文本标题</h2><p>正文 <strong>内容</strong></p><script>alert(1)</script>',
    });

    expect(result.html).toContain('<h2>富文本标题</h2>');
    expect(result.html).not.toContain('<script>');
    expect(result.plainText).toContain('富文本标题');
    expect(result.plainText).toContain('正文 内容');
    expect(result.wordCount).toBeGreaterThan(0);
  });
});
