import {
  ProForm,
  ProFormText,
  ProFormTextArea,
} from '@ant-design/pro-components';
import { useIntl, useModel } from '@umijs/max';
import { Card, message } from 'antd';
import React, { useState } from 'react';
import { PageContainer } from '@/components/shared';

/** 个人中心：基础资料 mock 编辑 */
const Profile: React.FC = () => {
  const intl = useIntl();
  const { initialState } = useModel('@@initialState');
  const user = initialState?.currentUser;
  const [saving, setSaving] = useState(false);

  return (
    <PageContainer title={intl.formatMessage({ id: 'workspace.profile.title' })}>
      <Card>
        <ProForm
          initialValues={{
            nickname: user?.nickname,
            email: user?.email,
            signature: '',
          }}
          onFinish={async () => {
            setSaving(true);
            try {
              message.success('已保存（mock，未真正写入）');
              return true;
            } finally {
              setSaving(false);
            }
          }}
          submitter={{
            searchConfig: {
              submitText: intl.formatMessage({ id: 'workspace.common.save' }),
            },
            submitButtonProps: { loading: saving },
          }}
        >
          <ProFormText
            name="nickname"
            label="昵称"
            rules={[{ required: true }]}
          />
          <ProFormText name="email" label="邮箱" disabled />
          <ProFormTextArea
            name="signature"
            label="个人签名"
            placeholder="一句话介绍自己"
          />
        </ProForm>
      </Card>
    </PageContainer>
  );
};

export default Profile;
