import React, { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import MarkdownCodeBlock from '@/components/shared/MarkdownCodeBlock';
import {
  normalizeImageUrl,
  resolveMarkdownImageSrc,
} from '@/utils/markdownImage';
import {
  flattenMarkdownText,
  slugifyHeading,
} from '@/utils/markdown';
import 'highlight.js/styles/github.min.css';

export { normalizeImageUrl, resolveMarkdownImageSrc } from '@/utils/markdownImage';

interface MarkdownViewerProps {
  source: string;
  prose?: boolean;
}

function normalizeMarkdownSource(source: string): string {
  return source.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_match, alt, rawUrl) => {
    return `![${alt}](${normalizeImageUrl(rawUrl)})`;
  });
}

type CodeProps = React.ComponentProps<'code'> & {
  inline?: boolean;
};

function MarkdownCode({ inline, className, children }: CodeProps) {
  const text = String(children).replace(/\n$/, '');
  const langMatch = /language-([\w-]+)/.exec(className || '');
  const isBlock = !inline && (langMatch || text.includes('\n'));

  if (isBlock) {
    return <MarkdownCodeBlock code={text} language={langMatch?.[1]} />;
  }

  return <code className={className}>{children}</code>;
}

function MarkdownImage({
  src,
  alt,
}: React.ImgHTMLAttributes<HTMLImageElement>) {
  const [failed, setFailed] = React.useState(false);
  const resolved = resolveMarkdownImageSrc(src);

  if (!resolved || failed) {
    return (
      <div className="ph-prose-img-fallback">
        <span>图片无法加载</span>
        {resolved ? (
          <a href={resolved} target="_blank" rel="noreferrer">
            在新标签页打开
          </a>
        ) : null}
      </div>
    );
  }

  return (
    <img
      src={resolved}
      alt={alt ?? ''}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  );
}

function headingId(children: React.ReactNode) {
  return slugifyHeading(flattenMarkdownText(children));
}

/** Markdown 渲染：GFM + 代码块工具栏 + 图片代理 + 统一 heading 锚点 */
const MarkdownViewer: React.FC<MarkdownViewerProps> = ({
  source,
  prose = true,
}) => {
  const normalized = useMemo(() => normalizeMarkdownSource(source), [source]);

  const content = useMemo(
    () => (
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: 'a',
          img: ({ src, alt }) => <MarkdownImage src={src} alt={alt} />,
          code: MarkdownCode,
          h2: ({ children }) => (
            <h2 id={headingId(children)}>{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 id={headingId(children)}>{children}</h3>
          ),
        }}
      >
        {normalized}
      </ReactMarkdown>
    ),
    [normalized],
  );

  return prose ? <div className="ph-prose">{content}</div> : content;
};

export default MarkdownViewer;
