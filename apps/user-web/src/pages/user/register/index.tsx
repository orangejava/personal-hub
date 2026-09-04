import { LockOutlined, MailOutlined, UserOutlined } from '@ant-design/icons';
import { LoginForm, ProFormText } from '@ant-design/pro-components';
import { Helmet, history } from '@umijs/max';
import { Alert, App, Button, Result } from 'antd';
import React, { useState } from 'react';
import { Footer } from '@/components';
import { AuthPageShell } from '@/pages/user/AuthPageShell';
import { nestError, register as registerService } from '@/services/auth';

const MAILPIT_UI = 'http://localhost:8025';
const PASSWORD_POLICY =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9\s]).{8,}$/;

const Register: React.FC = () => {
  const { message } = App.useApp();
  const [errorText, setErrorText] = useState('');
  const [submittedEmail, setSubmittedEmail] = useState('');

  const handleSubmit = async (values: {
    email: string;
    password: string;
    nickname?: string;
  }) => {
    try {
      await registerService(values);
      setSubmittedEmail(values.email);
      message.success('注册请求已提交');
    } catch (error: unknown) {
      const nest = nestError(error);
      setErrorText(
        nest.message || (error as Error).message || '注册失败，请重试',
      );
    }
  };

  return (
    <AuthPageShell>
      <Helmet>
        <title>注册 - Personal Hub</title>
      </Helmet>
      <div style={{ flex: 1, padding: '32px 0' }}>
        {submittedEmail ? (
          <Result
            status="success"
            title="请查收验证邮件"
            subTitle={`我们已向 ${submittedEmail} 发送验证链接（24 小时内有效）。本地开发请打开 Mailpit 查看邮件。`}
            extra={[
              <Button
                key="mailpit"
                type="primary"
                href={MAILPIT_UI}
                target="_blank"
              >
                打开 Mailpit
              </Button>,
              <Button key="login" onClick={() => history.push('/user/login')}>
                返回登录
              </Button>,
            ]}
          />
        ) : (
          <LoginForm
            contentStyle={{ minWidth: 280, maxWidth: '75vw' }}
            title="创建账号"
            subTitle="注册后需先完成邮箱验证才能登录"
            submitter={{ searchConfig: { submitText: '注册' } }}
            onFinish={async (values) =>
              handleSubmit(
                values as {
                  email: string;
                  password: string;
                  nickname?: string;
                },
              )
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
              fieldProps={{ size: 'large', prefix: <MailOutlined /> }}
              placeholder="请输入邮箱"
              rules={[
                { required: true, message: '请输入邮箱' },
                { type: 'email', message: '邮箱格式不正确' },
              ]}
            />
            <ProFormText
              name="nickname"
              fieldProps={{ size: 'large', prefix: <UserOutlined /> }}
              placeholder="昵称（可选）"
              rules={[{ max: 80, message: '昵称最多 80 个字符' }]}
            />
            <ProFormText.Password
              name="password"
              fieldProps={{ size: 'large', prefix: <LockOutlined /> }}
              placeholder="至少 8 位，含大小写、数字和特殊字符"
              rules={[
                { required: true, message: '请输入密码' },
                {
                  pattern: PASSWORD_POLICY,
                  message:
                    '密码至少 8 位，且必须包含大写、小写、数字和特殊字符',
                },
              ]}
            />
            <div style={{ marginBottom: 16, textAlign: 'center' }}>
              <a href="/user/login">已有账号？去登录</a>
            </div>
          </LoginForm>
        )}
      </div>
      <Footer />
    </AuthPageShell>
  );
};

export default Register;
