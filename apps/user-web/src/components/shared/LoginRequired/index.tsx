import { useLocation } from '@umijs/max';
import React from 'react';
import { buildLoginPath } from '@/utils/loginPath';
import ResultState from '../ResultState';

/** 未登录引导态，登录成功后回到当前页 */
const LoginRequired: React.FC = () => {
  const location = useLocation();

  return (
    <ResultState
      status="warning"
      title="请先登录"
      description="该功能需要登录后使用"
      actionText="去登录"
      actionTo={buildLoginPath(
        `${location.pathname}${location.search}${location.hash}`,
      )}
    />
  );
};

export default LoginRequired;
