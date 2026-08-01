import { Image } from 'antd';
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

/** 正文图片最大展示高度（px），原图更矮时不拉伸 */
const PROSE_IMAGE_MAX_HEIGHT = 400;

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
    <span className="ph-prose-img-wrap">
      <Image
        src={resolved}
        alt={alt ?? ''}
        className="ph-prose-img"
        style={{ maxHeight: PROSE_IMAGE_MAX_HEIGHT }}
        referrerPolicy="no-referrer"
        // antd v6：mask 已弃用，hover 遮罩实际是 cover 层
        preview={{ mask: false, cover: false }}
        onError={() => setFailed(true)}
      />
    </span>
  );
}

function headingId(children: React.ReactNode) {
  return slugifyHeading(flattenMarkdownText(children));
}

/** Markdown 渲染：GFM + 代码块工具栏 + 固定高度图片预览 + 统一 heading 锚点 */
const MarkdownViewer: React.FC<MarkdownViewerProps> = ({
  source,
  prose = true,
}) => {
  const normalized = useMemo(() => normalizeMarkdownSource(source), [source]);

  const content = useMemo(
    () => (
      <Image.PreviewGroup>
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
      </Image.PreviewGroup>
    ),
    [normalized],
  );

  return prose ? <div className="ph-prose">{content}</div> : content;
};

export default MarkdownViewer;
