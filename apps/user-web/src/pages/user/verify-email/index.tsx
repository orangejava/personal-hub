import { Helmet, history } from '@umijs/max';
import { Button, Result, Spin } from 'antd';
import React, { useEffect, useState } from 'react';
import { Footer } from '@/components';
import { AuthPageShell } from '@/pages/user/AuthPageShell';
import { nestError, verifyEmail } from '@/services/auth';

type VerifyStatus = 'loading' | 'success' | 'error' | 'missing';

const VerifyEmail: React.FC = () => {
  const [status, setStatus] = useState<VerifyStatus>('loading');
  const [errorText, setErrorText] = useState('验证链接无效或已过期');

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get('token');
    if (!token) {
      setStatus('missing');
      return;
    }

    let cancelled = false;
    verifyEmail({ token })
      .then((res) => {
        if (cancelled) {
          return;
        }
        if (res?.verified) {
          setStatus('success');
          return;
        }
        setErrorText('验证失败');
        setStatus('error');
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }
        const nest = nestError(error);
        setErrorText(nest.message || (error as Error).message || '验证失败');
        setStatus('error');
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <AuthPageShell>
      <Helmet>
        <title>验证邮箱 - Personal Hub</title>
      </Helmet>
      <div style={{ flex: 1, padding: '32px 0' }}>
        {status === 'loading' && (
          <div style={{ textAlign: 'center', paddingTop: 120 }}>
            <Spin size="large" description="正在验证邮箱…" />
          </div>
        )}
        {status === 'success' && (
          <Result
            status="success"
            title="邮箱已验证"
            subTitle="账号已激活，并已写入初始 AI 额度。现在可以使用该邮箱登录。"
            extra={
              <Button
                type="primary"
                onClick={() => history.push('/user/login')}
              >
                去登录
              </Button>
            }
          />
        )}
        {(status === 'error' || status === 'missing') && (
          <Result
            status="error"
            title="无法完成验证"
            subTitle={
              status === 'missing'
                ? '链接缺少验证参数，请从邮件重新打开。'
                : errorText
            }
            extra={
              <Button onClick={() => history.push('/user/login')}>
                返回登录
              </Button>
            }
          />
        )}
      </div>
      <Footer />
    </AuthPageShell>
  );
};

export default VerifyEmail;
