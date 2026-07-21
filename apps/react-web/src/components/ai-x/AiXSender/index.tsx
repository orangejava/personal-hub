import { Sender, type SenderProps } from '@ant-design/x';
import React from 'react';

/**
 * AI 输入区封装。
 *
 * 阶段 5 会在业务组件中组合出 ChatGPT / DeepSeek 风格输入区，
 * 这里保留 Sender 原始 props，保证 className/styles 能继续向下透传。
 */
const AiXSender: React.FC<SenderProps> = (props) => <Sender {...props} />;

export default AiXSender;

