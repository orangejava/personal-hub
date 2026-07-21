import {
  ContentStatus,
  ContentStatusLabel,
  ContentVisibility,
  ContentVisibilityLabel,
} from '@personal-hub/shared-types';
import { Badge } from 'antd';
import React from 'react';

const statusColor: Record<ContentStatus, string> = {
  [ContentStatus.Draft]: 'default',
  [ContentStatus.Published]: 'success',
  [ContentStatus.Archived]: 'warning',
};

/** 内容状态徽标 */
const StatusBadge: React.FC<{
  status?: ContentStatus;
  visibility?: ContentVisibility;
}> = ({ status, visibility }) => (
  <>
    {status && (
      <Badge
        status={statusColor[status] as any}
        text={ContentStatusLabel[status]}
      />
    )}
    {visibility && visibility !== ContentVisibility.Public && (
      <span style={{ marginLeft: 12, color: 'rgba(0,0,0,0.45)' }}>
        {ContentVisibilityLabel[visibility]}
      </span>
    )}
  </>
);

export default StatusBadge;
