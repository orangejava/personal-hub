import { ProForm, ProFormText, ProFormTextArea } from '@ant-design/pro-components';
import type { SiteAboutConfig } from '@personal-hub/shared-types';
import { Link, useModel } from '@umijs/max';
import { Alert, Card, message } from 'antd';
import React, { useState } from 'react';
import { ErrorState, PageContainer, SectionSkeleton } from '@/components/shared';
import { useRequest } from '@/hooks/useRequest';
import { fetchAdminAboutConfig, updateAdminAboutConfig } from '@/services/admin';
import { fetchPublicConfig } from '@/services/system';

/** 关于我：写 site.about，公开 /about 读取同一组。 */
const SystemAbout: React.FC = () => {
  const { setInitialState } = useModel('@@initialState');
  const [saving, setSaving] = useState(false);
  const { data, loading, error, run } = useRequest(fetchAdminAboutConfig);

  const syncPublicConfig = async () => {
    const config = await fetchPublicConfig();
    if (config) {
      setInitialState((s) => ({ ...s, systemConfig: config }));
    }
  };

  const handleFinish = async (values: SiteAboutConfig) => {
    setSaving(true);
    try {
      await updateAdminAboutConfig({
        title: values.title ?? '关于我',
        markdown: values.markdown ?? '',
      });
      message.success('关于我配置已保存');
      await syncPublicConfig();
      return true;
    } catch {
      return false;
    } finally {
      setSaving(false);
    }
  };

  if (loading && !data) {
    return (
      <PageContainer title="关于我配置">
        <SectionSkeleton variant="form" count={3} />
      </PageContainer>
    );
  }

  if (error) {
    return (
      <PageContainer title="关于我配置">
        <ErrorState title="关于我配置加载失败" onRetry={run} />
      </PageContainer>
    );
  }

  return (
    <PageContainer
      title="关于我配置"
      extra={<Link to="/admin/system">返回系统配置</Link>}
    >
      <Alert
        showIcon
        type="info"
        style={{ marginBottom: 16 }}
        title="对应公开前台 /about"
        description="标题用于页面识别；正文为 Markdown，保存后刷新公开关于我页可见。"
      />
      <Card>
        <ProForm<SiteAboutConfig>
          initialValues={data}
          onFinish={handleFinish}
          submitter={{
            submitButtonProps: { loading: saving },
          }}
        >
          <ProFormText name="title" label="标题" rules={[{ required: true, max: 120 }]} />
          <ProFormTextArea
            name="markdown"
            label="正文 Markdown"
            fieldProps={{ rows: 16 }}
            rules={[{ max: 20000 }]}
          />
        </ProForm>
      </Card>
    </PageContainer>
  );
};

export default SystemAbout;
