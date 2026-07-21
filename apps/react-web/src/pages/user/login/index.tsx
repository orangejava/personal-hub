import { LockOutlined, UserOutlined } from '@ant-design/icons';
import { LoginForm, ProFormText } from '@ant-design/pro-components';
import { Helmet, history, useModel } from '@umijs/max';
import { Alert, App } from 'antd';
import { createStyles } from 'antd-style';
import React, { startTransition, useState } from 'react';
import { Footer } from '@/components';
import {
  fetchCurrentUser,
  fetchPermissions,
  login as loginService,
} from '@/services/auth';
import { fetchPublicConfig } from '@/services/system';

const useStyles = createStyles(() => ({
  container: {
    display: 'flex',
    flexDirection: 'column' as const,
    height: '100vh',
    overflow: 'auto',
    background: 'linear-gradient(135deg, #f5f7fa 0%, #e4ecf7 100%)',
  },
}));

/** 防止开放重定向，仅允许同源相对路径 */
const getSafeRedirectUrl = (redirect: string | null): string => {
  if (!redirect?.startsWith('/') || redirect.startsWith('//')) return '/';
  try {
    const parsed = new URL(redirect, window.location.origin);
    if (parsed.origin !== window.location.origin) return '/';
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return '/';
  }
};

const Login: React.FC = () => {
  const { setInitialState } = useModel('@@initialState');
  const { styles } = useStyles();
  const { message } = App.useApp();
  const [errorText, setErrorText] = useState<string>('');

  /** 登录成功后补全 initialState（用户、权限菜单、系统配置） */
  const refreshInitialState = async () => {
    const userRes = await fetchCurrentUser();
    if (userRes?.code !== 0) return;
    const permRes = await fetchPermissions();
    const sysRes = await fetchPublicConfig();
    startTransition(() => {
      setInitialState((s) => ({
        ...s,
        currentUser: userRes.data,
        permissions: permRes?.data?.permissions,
        menu: permRes?.data?.menu,
        systemConfig: sysRes?.data,
      }));
    });
  };

  const handleSubmit = async (values: { email: string; password: string }) => {
    try {
      const res = await loginService(values);
      if (res?.code === 0) {
        localStorage.setItem('ph-token', res.data.token);
        message.success('登录成功');
        await refreshInitialState();
        const redirect = new URL(window.location.href).searchParams.get(
          'redirect',
        );
        history.replace(getSafeRedirectUrl(redirect));
        return;
      }
      setErrorText(res?.message || '登录失败');
    } catch (e: any) {
      setErrorText(e?.message || '登录失败，请重试');
    }
  };

  return (
    <div className={styles.container}>
      <Helmet>
        <title>登录 - Personal Hub</title>
      </Helmet>
      <div style={{ flex: 1, padding: '32px 0' }}>
        <LoginForm
          contentStyle={{ minWidth: 280, maxWidth: '75vw' }}
          title="Personal Hub"
          subTitle="个人知识中台 + AI 工具箱"
          onFinish={async (values) =>
            handleSubmit(values as { email: string; password: string })
          }
        >
          {errorText && (
            <Alert
              style={{ marginBottom: 24 }}
              type="error"
              showIcon
              title={errorText}
            />
          )}
          <ProFormText
            name="email"
            fieldProps={{ size: 'large', prefix: <UserOutlined /> }}
            placeholder="请输入邮箱"
            rules={[
              { required: true, message: '请输入邮箱' },
              { type: 'email', message: '邮箱格式不正确' },
            ]}
          />
          <ProFormText.Password
            name="password"
            fieldProps={{ size: 'large', prefix: <LockOutlined /> }}
            placeholder="请输入密码"
            rules={[{ required: true, message: '请输入密码' }]}
          />
        </LoginForm>
      </div>
      <Footer />
    </div>
  );
};

export default Login;
