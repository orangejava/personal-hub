import { ProForm, ProFormSelect, ProFormSwitch } from '@ant-design/pro-components';
import type { SiteLayoutConfig } from '@personal-hub/shared-types';
import { Link, useModel } from '@umijs/max';
import { Alert, Card, message } from 'antd';
import React, { useState } from 'react';
import { ErrorState, PageContainer, SectionSkeleton } from '@/components/shared';
import { useRequest } from '@/hooks/useRequest';
import { fetchAdminLayoutConfig, updateAdminLayoutConfig } from '@/services/admin';
import { fetchPublicConfig } from '@/services/system';

/** 内容中心布局：写 site.layout 的卡片/阅读/面包屑字段，不改项目文案。 */
const SystemContent: React.FC = () => {
  const { setInitialState } = useModel('@@initialState');
  const [saving, setSaving] = useState(false);
  const { data, loading, error, run } = useRequest(fetchAdminLayoutConfig);

  const syncPublicConfig = async () => {
    const config = await fetchPublicConfig();
    if (config) {
      setInitialState((s) => ({ ...s, systemConfig: config }));
    }
  };

  const handleFinish = async (values: SiteLayoutConfig) => {
    setSaving(true);
    try {
      await updateAdminLayoutConfig({
        homeHeroStyle: values.homeHeroStyle,
        contentCardStyle: values.contentCardStyle,
        contentReaderWidth: values.contentReaderWidth,
        showBreadcrumb: values.showBreadcrumb,
      });
      message.success('内容中心配置已保存');
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
      <PageContainer title="内容中心配置">
        <SectionSkeleton variant="form" count={3} />
      </PageContainer>
    );
  }

  if (error) {
    return (
      <PageContainer title="内容中心配置">
        <ErrorState title="内容中心配置加载失败" onRetry={run} />
      </PageContainer>
    );
  }

  return (
    <PageContainer
      title="内容中心配置"
      extra={<Link to="/admin/system">返回系统配置</Link>}
    >
      <Alert
        showIcon
        type="info"
        style={{ marginBottom: 16 }}
        title="影响公开内容列表与阅读页"
        description="卡片样式与阅读宽度会立刻作用于公开前台。首页 Hero 排版也在此组，避免再拆一组配置。"
      />
      <Card>
        <ProForm<SiteLayoutConfig>
          initialValues={data}
          onFinish={handleFinish}
          submitter={{
            submitButtonProps: { loading: saving },
          }}
        >
          <ProFormSelect
            name="contentCardStyle"
            label="内容卡片样式"
            options={[
              { label: '封面卡片', value: 'cover' },
              { label: '紧凑列表', value: 'compact' },
            ]}
            rules={[{ required: true }]}
          />
          <ProFormSelect
            name="contentReaderWidth"
            label="阅读页宽度"
            options={[
              { label: '窄', value: 'narrow' },
              { label: '适中', value: 'comfortable' },
              { label: '宽', value: 'wide' },
            ]}
            rules={[{ required: true }]}
          />
          <ProFormSwitch name="showBreadcrumb" label="显示面包屑" />
          <ProFormSelect
            name="homeHeroStyle"
            label="首页 Hero 排版"
            options={[
              { label: '左右分栏', value: 'split' },
              { label: '居中', value: 'center' },
              { label: '极简', value: 'minimal' },
            ]}
            rules={[{ required: true }]}
          />
        </ProForm>
      </Card>
    </PageContainer>
  );
};

export default SystemContent;
