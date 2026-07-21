import React from 'react';
import ResultState from '../ResultState';

/** 未登录引导态 */
const LoginRequired: React.FC = () => (
  <ResultState
    status="warning"
    title="请先登录"
    description="该功能需要登录后使用"
    actionText="去登录"
    actionTo="/user/login"
  />
);

export default LoginRequired;
