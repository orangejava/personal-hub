import { CodeHighlighter, type CodeHighlighterProps } from '@ant-design/x';
import React from 'react';

/**
 * AI 代码高亮封装。
 *
 * 主要服务于 Chat / Text 的 Markdown 代码块，后续可在这里统一切换主题、
 * 行号、复制按钮或安全渲染策略。
 */
const AiXCodeHighlighter: React.FC<CodeHighlighterProps> = (props) => (
  <CodeHighlighter {...props} />
);

export default AiXCodeHighlighter;

