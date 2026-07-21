import { SenderSwitch } from '@ant-design/x';
import type { SenderSwitchProps } from '@ant-design/x/es/sender/SenderSwitch';
import React from 'react';

/**
 * AI 输入区开关封装。
 *
 * 用于联网搜索、深度思考、工具调用等输入区快捷开关，保留底层语义化
 * classNames/styles 透传能力。
 */
const AiXSenderSwitch: React.FC<SenderSwitchProps> = (props) => (
  <SenderSwitch {...props} />
);

export default AiXSenderSwitch;

