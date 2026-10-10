import { ProForm, ProFormText, ProFormTextArea } from '@ant-design/pro-components';
import { Link, useModel } from '@umijs/max';
import { Alert, Card, Form, Radio, message } from 'antd';
import React, { useEffect, useState } from 'react';
import ImageFileField from '@/components/ImageFileField';
import { ErrorState, PageContainer, SectionSkeleton } from '@/components/shared';
import { useRequest } from '@/hooks/useRequest';
import {
  fetchAdminSiteGeneral,
  updateAdminSystemConfig,
  type AdminSiteGeneralForm,
} from '@/services/admin';
import { fetchPublicConfig } from '@/services/system';
import styles from './index.module.less';

const fieldBlockStyle: React.CSSProperties = { marginBottom: 28 };

/** 已保存文件用公开签名地址预览；刚上传的文件由 ImageFileField 自己用本地 URL。 */
function previewUrlFor(fileId: string | null, url?: string | null): Record<string, string> {
  if (!fileId || !url) return {};
  return { [fileId]: url };
}

function isRequestFailure(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'response' in error;
}

interface BrandAssetFieldProps {
  label: string;
  modeName: 'logoMode' | 'faviconMode';
  textName: 'logoText' | 'faviconText';
  mode: 'text' | 'image';
  textMax: number;
  textHint: string;
  imageHint: string;
  fileId: string | null;
  previewUrls: Record<string, string>;
  onFileChange: (fileId: string | null) => void;
}

/** 文字和图片都留在表单里，切换单选只改展示，不把另一边的内容清掉。 */
function BrandAssetField({
  label,
  modeName,
  textName,
  mode,
  textMax,
  textHint,
  imageHint,
  fileId,
  previewUrls,
  onFileChange,
}: BrandAssetFieldProps) {
  return (
    <div style={fieldBlockStyle}>
      <div style={{ marginBottom: 12, fontWeight: 500 }}>{label}</div>
      <Form.Item name={modeName} style={{ marginBottom: 16 }}>
        <Radio.Group>
          <Radio value="text">文字</Radio>
          <Radio value="image">图片</Radio>
        </Radio.Group>
      </Form.Item>
      <div style={{ display: mode === 'text' ? 'block' : 'none' }}>
        <ProFormText
          name={textName}
          label="显示文字"
          extra={textHint}
          fieldProps={{ maxLength: textMax }}
          rules={[{ max: textMax, message: `最多 ${textMax} 个字` }]}
        />
      </div>
      <div style={{ display: mode === 'image' ? 'block' : 'none', paddingTop: 4 }}>
        <ImageFileField
          maxCount={1}
          previewUrls={previewUrls}
          value={fileId ? [fileId] : []}
          onChange={(fileIds) => onFileChange(fileIds[0] ?? null)}
        />
        <p className={styles.hint}>{imageHint}</p>
      </div>
    </div>
  );
}

/** 站点身份：只写 site.general，不碰首页 Hero。 */
const SystemSite: React.FC = () => {
  const { setInitialState } = useModel('@@initialState');
  const [form] = Form.useForm<AdminSiteGeneralForm>();
  const [saving, setSaving] = useState(false);
  const [logoFileId, setLogoFileId] = useState<string | null>(null);
  const [faviconFileId, setFaviconFileId] = useState<string | null>(null);
  const logoMode = Form.useWatch('logoMode', form);
  const faviconMode = Form.useWatch('faviconMode', form);
  const { data, loading, error, run } = useRequest(fetchAdminSiteGeneral);
  const { data: publicConfig, run: reloadPublicConfig } = useRequest(async () => {
    try {
      return await fetchPublicConfig();
    } catch {
      return undefined;
    }
  });

  useEffect(() => {
    if (!data) return;
    form.setFieldsValue(data);
    setLogoFileId(data.logoFileId);
    setFaviconFileId(data.faviconFileId);
  }, [data, form]);

  const handleReset = () => {
    if (!data) return;
    form.setFieldsValue(data);
    setLogoFileId(data.logoFileId);
    setFaviconFileId(data.faviconFileId);
  };

  const handleFinish = async (values: AdminSiteGeneralForm) => {
    setSaving(true);
    try {
      await updateAdminSystemConfig({
        ...values,
        logoText: values.logoText ?? '',
        faviconText: values.faviconText ?? '',
        logoFileId,
        faviconFileId,
      });
      message.success('已保存，公开前台将读取最新配置');
      await run();
      const config = await reloadPublicConfig();
      if (config) {
        setInitialState((current) => ({ ...current, systemConfig: config }));
      }
      return true;
    } catch (submitError) {
      // 写接口失败已由全局 toast 提示；本地抛出的错误没有 response，需要自己说一声。
      if (!isRequestFailure(submitError)) {
        message.error(submitError instanceof Error ? submitError.message : '保存失败');
      }
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

  const shownLogoMode = logoMode ?? data?.logoMode ?? 'text';
  const shownFaviconMode = faviconMode ?? data?.faviconMode ?? 'text';

  return (
    <PageContainer
      title="站点配置"
      extra={<Link to="/admin/system">返回系统配置</Link>}
    >
      <Alert
        className={styles.form}
        showIcon
        type="info"
        style={{ marginBottom: 16 }}
        title="此处只维护站点身份"
        description="站点名称用作浏览器标题。Logo 与 favicon 可分别选择文字或图片，保存后在公开前台生效。首页 Hero 请到「系统配置 → 首页配置」。"
      />
      <Card>
        <ProForm
          className={styles.form}
          form={form}
          initialValues={data}
          onFinish={handleFinish}
          onReset={handleReset}
          submitter={{
            submitButtonProps: { loading: saving },
            render: (_, dom) => <div className={styles.submitter}>{dom}</div>,
          }}
        >
          <ProFormText
            name="siteName"
            label="站点名称"
            extra="最多 20 个字。用作浏览器标题；文字 Logo 未另填时，页头也显示它。"
            fieldProps={{ maxLength: 20 }}
            rules={[{ required: true, max: 20, message: '站点名称最多 20 个字' }]}
          />
          <ProFormTextArea name="siteDescription" label="站点描述" rules={[{ max: 500 }]} />
          <ProFormText
            name="keywords"
            label="关键词"
            extra="写入 meta keywords，多个词可用逗号分隔"
            rules={[{ max: 500 }]}
          />
          <BrandAssetField
            label="Logo"
            modeName="logoMode"
            textName="logoText"
            mode={shownLogoMode}
            textMax={20}
            textHint="最多 20 个字。留空则使用站点名称。"
            imageHint="JPG、PNG 或 WebP，单张不超过 5 MB。页头按高度 32 像素显示。"
            fileId={logoFileId}
            previewUrls={previewUrlFor(logoFileId, publicConfig?.logo)}
            onFileChange={setLogoFileId}
          />
          <BrandAssetField
            label="Favicon"
            modeName="faviconMode"
            textName="faviconText"
            mode={shownFaviconMode}
            textMax={2}
            textHint="最多 2 个字。留空则使用站点名称的第一个字。"
            imageHint="JPG、PNG 或 WebP，单张不超过 5 MB。建议使用正方形小图。"
            fileId={faviconFileId}
            previewUrls={previewUrlFor(faviconFileId, publicConfig?.faviconUrl)}
            onFileChange={setFaviconFileId}
          />
        </ProForm>
      </Card>
    </PageContainer>
  );
};

export default SystemSite;
