import { LockOutlined, UserOutlined } from '@ant-design/icons';
import { LoginForm, ProFormText } from '@ant-design/pro-components';
import { Helmet, history, useModel } from '@umijs/max';
import { Alert, App, Button, Checkbox, Form } from 'antd';
import React, { useEffect, useState } from 'react';
import { isNestAuthEnabled } from '@personal-hub/api-client';
import { Footer } from '@/components';
import { AuthPageShell } from '@/pages/user/AuthPageShell';
import {
  createCaptchaChallenge,
  fetchCurrentUser,
  fetchPermissions,
  login as loginService,
  nestError,
  resendVerification,
} from '@/services/auth';
import { fetchPublicConfig } from '@/services/system';
import {
  getRememberedLoginEmail,
  setRememberedLoginEmail,
} from '@/utils/clientPreferences';
import { resolvePostLoginRedirect } from '@personal-hub/app-origins';

/** 与 Nest `LOGIN_FAIL_WINDOW_SECONDS` 对齐：header 缺失时仍按 15 分钟冷却展示 */
const LOGIN_RATE_LIMIT_FALLBACK_SECONDS = 15 * 60;

/**
 * 把剩余秒数格式化成「X 分 XX 秒」或「X 秒」，给冷却 Alert 使用。
 */
function formatCooldown(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safe / 60);
  const rest = safe % 60;
  if (minutes <= 0) {
    return `${rest} 秒`;
  }
  return `${minutes} 分 ${String(rest).padStart(2, '0')} 秒`;
}

