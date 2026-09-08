import { ProForm, ProFormText, ProFormTextArea } from '@ant-design/pro-components';
import type { SiteLayoutConfig } from '@personal-hub/shared-types';
import { Link, useModel } from '@umijs/max';
import { Alert, Card, message } from 'antd';
import React, { useState } from 'react';
import { ErrorState, PageContainer, SectionSkeleton } from '@/components/shared';
import { useRequest } from '@/hooks/useRequest';
import { fetchAdminLayoutConfig, updateAdminLayoutConfig } from '@/services/admin';
import { fetchPublicConfig } from '@/services/system';

/** 项目页文案：写在 site.layout，列表数据仍来自内容类型 Project。 */
const SystemProjects: React.FC = () => {
  const { setInitialState } = useModel('@@initialState');
  const [saving, setSaving] = useState(false);
  const { data, loading, error, run } = useRequest(fetchAdminLayoutConfig);

  const syncPublicConfig = async () => {
    const config = await fetchPublicConfig();
    if (config) {
      setInitialState((s) => ({ ...s, systemConfig: config }));
    }
  };

  const handleFinish = async (values: Pick<SiteLayoutConfig, 'projectsTitle' | 'projectsIntro'>) => {
    setSaving(true);
    try {
      await updateAdminLayoutConfig({
        projectsTitle: values.projectsTitle ?? '项目',
        projectsIntro: values.projectsIntro ?? '',
      });
      message.success('项目配置已保存');
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
      <PageContainer title="项目配置">
        <SectionSkeleton variant="form" count={3} />
      </PageContainer>
    );
  }

  if (error) {
    return (
      <PageContainer title="项目配置">
        <ErrorState title="项目配置加载失败" onRetry={run} />
      </PageContainer>
    );
  }

  return (
    <PageContainer
      title="项目配置"
      extra={<Link to="/admin/system">返回系统配置</Link>}
    >
      <Alert
        showIcon
        type="info"
        style={{ marginBottom: 16 }}
        title="只改项目页文案"
        description="下方列表仍由内容类型「项目」驱动，不在此页挑选条目。"
      />
      <Card>
        <ProForm
          initialValues={{
            projectsTitle: data?.projectsTitle ?? '项目',
            projectsIntro: data?.projectsIntro ?? '',
          }}
          onFinish={handleFinish}
          submitter={{
            submitButtonProps: { loading: saving },
          }}
        >
          <ProFormText name="projectsTitle" label="页面标题" rules={[{ required: true, max: 80 }]} />
          <ProFormTextArea
            name="projectsIntro"
            label="简介"
            fieldProps={{ rows: 4 }}
            rules={[{ max: 20000 }]}
          />
        </ProForm>
      </Card>
    </PageContainer>
  );
};

export default SystemProjects;
