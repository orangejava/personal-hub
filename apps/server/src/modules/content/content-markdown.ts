export interface TocItem {
  level: number;
  text: string;
  anchor: string;
}

/**
 * 从 Markdown 派生 TOC、净化后的简易 HTML 和字数。
 * 不引入 ESM 的 marked，避免 Nest CJS 构建踩坑；HTML 先转义再套白名单标签。
 */
export function deriveMarkdown(source: string): {
  html: string;
  toc: TocItem[];
  wordCount: number;
} {
  const wordCount = source.replace(/\s+/g, '').length;
  const toc: TocItem[] = [];
  const anchors = new Map<string, number>();
  const blocks = source.replace(/\r\n/g, '\n').split('\n');
  const htmlParts: string[] = [];
  let inCode = false;
  let codeLang = '';
  let codeLines: string[] = [];
  let paragraph: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length === 0) {
      return;
    }
    htmlParts.push(`<p>${inline(paragraph.join(' '))}</p>`);
    paragraph = [];
  };

  const slug = (text: string): string => {
    const base =
      text
        .trim()
        .toLowerCase()
        .replace(/[^\p{Letter}\p{Number}\u4e00-\u9fff]+/gu, '-')
        .replace(/^-|-$/g, '') || 'section';
    const seen = anchors.get(base) ?? 0;
    anchors.set(base, seen + 1);
    return seen === 0 ? base : `${base}-${seen + 1}`;
  };

  for (const line of blocks) {
    if (line.startsWith('```')) {
      flushParagraph();
      if (inCode) {
        htmlParts.push(
          `<pre><code${codeLang ? ` class="language-${escapeAttr(codeLang)}"` : ''}>${escapeHtml(codeLines.join('\n'))}</code></pre>`,
        );
        inCode = false;
        codeLines = [];
        codeLang = '';
      } else {
        inCode = true;
        codeLang = line.slice(3).trim();
      }
      continue;
    }
    if (inCode) {
      codeLines.push(line);
      continue;
    }

    const heading = /^(#{1,6})\s+(.+)$/.exec(line);
    if (heading) {
      flushParagraph();
      const level = heading[1].length;
      const text = heading[2].trim();
      const anchor = slug(text);
      if (level >= 2 && level <= 4) {
        toc.push({ level, text, anchor });
      }
      htmlParts.push(`<h${level} id="${escapeAttr(anchor)}">${inline(text)}</h${level}>`);
      continue;
    }

    if (line.trim() === '') {
      flushParagraph();
      continue;
    }

    const unordered = /^[-*]\s+(.+)$/.exec(line);
    if (unordered) {
      flushParagraph();
      htmlParts.push(`<ul><li>${inline(unordered[1])}</li></ul>`);
      continue;
    }

    paragraph.push(line);
  }

  if (inCode) {
    htmlParts.push(`<pre><code>${escapeHtml(codeLines.join('\n'))}</code></pre>`);
  }
  flushParagraph();

  return { html: htmlParts.join('\n'), toc, wordCount };
}

function inline(text: string): string {
  const escaped = escapeHtml(text);
  return escaped
    .replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2" rel="noopener noreferrer">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>');
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeAttr(value: string): string {
  return escapeHtml(value);
}
