import { Mermaid, type MermaidProps } from '@ant-design/x';
import React from 'react';

/**
 * AI Mermaid 图封装。
 *
 * 用于 AI 回复中的流程图、时序图和结构图，后续可统一增加渲染失败态、
 * 暗色主题适配和安全限制。
 */
const AiXMermaid: React.FC<MermaidProps> = (props) => <Mermaid {...props} />;

export default AiXMermaid;

