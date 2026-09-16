import { history, Link } from '@umijs/max';
import { Button, Empty, Result } from 'antd';
import React from 'react';

type ResultStateStatus =
  | 'empty'
  | 'filtered-empty'
  | 'error'
  | 'forbidden'
  | 'offline'
  | 'success'
  | 'warning'
  | 'info';

interface ResultStateProps {
  status?: ResultStateStatus;
  title?: string;
  description?: string;
  actionText?: string;
  actionTo?: string;
  clearText?: string;
  onClear?: () => void;
  onRetry?: () => void;
  onBack?: () => void;
}

/**
 * 页面与区块通用结果态。
 *
 * error/warning/success 使用 Ant Design Result，empty 使用 Empty，
 * 统一承载“重试、返回、跳转”动作，避免各页面重复拼异常反馈。
 */
const ResultState: React.FC<ResultStateProps> = ({
  status = 'empty',
  title,
  description,
  actionText,
  actionTo,
  clearText = '清除筛选',
  onClear,
  onRetry,
  onBack,
}) => {
  const extra = (
    <>
      {onRetry && <Button onClick={onRetry}>重试</Button>}
      {onClear && <Button onClick={onClear}>{clearText}</Button>}
      {onBack && <Button onClick={onBack}>返回</Button>}
      {!onBack && status === 'error' && (
        <Button onClick={() => history.back()}>返回</Button>
      )}
      {actionText && actionTo && (
        <Link to={actionTo}>
          <Button type="primary">{actionText}</Button>
        </Link>
      )}
    </>
  );

  if (status === 'empty' || status === 'filtered-empty') {
    return (
      <Empty
        description={
          description ??
          title ??
          (status === 'filtered-empty' ? '没有匹配的数据' : '暂无数据')
        }
        style={{ padding: '48px 0' }}
      >
        {onClear && <Button onClick={onClear}>{clearText}</Button>}
        {actionText && actionTo && (
          <Link to={actionTo}>
            <Button type="primary">{actionText}</Button>
          </Link>
        )}
      </Empty>
    );
  }

  return (
    <Result
      status={
        status === 'info'
          ? '404'
          : status === 'forbidden'
            ? '403'
            : status === 'offline'
              ? 'warning'
              : status
      }
      title={
        title ??
        (status === 'error'
          ? '加载失败'
          : status === 'forbidden'
            ? '暂无访问权限'
            : status === 'offline'
              ? '网络连接异常'
              : '操作完成')
      }
      subTitle={description}
      extra={extra}
    />
  );
};

export default ResultState;
