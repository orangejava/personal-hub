import { ThoughtChain, type ThoughtChainProps } from '@ant-design/x';
import type { ThoughtChainItemProps } from '@ant-design/x/es/thought-chain';
import React from 'react';

/**
 * AI 思考链封装。
 *
 * 用于 Agent、工作流和多步骤生成任务的过程展示，保留 Item 子组件，
 * 后续可统一接入状态颜色、耗时、失败重试等业务表现。
 */
const AiXThoughtChain = Object.assign(
  (props: ThoughtChainProps) => <ThoughtChain {...props} />,
  {
    Item: (props: ThoughtChainItemProps) => <ThoughtChain.Item {...props} />,
  },
);

export default AiXThoughtChain;

