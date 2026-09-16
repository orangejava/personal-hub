import { Attachments, type AttachmentsProps } from '@ant-design/x';
import React from 'react';

/**
 * AI 附件区封装。
 *
 * 用于 Chat 引用文件、图片/视频参考素材等场景，保持 upload、classNames、styles
 * 等底层扩展点透传，业务侧不直接依赖 Ant Design X。
 */
const AiXAttachments: React.FC<AttachmentsProps> = (props) => (
  <Attachments {...props} />
);

export default AiXAttachments;

