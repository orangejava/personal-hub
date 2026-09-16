import { LockOutlined } from '@ant-design/icons';
import { LoginForm, ProFormText } from '@ant-design/pro-components';
import { Helmet, history, useModel } from '@umijs/max';
import { Alert, App } from 'antd';
import React, { useState } from 'react';
import { Footer } from '@/components';
import { AuthPageShell } from '@/pages/user/AuthPageShell';
import { changePassword, nestError } from '@/services/auth';

const PASSWORD_POLICY =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9\s]).{8,}$/;

interface ChangePasswordFormValues {
  currentPassword: string;
  newPassword: string;
  /** 仅供前端比较两次输入，后端 DTO 不接受该字段。 */
  confirmPassword: string;
}

/** 临时密码首次登录后必须改密；成功后全部会话失效，回到登录页。 */
const ChangePassword: React.FC = () => {
  const { setInitialState } = useModel('@@initialState');
  const { message } = App.useApp();
  const [errorText, setErrorText] = useState('');

  const handleSubmit = async ({
    currentPassword,
    newPassword,
  }: ChangePasswordFormValues) => {
    try {
      await changePassword({ currentPassword, newPassword });
      await setInitialState((s) => ({
        ...s,
        currentUser: undefined,
        permissions: undefined,
        permissionGrants: undefined,
      }));
      message.success('密码已更新，请使用新密码登录');
      history.replace('/user/login');
    } catch (error: unknown) {
      const nest = nestError(error);
      setErrorText(
        nest.message || (error as Error).message || '修改失败，请重试',
      );
    }
  };

  return (
    <AuthPageShell>
      <Helmet>
        <title>修改密码 - Personal Hub</title>
      </Helmet>
      <div style={{ flex: 1, padding: '32px 0' }}>
        <LoginForm
          contentStyle={{ minWidth: 280, maxWidth: '75vw' }}
          title="修改密码"
          subTitle="首次登录或管理员重置后，必须先设置新密码"
          submitter={{ searchConfig: { submitText: '确认修改' } }}
          onFinish={async (values) =>
            handleSubmit(
              values as ChangePasswordFormValues,
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
          <ProFormText.Password
            name="currentPassword"
            fieldProps={{ size: 'large', prefix: <LockOutlined /> }}
            placeholder="当前密码"
            rules={[{ required: true, message: '请输入当前密码' }]}
          />
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
            placeholder="确认新密码"
            dependencies={['newPassword']}
            rules={[
              { required: true, message: '请再次输入新密码' },
              ({ getFieldValue }) => ({
                validator(_, value: string) {
                  if (!value || getFieldValue('newPassword') === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('两次输入的新密码不一致'));
                },
              }),
            ]}
          />
        </LoginForm>
      </div>
      <Footer />
    </AuthPageShell>
  );
};

export default ChangePassword;
