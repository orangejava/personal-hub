import {
  ProForm,
  ProFormText,
  ProFormTextArea,
} from '@ant-design/pro-components';
import { useIntl, useModel } from '@umijs/max';
import { Button, Card, message, Space, Typography } from 'antd';
import { Avatar, Col, Row, Tag } from 'antd';
import { history } from '@umijs/max';
import React, { useRef, useState } from 'react';
import { newIdempotencyKey } from '@personal-hub/api-client';
import PageContainer from '@/components/shared/PageContainer';
import { updateCurrentUser } from '@/services/auth';

/** 个人中心：资料保存写入当前用户，并同步工作区初始状态。 */
const Profile: React.FC = () => {
  const intl = useIntl();
  const { initialState, setInitialState } = useModel('@@initialState');
  const user = initialState?.currentUser;
  const [saving, setSaving] = useState(false);
  const pendingSave = useRef<{ fingerprint: string; key: string } | null>(null);

  return (
    <PageContainer title={intl.formatMessage({ id: 'workspace.profile.title' })}>
      <Card style={{ marginBottom: 16 }}>
        <Space size={16} align="start" wrap>
          <Avatar size={64} src={user?.avatar}>{(user?.nickname ?? user?.email ?? 'U').slice(0, 1).toUpperCase()}</Avatar>
          <Space direction="vertical" size={2}>
            <Typography.Title level={4} style={{ margin: 0 }}>{user?.nickname || intl.formatMessage({ id: 'workspace.profile.noNickname' })}</Typography.Title>
            <Typography.Text type="secondary">{user?.email}</Typography.Text>
            <Tag color={user?.status === 'active' ? 'green' : 'red'}>{intl.formatMessage({ id: user?.status === 'active' ? 'workspace.profile.active' : 'workspace.profile.disabled' })}</Tag>
          </Space>
        </Space>
      </Card>
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={16}>
      <Card>
        <ProForm
          initialValues={{
            nickname: user?.nickname,
            email: user?.email,
            signature: user?.bio ?? '',
          }}
          onFinish={async (values) => {
            const payload = { nickname: values.nickname, bio: values.signature };
            const fingerprint = JSON.stringify(payload);
            if (pendingSave.current?.fingerprint !== fingerprint) {
              pendingSave.current = { fingerprint, key: newIdempotencyKey() };
            }
            setSaving(true);
            try {
              const updated = await updateCurrentUser(payload, pendingSave.current.key);
              // 资料接口只返回用户摘要；权限由独立接口加载，保存时保留当前权限快照。
              setInitialState((current) =>
                current?.currentUser?.id === updated.id
                  ? {
                      ...current,
                      currentUser: {
                        ...updated,
                        permissions: current.currentUser.permissions,
                      },
                    }
                  : current,
              );
              message.success(intl.formatMessage({ id: 'workspace.profile.saved' }));
              pendingSave.current = null;
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
            label={intl.formatMessage({ id: 'workspace.profile.nickname' })}
            rules={[{ required: true }]}
          />
          <ProFormText name="email" label={intl.formatMessage({ id: 'workspace.profile.email' })} disabled />
          <ProFormTextArea
            name="signature"
            label={intl.formatMessage({ id: 'workspace.profile.signature' })}
            placeholder={intl.formatMessage({ id: 'workspace.profile.signaturePlaceholder' })}
          />
        </ProForm>
      </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card title={intl.formatMessage({ id: 'workspace.profile.security' })}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <Typography.Text>{intl.formatMessage({ id: 'workspace.profile.emailValue' }, { email: user?.email ?? '' })}</Typography.Text>
              <Typography.Text type="secondary">{intl.formatMessage({ id: 'workspace.profile.securityDescription' })}</Typography.Text>
              <Button type="link" style={{ paddingLeft: 0 }} onClick={() => history.push('/workspace/sessions')}>{intl.formatMessage({ id: 'workspace.profile.devices' })}</Button>
            </Space>
          </Card>
        </Col>
      </Row>
      <Card title={intl.formatMessage({ id: 'workspace.profile.aiManagement' })} style={{ marginTop: 16 }}>
        <Space direction="vertical" size={4}>
          <Typography.Text type="secondary">
            {intl.formatMessage({ id: 'workspace.profile.aiManagementDescription' })}
          </Typography.Text>
          <Button type="link" onClick={() => history.push('/workspace/ai')} style={{ paddingLeft: 0 }}>
            {intl.formatMessage({ id: 'workspace.profile.openAiManagement' })}
          </Button>
        </Space>
      </Card>
    </PageContainer>
  );
};

export default Profile;
