import { ProForm, ProFormDigit, ProFormSelect, ProFormText } from '@ant-design/pro-components';
import { useRequest } from '@/hooks/useRequest';

import { Card, message } from 'antd';
import React, { useState } from 'react';
import { ErrorState, PageContainer, SectionSkeleton } from '@/components/shared';
import { fetchAdminSystemConfig, updateAdminSystemTheme } from '@/services/admin';

/** 主题配置：与工作区 SettingDrawer 字段对齐说明 */
const SystemTheme: React.FC = () => {
  const [saving, setSaving] = useState(false);
  const { data, loading, error, run } = useRequest(fetchAdminSystemConfig);
  const theme = data?.theme;

  if (loading && !data) {
    return (
      <PageContainer title="主题配置">
        <SectionSkeleton variant="form" count={2} />
      </PageContainer>
    );
  }

  if (error) {
    return (
      <PageContainer title="主题配置">
        <ErrorState title="主题配置加载失败" onRetry={run} />
      </PageContainer>
    );
  }

  return (
    <PageContainer title="主题配置">
      <Card>
        <ProForm
          initialValues={theme ?? {}}
          onFinish={async (values) => {
            setSaving(true);
            try {
              await updateAdminSystemTheme(values);
              message.success('主题配置已保存（公开区需刷新后生效）');
              return true;
            } catch {
              return false;
            } finally {
              setSaving(false);
            }
          }}
          submitter={{
            submitButtonProps: { loading: saving },
          }}
        >
          <ProFormText name="colorPrimary" label="主色" rules={[{ required: true }]} />
          <ProFormDigit name="borderRadius" label="圆角" min={0} max={24} />
          <ProFormSelect
            name="mode"
            label="默认模式"
            options={[
              { label: '亮色', value: 'light' },
              { label: '暗色', value: 'dark' },
              { label: '跟随系统', value: 'auto' },
            ]}
          />
        </ProForm>
      </Card>
    </PageContainer>
  );
};

export default SystemTheme;
