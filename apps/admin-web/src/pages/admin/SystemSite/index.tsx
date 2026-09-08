import { ProForm, ProFormText, ProFormTextArea } from '@ant-design/pro-components';
import { Link, useModel } from '@umijs/max';
import { Alert, Card, message } from 'antd';
import React, { useState } from 'react';
import { ErrorState, PageContainer, SectionSkeleton } from '@/components/shared';
import { useRequest } from '@/hooks/useRequest';
import { fetchAdminSystemConfig, updateAdminSystemConfig } from '@/services/admin';
import { fetchPublicConfig } from '@/services/system';

/** 站点身份：只写 site.general，不碰首页 Hero。 */
const SystemSite: React.FC = () => {
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

  const handleFinish = async (values: { siteName?: string; siteDescription?: string }) => {
    setSaving(true);
    try {
      await updateAdminSystemConfig(values);
      message.success('已保存，公开前台将读取最新配置');
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
      <PageContainer title="站点配置">
        <SectionSkeleton variant="form" count={3} />
      </PageContainer>
    );
  }

  if (error) {
    return (
      <PageContainer title="站点配置">
        <ErrorState title="站点配置加载失败" onRetry={run} />
      </PageContainer>
    );
  }

  return (
    <PageContainer
      title="站点配置"
      extra={<Link to="/admin/system">返回系统配置</Link>}
    >
      <Alert
        showIcon
        type="info"
        style={{ marginBottom: 16 }}
        title="此处只维护站点身份"
        description="站点名称和描述会用于浏览器标题与公开前台。首页 Hero、模块、精选内容请到「系统配置 → 首页配置」。"
      />
      <Card>
        <ProForm
          initialValues={formValues ?? {}}
          onFinish={handleFinish}
          submitter={{
            submitButtonProps: { loading: saving },
          }}
        >
          <ProFormText name="siteName" label="站点名称" rules={[{ required: true }]} />
          <ProFormTextArea name="siteDescription" label="站点描述" />
        </ProForm>
      </Card>
    </PageContainer>
  );
};

export default SystemSite;
