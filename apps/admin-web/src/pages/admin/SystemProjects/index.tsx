import { ProForm, ProFormText, ProFormTextArea } from '@ant-design/pro-components';
import type {
  AdminSiteLayoutConfig,
  ProjectShowcaseKey,
  SystemPublicConfig,
} from '@personal-hub/shared-types';
import { Link, useModel } from '@umijs/max';
import { Alert, Card, message } from 'antd';
import React, { useEffect, useMemo, useState } from 'react';
import ImageFileField from '@/components/ImageFileField';
import { ErrorState, PageContainer, SectionSkeleton } from '@/components/shared';
import { useRequest } from '@/hooks/useRequest';
import { fetchAdminLayoutConfig, updateAdminLayoutConfig } from '@/services/admin';
import { fetchPublicConfig } from '@/services/system';

const PROJECT_LABELS: Record<ProjectShowcaseKey, string> = {
  'user-web': '用户端 Web',
  'admin-web': '管理端 Web',
  server: 'Nest 服务端',
  flutter: 'Flutter App',
  desktop: '桌面端',
};

function buildPreviewUrls(
  layout: AdminSiteLayoutConfig | undefined,
  publicConfig: SystemPublicConfig | undefined,
) {
  const publicAssets = new Map(
    (publicConfig?.projectVisualAssets ?? []).map((asset) => [asset.key, asset]),
  );
  return new Map(
    (layout?.projectVisualAssets ?? []).map((asset) => {
      const publicAsset = publicAssets.get(asset.key);
      const screenshotUrls = Object.fromEntries(
        asset.screenshotFileIds.map((fileId, index) => [
          fileId,
          publicAsset?.screenshotUrls[index] ?? '',
        ]),
      );
      return [
        asset.key,
        {
          ...(asset.coverFileId && publicAsset?.coverUrl
            ? { [asset.coverFileId]: publicAsset.coverUrl }
            : {}),
          ...screenshotUrls,
        },
      ] as const;
    }),
  );
}

/** 项目页文案和五个端的公开图片：写在 site.layout，列表数据仍来自内容类型 Project。 */
const SystemProjects: React.FC = () => {
  const { setInitialState } = useModel('@@initialState');
  const [saving, setSaving] = useState(false);
  const [projectVisualAssets, setProjectVisualAssets] = useState<
    AdminSiteLayoutConfig['projectVisualAssets']
  >([]);
  const { data, loading, error, run } = useRequest(fetchAdminLayoutConfig);
  const { data: publicConfig } = useRequest(fetchPublicConfig);
  const previewUrlsByKey = useMemo(
    () => buildPreviewUrls(data, publicConfig),
    [data, publicConfig],
  );

  useEffect(() => {
    if (data) {
      setProjectVisualAssets(data.projectVisualAssets);
    }
  }, [data]);

  const syncPublicConfig = async () => {
    const config = await fetchPublicConfig();
    if (config) {
      setInitialState((s) => ({ ...s, systemConfig: config }));
    }
  };

  const handleFinish = async (
    values: Pick<AdminSiteLayoutConfig, 'projectsTitle' | 'projectsIntro'>,
  ) => {
    setSaving(true);
    try {
      await updateAdminLayoutConfig({
        projectsTitle: values.projectsTitle ?? '项目',
        projectsIntro: values.projectsIntro ?? '',
        projectVisualAssets,
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

  const handleAssetChange = (
    key: ProjectShowcaseKey,
    field: 'coverFileId' | 'screenshotFileIds',
    fileIds: string[],
  ) => {
    setProjectVisualAssets((current) =>
      current.map((asset) =>
        asset.key === key
          ? {
              ...asset,
              ...(field === 'coverFileId'
                ? { coverFileId: fileIds[0] ?? null }
                : { screenshotFileIds: fileIds }),
            }
          : asset,
      ),
    );
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
        title="维护项目页文案和展示图片"
        description="项目名称、技术栈和状态仍由前端作品矩阵定义；此页只维护公开展示的封面和截图。下方列表仍由内容类型「项目」驱动。"
      />
      <Card>
        <ProForm<Pick<AdminSiteLayoutConfig, 'projectsTitle' | 'projectsIntro'>>
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
          {projectVisualAssets.map((asset) => {
            const previewUrls = previewUrlsByKey.get(asset.key);
            return (
              <Card
                key={asset.key}
                size="small"
                style={{ marginBottom: 16 }}
                title={PROJECT_LABELS[asset.key]}
              >
                <div style={{ marginBottom: 12 }}>封面图（最多 1 张）</div>
                <ImageFileField
                  maxCount={1}
                  previewUrls={previewUrls}
                  value={asset.coverFileId ? [asset.coverFileId] : []}
                  onChange={(fileIds) =>
                    handleAssetChange(asset.key, 'coverFileId', fileIds)
                  }
                />
                <div style={{ margin: '16px 0 12px' }}>截图（最多 6 张）</div>
                <ImageFileField
                  maxCount={6}
                  previewUrls={previewUrls}
                  value={asset.screenshotFileIds}
                  onChange={(fileIds) =>
                    handleAssetChange(asset.key, 'screenshotFileIds', fileIds)
                  }
                />
              </Card>
            );
          })}
        </ProForm>
      </Card>
    </PageContainer>
  );
};

export default SystemProjects;
