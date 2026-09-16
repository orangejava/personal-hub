import { MailOutlined } from '@ant-design/icons';
import { LoginForm, ProFormText } from '@ant-design/pro-components';
import { Helmet, history } from '@umijs/max';
import { Alert, App, Button, Result } from 'antd';
import React, { useState } from 'react';
import { Footer } from '@/components';
import { AuthPageShell } from '@/pages/user/AuthPageShell';
import { forgotPassword, nestError } from '@/services/auth';
import { buildLoginPath } from '@/utils/loginPath';

const MAILPIT_UI = 'http://localhost:8025';

/**
 * 忘记密码只收集邮箱。无论邮箱是否存在都展示同一成功态，避免枚举。
 */
const ForgotPassword: React.FC = () => {
  const { message } = App.useApp();
  const [errorText, setErrorText] = useState('');
  const [submittedEmail, setSubmittedEmail] = useState('');

  const handleSubmit = async (values: { email: string }) => {
    try {
      await forgotPassword(values);
      setSubmittedEmail(values.email);
      message.success('如果该邮箱已注册，你将收到重置邮件');
    } catch (error: unknown) {
      const nest = nestError(error);
      setErrorText(nest.message || (error as Error).message || '提交失败，请重试');
    }
  };

  return (
    <AuthPageShell>
      <Helmet>
        <title>忘记密码 - Personal Hub</title>
      </Helmet>
      <div style={{ flex: 1, padding: '32px 0' }}>
        {submittedEmail ? (
          <Result
            status="success"
            title="请查收重置邮件"
            subTitle={`如果 ${submittedEmail} 已激活，重置链接 30 分钟内有效。本地开发请打开 Mailpit。`}
            extra={[
              <Button key="mailpit" type="primary" href={MAILPIT_UI} target="_blank">
                打开 Mailpit
              </Button>,
              <Button key="login" onClick={() => history.push(buildLoginPath())}>
                返回登录
              </Button>,
            ]}
          />
        ) : (
          <LoginForm
            contentStyle={{ minWidth: 280, maxWidth: '75vw' }}
            title="忘记密码"
            subTitle="我们会向已激活邮箱发送一次性重置链接"
            submitter={{ searchConfig: { submitText: '发送重置邮件' } }}
            onFinish={async (values) => handleSubmit(values as { email: string })}
          >
            {errorText && (
              <Alert style={{ marginBottom: 24 }} type="error" showIcon title={errorText} />
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
            <div style={{ marginBottom: 16, textAlign: 'center' }}>
              <a href={buildLoginPath()}>返回登录</a>
            </div>
          </LoginForm>
        )}
      </div>
      <Footer />
    </AuthPageShell>
  );
};

export default ForgotPassword;