const Login: React.FC = () => {
  const { setInitialState } = useModel('@@initialState');
  const { message } = App.useApp();
  const [form] = Form.useForm();
  /**
   * ProForm 的 initialValues 只在挂载时生效。
   * 必须固定对象引用：勾选「记住用户名」只写 localStorage，不能改这份初始值，否则控制台会警告。
   */
  const [formInitialValues] = useState(() => ({
    email: getRememberedLoginEmail(),
  }));
  const [errorText, setErrorText] = useState<string>('');
  const [unverifiedEmail, setUnverifiedEmail] = useState<string>('');
  const [resending, setResending] = useState(false);
  const [captchaRequired, setCaptchaRequired] = useState(false);
  const [captcha, setCaptcha] = useState<{
    challengeId: string;
    imageSvg: string;
  } | null>(null);
  const [lastEmail, setLastEmail] = useState(formInitialValues.email ?? '');
  const [captchaLoading, setCaptchaLoading] = useState(false);
  const [rememberEmail, setRememberEmail] = useState(
    Boolean(formInitialValues.email),
  );
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null);
  const [cooldownRemain, setCooldownRemain] = useState(0);

  useEffect(() => {
    if (cooldownUntil === null) {
      return;
    }
    const tick = () => {
      const remain = Math.max(0, Math.ceil((cooldownUntil - Date.now()) / 1000));
      setCooldownRemain(remain);
      if (remain <= 0) {
        setCooldownUntil(null);
        setErrorText('');
      }
    };
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [cooldownUntil]);

  /** 登录成功后补全 initialState（用户、权限菜单、系统配置） */
  const refreshInitialState = async () => {
    const userRes = await fetchCurrentUser();
    if (userRes?.code !== 0) return;
    const permRes = await fetchPermissions();
    const sysRes = await fetchPublicConfig();
    // 必须等权限写入 initialState 后再跳工作区/后台，否则 access 会把已登录用户踢回登录页。
    await setInitialState((s) => ({
      ...s,
      currentUser: userRes.data
        ? {
            ...userRes.data,
            permissions: permRes?.data?.permissions ?? userRes.data.permissions,
          }
        : userRes.data,
      permissions: permRes?.data?.permissions,
      permissionGrants: permRes?.data?.permissionGrants,
      menu: permRes?.data?.menu,
      systemConfig: sysRes?.data,
    }));
    return userRes.data;
  };

  const persistRememberedEmail = (email: string | undefined, remember: boolean) => {
    setRememberedLoginEmail(remember ? email : undefined);
  };

  const loadCaptcha = async (email: string) => {
    setCaptchaLoading(true);
    try {
      const res = await createCaptchaChallenge({ email });
      if (res.data) {
        setCaptcha({
          challengeId: res.data.challengeId,
          imageSvg: res.data.imageSvg,
        });
        form.setFieldValue('captchaAnswer', undefined);
      }
    } catch (error: unknown) {
      const nest = nestError(error);
      message.error(nest.message || '验证码加载失败');
    } finally {
      setCaptchaLoading(false);
    }
  };

  const handleSubmit = async (values: {
    email: string;
    password: string;
    captchaAnswer?: string;
  }) => {
    persistRememberedEmail(values.email, rememberEmail);
    if (cooldownRemain > 0) {
      return;
    }
    try {
      const res = await loginService({
        email: values.email,
        password: values.password,
        challengeId: captcha?.challengeId,
        captchaAnswer: values.captchaAnswer,
      });
      if (res?.code === 0) {
        if (!isNestAuthEnabled()) {
          localStorage.setItem('ph-token', res.data.token);
        }
        message.success('登录成功');
        const user = await refreshInitialState();
        if (user?.mustChangePassword) {
          history.replace('/user/change-password');
          return;
        }
        const redirect = new URL(window.location.href).searchParams.get(
          'redirect',
        );
        const next = resolvePostLoginRedirect(redirect);
        if (next.type === 'external') {
          window.location.replace(next.url);
          return;
        }
        history.replace(next.path);
        return;
      }
      setErrorText(res?.message || '登录失败');
    } catch (e: unknown) {
      const nest = nestError(e);
      if (nest.code === 'AUTH_EMAIL_NOT_VERIFIED') {
        setUnverifiedEmail(values.email);
      } else {
        setUnverifiedEmail('');
      }
      if (nest.code === 'AUTH_RATE_LIMITED') {
        const seconds = nest.retryAfterSeconds ?? LOGIN_RATE_LIMIT_FALLBACK_SECONDS;
        setCooldownRemain(seconds);
        setCooldownUntil(Date.now() + seconds * 1000);
        setErrorText('尝试过于频繁');
        return;
      }
      if (nest.code === 'AUTH_CAPTCHA_REQUIRED') {
        setCaptchaRequired(true);
        setLastEmail(values.email);
        await loadCaptcha(values.email);
      } else if (captchaRequired) {
        // 验证码一次性消费后密码仍错，旧图已失效，必须换新挑战。
        await loadCaptcha(values.email);
      }
      setErrorText(nest.message || (e as Error).message || '登录失败，请重试');
    }
  };

  const handleResend = async () => {
    if (!unverifiedEmail) {
      return;
    }
    setResending(true);
    try {
      await resendVerification({ email: unverifiedEmail });
      message.success(
        '如果该邮箱待验证，我们已重新发送链接。本地请查看 Mailpit。',
      );
    } catch (e: unknown) {
      const nest = nestError(e);
      message.error(nest.message || '重发失败，请稍后再试');
    } finally {
      setResending(false);
    }
  };

  return (
    <AuthPageShell>
      <Helmet>
        <title>登录 - Personal Hub</title>
      </Helmet>
      <div style={{ flex: 1, padding: '32px 0' }}>
        <LoginForm
          form={form}
          contentStyle={{ minWidth: 280, maxWidth: '75vw' }}
          title="Personal Hub"
          subTitle="个人知识中台 + AI 工具箱"
          initialValues={formInitialValues}
          submitter={{
            searchConfig: { submitText: '登录' },
            submitButtonProps: { disabled: cooldownRemain > 0 },
          }}
          onFinish={async (values) =>
            handleSubmit(
              values as {
                email: string;
                password: string;
                captchaAnswer?: string;
              },
            )
          }
        >
          {errorText && (
            <Alert
              style={{ marginBottom: 24 }}
              type="error"
              showIcon
              title={
                cooldownRemain > 0
                  ? `尝试过于频繁，请 ${formatCooldown(cooldownRemain)} 后再试`
                  : errorText
              }
              action={
                unverifiedEmail ? (
                  <Button
                    size="small"
                    loading={resending}
                    onClick={handleResend}
                  >
                    重发验证邮件
                  </Button>
                ) : undefined
              }
            />
          )}
          <ProFormText
            name="email"
            fieldProps={{
              size: 'large',
              prefix: <UserOutlined />,
              onBlur: () => {
                if (rememberEmail) {
                  persistRememberedEmail(form.getFieldValue('email'), true);
                }
              },
            }}
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
          {captchaRequired && (
            <div className="ph-auth-captcha-row">
              <button
                type="button"
                className="ph-auth-captcha-image"
                aria-label="刷新验证码"
                onClick={() => {
                  if (lastEmail) {
                    void loadCaptcha(lastEmail);
                  }
                }}
              >
                {captcha?.imageSvg ? (
                  <img
                    alt="登录验证码"
                    src={`data:image/svg+xml;utf8,${encodeURIComponent(captcha.imageSvg)}`}
                    width={160}
                    height={50}
                  />
                ) : (
                  <span style={{ padding: '10px 16px', color: '#666' }}>
                    {captchaLoading ? '加载中…' : '点击获取'}
                  </span>
                )}
              </button>
              <ProFormText
                name="captchaAnswer"
                placeholder="请输入算式结果"
                formItemProps={{ className: 'ph-auth-captcha-input' }}
                fieldProps={{ size: 'large' }}
                rules={[{ required: true, message: '请输入验证码' }]}
              />
            </div>
          )}
          <div className="ph-auth-login-extra">
            <Checkbox
              checked={rememberEmail}
              onChange={(event) => {
                const checked = event.target.checked;
                setRememberEmail(checked);
                persistRememberedEmail(
                  form.getFieldValue('email'),
                  checked,
                );
              }}
            >
              记住用户名
            </Checkbox>
            <span className="ph-auth-login-extra-links">
              <a href="/user/forgot-password">忘记密码</a>
              <a href="/user/register">没有账号？注册</a>
            </span>
          </div>
        </LoginForm>
      </div>
      <Footer />
    </AuthPageShell>
  );
};

export default Login;
