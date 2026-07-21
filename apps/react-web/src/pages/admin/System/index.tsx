import { ProForm, ProFormText, ProFormTextArea } from '@ant-design/pro-components';
import { useModel, useRequest } from '@umijs/max';
import { Card, message } from 'antd';
import React, { useState } from 'react';
import { ErrorState, PageContainer, SectionSkeleton } from '@/components/shared';
import { fetchAdminSystemConfig, updateAdminSystemConfig } from '@/services/admin';
import { fetchPublicConfig } from '@/services/system';

/** 系统配置：站点名等，保存后刷新 initialState */
const System: React.FC = () => {
  const { setInitialState } = useModel('@@initialState');
  const [saving, setSaving] = useState(false);
  const { data, loading, error, run } = useRequest(fetchAdminSystemConfig);

  const syncPublicConfig = async () => {
    const res = await fetchPublicConfig();
    if (res?.code === 0) {
      setInitialState((s) => ({ ...s, systemConfig: res.data }));
    }
  };

  if (loading && !data) {
    return (
      <PageContainer title="系统配置">
        <SectionSkeleton variant="form" count={3} />
      </PageContainer>
    );
  }

  if (error) {
    return (
      <PageContainer title="系统配置">
        <ErrorState title="系统配置加载失败" onRetry={run} />
      </PageContainer>
    );
  }

  return (
    <PageContainer title="系统配置">
      <Card>
        <ProForm
          initialValues={data ?? {}}
          onFinish={async (values) => {
            setSaving(true);
            try {
              const res = await updateAdminSystemConfig(values);
              if (res?.code === 0) {
                message.success('已保存，公开前台将读取最新配置');
                await syncPublicConfig();
                return true;
              }
              message.error(res?.message || '保存失败');
              return false;
            } finally {
              setSaving(false);
            }
          }}
          submitter={{
            submitButtonProps: { loading: saving },
          }}
        >
          <ProFormText name="siteName" label="站点名称" rules={[{ required: true }]} />
          <ProFormTextArea name="siteDescription" label="站点描述" />
          <ProFormText name="heroTitle" label="首页 Hero 标题" />
          <ProFormText name="heroSubtitle" label="首页 Hero 副标题" />
        </ProForm>
      </Card>
    </PageContainer>
  );
};

export default System;
