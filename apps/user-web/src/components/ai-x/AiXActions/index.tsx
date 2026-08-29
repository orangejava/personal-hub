import { Actions, type ActionsProps } from '@ant-design/x';
import React from 'react';

/**
 * AI 消息动作封装。
 *
 * 只在本地封装层接触 Ant Design X，保留 Copy、Feedback、Audio 等静态子能力，
 * 后续统一调整消息操作按钮的样式、埋点和默认交互时从这里收口。
 */
const AiXActions = Object.assign(
  (props: ActionsProps) => <Actions {...props} />,
  {
    Feedback: Actions.Feedback,
    Copy: Actions.Copy,
    Item: Actions.Item,
    Audio: Actions.Audio,
  },
);

export default AiXActions;

