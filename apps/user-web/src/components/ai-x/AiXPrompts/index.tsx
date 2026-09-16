import { Prompts, type PromptsProps } from '@ant-design/x';
import React from 'react';

/** Prompt 推荐项封装，用于首页模板和 Chat 空态建议。 */
const AiXPrompts: React.FC<PromptsProps> = (props) => <Prompts {...props} />;

export default AiXPrompts;

