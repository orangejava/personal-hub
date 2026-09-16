import React from 'react';
import ResultState from '../ResultState';

/** 无权限态 */
const ForbiddenState: React.FC<{ message?: string }> = ({
  message = '你没有访问该页面的权限',
}) => (
  <ResultState
    status="forbidden"
    title="403"
    description={message}
    actionText="返回首页"
    actionTo="/"
  />
);

export default ForbiddenState;
