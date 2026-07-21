import React from 'react';
import ResultState from '../ResultState';

interface ErrorStateProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
  onBack?: () => void;
}

/** 请求失败或异常态：保留旧入口，内部收敛到统一 ResultState */
const ErrorState: React.FC<ErrorStateProps> = ({
  title = '加载失败',
  description = '请稍后重试',
  onRetry,
  onBack,
}) => (
  <ResultState
    status="error"
    title={title}
    description={description}
    onRetry={onRetry}
    onBack={onBack}
  />
);

export default ErrorState;
