import { Think, type ThinkProps } from '@ant-design/x';
import React from 'react';

/**
 * AI 思考过程封装。
 *
 * 用于后续展示模型思考、检索中、工具调用前置状态；阶段 5 先保持透传，
 * 确保页面不直接依赖 Ant Design X。
 */
const AiXThink: React.FC<ThinkProps> = (props) => <Think {...props} />;

export default AiXThink;

