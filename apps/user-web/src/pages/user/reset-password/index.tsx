import { LockOutlined } from '@ant-design/icons';
import { LoginForm, ProFormText } from '@ant-design/pro-components';
import { Helmet, history } from '@umijs/max';
import { Alert, App, Button, Result } from 'antd';
import React, { useMemo, useState } from 'react';
import { Footer } from '@/components';
import { AuthPageShell } from '@/pages/user/AuthPageShell';
import { nestError, resetPassword } from '@/services/auth';
import { buildLoginPath } from '@/utils/loginPath';

const PASSWORD_POLICY = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9\s]).{8,}$/;

/** 邮件链接落地页：用一次性 Token 设置新密码。 */
const ResetPassword: React.FC = () => {
  const { message } = App.useApp();
  const [errorText, setErrorText] = useState('');
  const [done, setDone] = useState(false);
  const token = useMemo(
    () => new URLSearchParams(window.location.search).get('token') ?? '',
    [],
  );

  const handleSubmit = async (values: { newPassword: string }) => {
    try {
      await resetPassword({ token, newPassword: values.newPassword });
      setDone(true);
      message.success('密码已重置，请使用新密码登录');
    } catch (error: unknown) {
      const nest = nestError(error);
      setErrorText(nest.message || (error as Error).message || '重置失败，请重试');
    }
  };

  return (
    <AuthPageShell>
      <Helmet>
        <title>重置密码 - Personal Hub</title>
      </Helmet>
      <div style={{ flex: 1, padding: '32px 0' }}>
        {!token ? (
          <Result
            status="warning"
            title="重置链接无效"
            extra={
              <Button type="primary" onClick={() => history.push('/user/forgot-password')}>
                重新申请
              </Button>
            }
          />
        ) : done ? (
          <Result
            status="success"
            title="密码已更新"
            extra={
              <Button type="primary" onClick={() => history.replace(buildLoginPath())}>
                去登录
              </Button>
            }
          />
        ) : (
          <LoginForm
            contentStyle={{ minWidth: 280, maxWidth: '75vw' }}
            title="重置密码"
            subTitle="链接 30 分钟内有效，成功后需重新登录"
            submitter={{ searchConfig: { submitText: '确认重置' } }}
            onFinish={async (values) => handleSubmit(values as { newPassword: string })}
          >
            {errorText && (
              <Alert style={{ marginBottom: 24 }} type="error" showIcon title={errorText} />
            )}
            <ProFormText.Password
              name="newPassword"
              fieldProps={{ size: 'large', prefix: <LockOutlined /> }}
              placeholder="新密码"
              rules={[
                { required: true, message: '请输入新密码' },
                {
                  pattern: PASSWORD_POLICY,
                  message: '至少 8 位，含大小写、数字和特殊字符',
                },
              ]}
            />
            <ProFormText.Password
              name="confirmPassword"
              fieldProps={{ size: 'large', prefix: <LockOutlined /> }}
              placeholder="再次输入新密码"
              dependencies={['newPassword']}
              rules={[
                { required: true, message: '请再次输入新密码' },
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    if (!value || getFieldValue('newPassword') === value) {
                      return Promise.resolve();
                    }
                    return Promise.reject(new Error('两次输入的密码不一致'));
                  },
                }),
              ]}
            />
          </LoginForm>
        )}
      </div>
      <Footer />
    </AuthPageShell>
  );
};

export default ResetPassword;
