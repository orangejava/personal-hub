import { Sources, type SourcesProps } from '@ant-design/x';
import React from 'react';

/**
 * AI 引用来源封装。
 *
 * 用于展示知识内容、文件、外部链接等引用来源，后续内容中心“引用到 AI”
 * 会优先复用这里的样式和事件出口。
 */
const AiXSources: React.FC<SourcesProps> = (props) => <Sources {...props} />;

export default AiXSources;

