import { CaretRightOutlined, CopyOutlined } from '@ant-design/icons';
import hljs from 'highlight.js';
import React, { useMemo, useState } from 'react';
import { copyToClipboard } from '@/utils/copyToClipboard';

interface MarkdownCodeBlockProps {
  code: string;
  language?: string;
}

/** 掘金风格代码块：折叠、语言标签、复制 */
const MarkdownCodeBlock: React.FC<MarkdownCodeBlockProps> = ({
  code,
  language,
}) => {
  const [collapsed, setCollapsed] = useState(false);

  const highlighted = useMemo(() => {
    try {
      if (language && hljs.getLanguage(language)) {
        return hljs.highlight(code, { language, ignoreIllegals: true }).value;
      }
      return hljs.highlightAuto(code).value;
    } catch {
      return hljs.highlightAuto(code).value;
    }
  }, [code, language]);

  const langLabel = language || 'code';

  return (
    <div className="ph-code-block">
      <div className="ph-code-block-toolbar">
        <button
          type="button"
          className="ph-code-block-btn"
          aria-label={collapsed ? '展开代码' : '折叠代码'}
          onClick={() => setCollapsed((v) => !v)}
        >
          <CaretRightOutlined rotate={collapsed ? 0 : 90} />
          <span>{langLabel}</span>
        </button>
        <button
          type="button"
          className="ph-code-block-copy"
          onClick={() => void copyToClipboard(code, '代码已复制')}
        >
          <CopyOutlined /> 复制代码
        </button>
      </div>
      {!collapsed && (
        <pre className="ph-code-block-pre">
          <code
            className={language ? `hljs language-${language}` : 'hljs'}
            // biome-ignore lint/security/noDangerouslySetInnerHtml: highlight.js
            dangerouslySetInnerHTML={{ __html: highlighted }}
          />
        </pre>
      )}
    </div>
  );
};

export default MarkdownCodeBlock;
