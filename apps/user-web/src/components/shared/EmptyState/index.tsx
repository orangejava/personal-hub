import React from 'react';
import ResultState from '../ResultState';

interface EmptyStateProps {
  description?: string;
  /** 提供跳转链接文案与目标，引导用户下一步 */
  actionText?: string;
  actionTo?: string;
  onClear?: () => void;
}

/** 空数据引导态：保留旧入口，内部收敛到统一 ResultState */
const EmptyState: React.FC<EmptyStateProps> = ({
  description = '暂无数据',
  actionText,
  actionTo,
  onClear,
}) => (
  <ResultState
    status="empty"
    description={description}
    actionText={actionText}
    actionTo={actionTo}
    onClear={onClear}
  />
);

export default EmptyState;
