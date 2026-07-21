import { Conversations, type ConversationsProps } from '@ant-design/x';
import React from 'react';

/** AI 会话列表封装，后续统一追加中文默认操作和业务埋点。 */
const AiXConversations: React.FC<ConversationsProps> = (props) => (
  <Conversations {...props} />
);

export default AiXConversations;

