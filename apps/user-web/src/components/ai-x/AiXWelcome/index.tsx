import { Welcome, type WelcomeProps } from '@ant-design/x';
import React from 'react';

/**
 * AI 欢迎区封装。
 *
 * 用于 Chat 空会话、AI 首页引导和工具占位页，后续可统一品牌文案、
 * 图标和推荐 Prompt 样式。
 */
const AiXWelcome: React.FC<WelcomeProps> = (props) => <Welcome {...props} />;

export default AiXWelcome;

