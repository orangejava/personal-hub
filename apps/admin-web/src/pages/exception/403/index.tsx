import { Button, Card, Result } from 'antd';
import { useModel } from '@umijs/max';
import React, { useEffect } from 'react';
import {
  buildUserWebLoginUrl,
  getUserWebOrigin,
} from '@personal-hub/app-origins';

/** 未登录跳用户端登录；已登录但无后台权限则留在本页 */
const Exception403: React.FC = () => {
  const { initialState } = useModel('@@initialState');

  useEffect(() => {
    if (!initialState?.currentUser && !initialState?.sessionRestoreFailed) {
      window.location.replace(buildUserWebLoginUrl(window.location.href));
    }
  }, [initialState?.currentUser, initialState?.sessionRestoreFailed]);

  return (
    <Card variant="borderless">
      <Result
        status="403"
        title="403"
        subTitle="没有后台管理权限"
        extra={
          <Button type="primary" href={getUserWebOrigin()}>
            返回前台
          </Button>
        }
      />
    </Card>
  );
};

export default Exception403;
