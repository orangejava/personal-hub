import { FileCard, type FileCardProps } from '@ant-design/x';
import type { FileCardListProps } from '@ant-design/x/es/file-card';
import React from 'react';

/**
 * AI 文件卡片封装。
 *
 * 用于资产、附件和生成结果文件展示，保留 FileCard.List，方便资产列表后续
 * 统一接入预览、删除、移动到文件夹等交互。
 */
const AiXFileCard = Object.assign(
  (props: FileCardProps) => <FileCard {...props} />,
  {
    List: (props: FileCardListProps) => <FileCard.List {...props} />,
  },
);

export default AiXFileCard;

