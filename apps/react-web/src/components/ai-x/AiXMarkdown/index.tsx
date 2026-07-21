import XMarkdown, { type XMarkdownProps } from '@ant-design/x-markdown';
import '@ant-design/x-markdown/es/XMarkdown/index.css';
import React from 'react';

/** 流式 Markdown 渲染封装，避免页面直接依赖 x-markdown 包路径。 */
const AiXMarkdown: React.FC<XMarkdownProps> = (props) => (
  <XMarkdown {...props} />
);

export default AiXMarkdown;

