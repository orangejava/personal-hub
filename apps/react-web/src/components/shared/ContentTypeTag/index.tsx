import { type ContentType, ContentTypeLabel } from '@personal-hub/shared-types';
import { Tag } from 'antd';
import React from 'react';

/** 内容类型标签 */
const ContentTypeTag: React.FC<{ type: ContentType }> = ({ type }) => (
  <Tag color="blue">{ContentTypeLabel[type]}</Tag>
);

export default ContentTypeTag;
