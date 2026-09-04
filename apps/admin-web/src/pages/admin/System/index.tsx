import { ProForm, ProFormText, ProFormTextArea } from '@ant-design/pro-components';
import { useRequest } from '@/hooks/useRequest';
import { useModel } from '@umijs/max';
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
  const formValues = data;

  const syncPublicConfig = async () => {
    const config = await fetchPublicConfig();
    if (config) {
      setInitialState((s) => ({ ...s, systemConfig: config }));
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
          initialValues={formValues ?? {}}
          onFinish={async (values) => {
            setSaving(true);
            try {
              await updateAdminSystemConfig(values);
              message.success('已保存，公开前台将读取最新配置');
              await syncPublicConfig();
              return true;
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
