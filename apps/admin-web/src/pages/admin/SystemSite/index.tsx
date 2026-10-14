import {
  ProForm,
  ProFormDigit,
  ProFormText,
  ProFormTextArea,
} from '@ant-design/pro-components';
import { Link, useModel } from '@umijs/max';
import {
  Alert,
  Button,
  Card,
  Form,
  message,
  Radio,
  Switch,
  Upload,
} from 'antd';
import React, { useEffect, useState } from 'react';
import ImageFileField from '@/components/ImageFileField';
import {
  ErrorState,
  PageContainer,
  SectionSkeleton,
} from '@/components/shared';
import { useRequest } from '@/hooks/useRequest';
import {
  type AdminSiteGeneralForm,
  fetchAdminSiteGeneral,
  updateAdminSystemConfig,
} from '@/services/admin';
import { uploadLoadingVideo } from '@/services/files';
import { fetchPublicConfig } from '@/services/system';
import styles from './index.module.less';

const fieldBlockStyle: React.CSSProperties = { marginBottom: 28 };

/** 已保存文件用公开签名地址预览；刚上传的文件由 ImageFileField 自己用本地 URL。 */
function previewUrlFor(
  fileId: string | null,
  url?: string | null,
): Record<string, string> {
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
      <div className={styles.sectionTitle}>{label}</div>
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
      <div
        style={{ display: mode === 'image' ? 'block' : 'none', paddingTop: 4 }}
      >
        <ImageFileField
          allowGif
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
  const [loadingFileId, setLoadingFileId] = useState<string | null>(null);
  const [loadingVideoFileId, setLoadingVideoFileId] = useState<string | null>(
    null,
  );
  const [videoUploading, setVideoUploading] = useState(false);
  const logoMode = Form.useWatch('logoMode', form);
  const faviconMode = Form.useWatch('faviconMode', form);
  const loadingStyle = Form.useWatch('loadingStyle', form);
  const loadingSizeMode = Form.useWatch('loadingSizeMode', form);
  const loadingMaxWidth = Form.useWatch('loadingMaxWidth', form);
  const loadingMaxHeight = Form.useWatch('loadingMaxHeight', form);
  const { data, loading, error, run } = useRequest(fetchAdminSiteGeneral);
  const { data: publicConfig, run: reloadPublicConfig } = useRequest(
    async () => {
      try {
        return await fetchPublicConfig();
      } catch {
        return undefined;
      }
    },
  );

  useEffect(() => {
    if (!data) return;
    form.setFieldsValue(data);
    setLogoFileId(data.logoFileId);
    setFaviconFileId(data.faviconFileId);
    setLoadingFileId(data.loadingFileId);
    setLoadingVideoFileId(data.loadingVideoFileId);
  }, [data, form]);

  const handleReset = () => {
    if (!data) return;
    form.setFieldsValue(data);
    setLogoFileId(data.logoFileId);
    setFaviconFileId(data.faviconFileId);
    setLoadingFileId(data.loadingFileId);
    setLoadingVideoFileId(data.loadingVideoFileId);
  };

  const clampCustomSide = (
    sideName: 'loadingWidth' | 'loadingHeight',
    limit: number | null,
  ) => {
    if (typeof limit !== 'number') return;
    const current = form.getFieldValue(sideName);
    if (typeof current === 'number' && current > limit) {
      form.setFieldValue(sideName, limit);
    }
  };

  const handleVideoUpload = async (file: File) => {
    setVideoUploading(true);
    try {
      const uploaded = await uploadLoadingVideo(file);
      setLoadingVideoFileId(uploaded.id);
      message.success('视频已上传，保存配置后将在公开页生效');
    } catch (uploadError) {
      message.error(
        uploadError instanceof Error ? uploadError.message : '视频上传失败',
      );
    } finally {
      setVideoUploading(false);
    }
  };

  const handleFinish = async (values: AdminSiteGeneralForm) => {
    setSaving(true);
    try {
      await updateAdminSystemConfig({
        ...values,
        logoText: values.logoText ?? '',
        faviconText: values.faviconText ?? '',
        loadingTitle: values.loadingTitle ?? '',
        loadingSubtitle: values.loadingSubtitle ?? '',
        loadingSvg: values.loadingSvg ?? '',
        logoFileId,
        faviconFileId,
        loadingFileId,
        loadingVideoFileId,
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
        message.error(
          submitError instanceof Error ? submitError.message : '保存失败',
        );
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
          <div className={styles.sectionTitle}>站点信息</div>
          <ProFormText
            name="siteName"
            label="站点名称"
            extra="最多 20 个字。用作浏览器标题；文字 Logo 未另填时，页头也显示它。"
            fieldProps={{ maxLength: 20 }}
            rules={[
              { required: true, max: 20, message: '站点名称最多 20 个字' },
            ]}
          />
          <ProFormTextArea
            name="siteDescription"
            label="站点描述"
            rules={[{ max: 500 }]}
          />
          <ProFormText
            name="keywords"
            label="关键词"
            extra="写入 meta keywords，多个词可用逗号分隔"
            rules={[{ max: 500 }]}
          />
          <div style={fieldBlockStyle}>
            <div className={styles.sectionTitle}>首页加载</div>
            <Form.Item
              name="loadingStyle"
              label="加载样式"
              style={{ marginBottom: 16 }}
            >
              <Radio.Group>
                <Radio value="spinner">圆点转圈</Radio>
                <Radio value="square">方块转圈</Radio>
                <Radio value="image">图片</Radio>
                <Radio value="svg">SVG</Radio>
                <Radio value="video">视频</Radio>
              </Radio.Group>
            </Form.Item>
            <div
              style={{ display: loadingStyle === 'image' ? 'block' : 'none' }}
            >
              <ImageFileField
                allowGif
                maxCount={1}
                previewUrls={previewUrlFor(
                  loadingFileId,
                  publicConfig?.loadingImageUrl,
                )}
                value={loadingFileId ? [loadingFileId] : []}
                onChange={(fileIds) => setLoadingFileId(fileIds[0] ?? null)}
              />
              <p className={styles.hint}>
                JPG、PNG、WebP 或 GIF，单张不超过 5 MB。SVG 请改用 SVG
                选项粘贴标记。
              </p>
            </div>
            <div style={{ display: loadingStyle === 'svg' ? 'block' : 'none' }}>
              <ProFormTextArea
                name="loadingSvg"
                label="SVG 标记"
                extra="粘贴以 <svg 开头的标记。带脚本或事件的内容保存后会被丢掉。"
                fieldProps={{ maxLength: 8000, rows: 6 }}
                rules={[{ max: 8000, message: '最多 8000 个字符' }]}
              />
            </div>
            <div
              style={{
                display: loadingStyle === 'video' ? 'block' : 'none',
                paddingTop: 4,
              }}
            >
              {loadingVideoFileId ? (
                <div style={{ marginBottom: 8 }}>
                  {publicConfig?.loadingVideoUrl ? (
                    <video
                      muted
                      playsInline
                      src={publicConfig.loadingVideoUrl}
                      style={{ width: 160, maxHeight: 120 }}
                    />
                  ) : (
                    <p className={styles.hint}>视频已选择，保存后可预览。</p>
                  )}
                  <Button
                    size="small"
                    danger
                    onClick={() => setLoadingVideoFileId(null)}
                  >
                    移除视频
                  </Button>
                </div>
              ) : null}
              <Upload
                accept="video/mp4"
                maxCount={1}
                showUploadList={false}
                disabled={videoUploading}
                customRequest={({ file, onError, onSuccess }) => {
                  if (!(file instanceof File)) {
                    onError?.(new Error('浏览器未提供可上传的视频文件'));
                    return;
                  }
                  handleVideoUpload(file)
                    .then(() => onSuccess?.({}))
                    .catch((uploadError) =>
                      onError?.(
                        uploadError instanceof Error
                          ? uploadError
                          : new Error('视频上传失败'),
                      ),
                    );
                }}
              >
                <Button loading={videoUploading}>上传 MP4</Button>
              </Upload>
              <p className={styles.hint}>
                仅 MP4，不超过 10 MB。静音循环播放。
              </p>
            </div>
            <div
              style={{
                display:
                  loadingStyle === 'image' ||
                  loadingStyle === 'svg' ||
                  loadingStyle === 'video'
                    ? 'block'
                    : 'none',
              }}
            >
              <Form.Item
                name="loadingMotion"
                label="动效"
                style={{ marginBottom: 12 }}
              >
                <Radio.Group>
                  <Radio value="none">不动</Radio>
                  <Radio value="spin">旋转</Radio>
                  <Radio value="pulse">缩放</Radio>
                  <Radio value="float">上下浮动</Radio>
                </Radio.Group>
              </Form.Item>
              <Form.Item
                name="loadingSizeMode"
                label="尺寸"
                style={{ marginBottom: 12 }}
              >
                <Radio.Group>
                  <Radio value="default">默认宽高</Radio>
                  <Radio value="custom">自定义宽高</Radio>
                </Radio.Group>
              </Form.Item>
              <ProFormDigit
                name="loadingMaxWidth"
                label="限制宽度"
                extra="48 到 480 像素。默认宽高和自定义宽度都不能超过它。"
                min={48}
                max={480}
                fieldProps={{
                  precision: 0,
                  onChange: (value) =>
                    clampCustomSide(
                      'loadingWidth',
                      typeof value === 'number' ? value : null,
                    ),
                }}
              />
              <ProFormDigit
                name="loadingMaxHeight"
                label="限制高度"
                extra="48 到 480 像素。默认宽高和自定义高度都不能超过它。"
                min={48}
                max={480}
                fieldProps={{
                  precision: 0,
                  onChange: (value) =>
                    clampCustomSide(
                      'loadingHeight',
                      typeof value === 'number' ? value : null,
                    ),
                }}
              />
              <div
                style={{
                  display: loadingSizeMode === 'custom' ? 'block' : 'none',
                }}
              >
                <ProFormDigit
                  name="loadingWidth"
                  label="宽度"
                  extra={`不能超过限制宽度 ${typeof loadingMaxWidth === 'number' ? loadingMaxWidth : 320} 像素。`}
                  min={48}
                  max={
                    typeof loadingMaxWidth === 'number' ? loadingMaxWidth : 320
                  }
                  fieldProps={{ precision: 0 }}
                />
                <ProFormDigit
                  name="loadingHeight"
                  label="高度"
                  extra={`不能超过限制高度 ${typeof loadingMaxHeight === 'number' ? loadingMaxHeight : 320} 像素。可以和宽度不同。`}
                  min={48}
                  max={
                    typeof loadingMaxHeight === 'number'
                      ? loadingMaxHeight
                      : 320
                  }
                  fieldProps={{ precision: 0 }}
                />
              </div>
            </div>
            <ProFormText
              name="loadingTitle"
              label="标题"
              extra="最多 40 个字。留空则保存后仍显示默认标题。"
              fieldProps={{ maxLength: 40 }}
              rules={[{ max: 40, message: '最多 40 个字' }]}
            />
            <ProFormText
              name="loadingSubtitle"
              label="副文案"
              extra="最多 80 个字。"
              fieldProps={{ maxLength: 80 }}
              rules={[{ max: 80, message: '最多 80 个字' }]}
            />
            <Form.Item
              name="loadingShowSkeleton"
              label="骨架条"
              valuePropName="checked"
              extra="标题下面的三道灰色条。关掉后只保留图形、文字和底部进度。"
            >
              <Switch checkedChildren="显示" unCheckedChildren="隐藏" />
            </Form.Item>
            <Form.Item
              name="loadingShowElapsed"
              label="加载用时"
              valuePropName="checked"
              extra="显示时写在百分比后面，例如 42% - 3.2s。关掉后只保留百分比。"
            >
              <Switch checkedChildren="显示" unCheckedChildren="隐藏" />
            </Form.Item>
          </div>
          <BrandAssetField
            label="Logo"
            modeName="logoMode"
            textName="logoText"
            mode={shownLogoMode}
            textMax={20}
            textHint="最多 20 个字。留空则使用站点名称。"
            imageHint="JPG、PNG、WebP 或 GIF，单张不超过 5 MB。页头按高度 32 像素显示。"
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
            imageHint="JPG、PNG、WebP 或 GIF，单张不超过 5 MB。建议使用正方形小图。"
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
