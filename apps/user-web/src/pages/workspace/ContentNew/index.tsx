import {
  ProForm,
  ProFormDependency,
  ProFormRadio,
  ProFormSelect,
  ProFormText,
  ProFormTextArea,
} from '@ant-design/pro-components';
import {
  ContentType,
  ContentTypeLabel,
  ContentVisibility,
  ContentVisibilityLabel,
} from '@personal-hub/shared-types';
import { history, useIntl } from '@umijs/max';
import { App, Card, Upload } from 'antd';
import type { RcFile } from 'antd/es/upload';
import type { UploadFile } from 'antd/es/upload/interface';
import JSZip from 'jszip';
import React, { useState } from 'react';
import { PageContainer } from '@/components/shared';
import { useRequest } from '@/hooks/useRequest';
import { fetchContentMeta } from '@/services/content';
import {
  createBookletImport,
  uploadAppFile,
  waitForBookletImport,
} from '@/services/files';
import { createContent, updateContent } from '@/services/workspace';

const supportedCreationTypes = [
  ContentType.Markdown,
  ContentType.RichText,
  ContentType.Pdf,
  ContentType.Word,
  ContentType.Booklet,
];
const typeOptions = supportedCreationTypes.map((type) => ({
  label: ContentTypeLabel[type],
  value: type,
}));

const visibilityOptions = Object.values(ContentVisibility).map((v) => ({
  label: ContentVisibilityLabel[v],
  value: v,
}));

function isFileType(type: ContentType): boolean {
  return type === ContentType.Pdf || type === ContentType.Word || type === ContentType.Booklet;
}

function nextEditPath(type: ContentType, id: string): string {
  if (type === ContentType.Markdown) {
    return `/workspace/markdown/${id}`;
  }
  if (type === ContentType.RichText) {
    return `/workspace/richtext/${id}`;
  }
  if (type === ContentType.Booklet) {
    return `/content/booklets/${id}/chapters`;
  }
  return `/content/${id}`;
}

function acceptFor(type: ContentType): string {
  if (type === ContentType.Pdf) {
    return '.pdf,application/pdf';
  }
  if (type === ContentType.Word) {
    return '.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  }
  return '.zip,application/zip';
}

function uploadPurpose(type: ContentType): string {
  return type === ContentType.Booklet ? 'TEMPORARY_IMPORT' : 'CONTENT_FILE';
}

/** 去掉最后一个扩展名，用作 PDF/Word 标题初值。 */
function stripFileExtension(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, '');
}

/**
 * 选 ZIP 时预读标题：优先 meta.json，否则用文件名。导入成功后服务端仍以 ZIP 解析结果为准。
 */
async function peekBookletMeta(file: File): Promise<{ title?: string; summary?: string }> {
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const fallback = file.name.replace(/\.zip$/i, '');
  let title: string | undefined;
  let summary: string | undefined;
  for (const [name, entry] of Object.entries(zip.files)) {
    if (entry.dir || name.includes('..') || name.includes('__MACOSX/')) {
      continue;
    }
    const base = name.split('/').pop() ?? name;
    if (base !== 'meta.json') {
      continue;
    }
    try {
      const meta = JSON.parse(await entry.async('string')) as { title?: unknown; summary?: unknown };
      if (typeof meta.title === 'string' && meta.title.trim()) {
        title = meta.title.trim();
      }
      if (typeof meta.summary === 'string' && meta.summary.trim()) {
        summary = meta.summary.trim();
      }
    } catch {
      // meta.json 损坏时仍用文件名
    }
  }
  return { title: title ?? fallback, summary };
}

/** 新建内容向导：Markdown/富文本进编辑器；PDF/Word/小册走上传，不提供站内编辑器。 */
const ContentNew: React.FC = () => {
  const intl = useIntl();
  const { message } = App.useApp();
  const [form] = ProForm.useForm();
  const { data: contentMeta } = useRequest(fetchContentMeta);
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const categoryOptions = (contentMeta?.categories ?? []).map((item) => ({
    label: item.name,
    value: item.slug,
  }));

  const fillTitleFromZip = async (file: File) => {
    try {
      const peeked = await peekBookletMeta(file);
      const current = form.getFieldsValue();
      form.setFieldsValue({
        title: peeked.title,
        summary:
          typeof current.summary === 'string' && current.summary.trim()
            ? current.summary
            : peeked.summary,
      });
    } catch {
      form.setFieldsValue({ title: stripFileExtension(file.name) });
    }
  };

  /** PDF/Word 用文件名反填；用户已手填的标题不能被覆盖。小册仍以 ZIP/meta 为准。 */
  const fillTitleFromDocumentFile = (file: File) => {
    const current = form.getFieldValue('title');
    if (typeof current === 'string' && current.trim()) {
      return;
    }
    form.setFieldsValue({ title: stripFileExtension(file.name) });
  };

  const handleFileSelect = (file: RcFile, type: ContentType) => {
    setFileList([
      {
        uid: file.uid,
        name: file.name,
        status: 'done',
        originFileObj: file,
      },
    ]);
    if (type === ContentType.Booklet) {
      void fillTitleFromZip(file);
    } else if (type === ContentType.Pdf || type === ContentType.Word) {
      fillTitleFromDocumentFile(file);
    }
    return false;
  };

  const handleFinish = async (values: Record<string, unknown>) => {
    const type = values.type as ContentType;
    const selected = fileList[0]?.originFileObj;
    if (isFileType(type) && !(selected instanceof File)) {
      message.error(type === ContentType.Booklet ? '请上传小册 ZIP' : '请上传主文件');
      return false;
    }
    if (type === ContentType.Booklet && selected instanceof File) {
      const hide = message.loading(
        '正在上传并排队导入。可留在本页等待，也可稍后到「上传任务」查看进度',
        0,
      );
      let done: Awaited<ReturnType<typeof waitForBookletImport>> | undefined;
      try {
        const uploaded = await uploadAppFile(selected, uploadPurpose(type));
        const job = await createBookletImport(uploaded.id);
        try {
          done = await waitForBookletImport(job.id);
        } catch (error) {
          // 轮询 GET 是 200，失败写在 job.status；全局 errorHandler 不会弹 toast。
          message.error(error instanceof Error ? error.message : '小册导入失败');
          return false;
        }
        if (done.contentId) {
          try {
            await updateContent(done.contentId, {
              categorySlug: values.categorySlug,
              ...(typeof values.summary === 'string' && values.summary.trim()
                ? { summary: values.summary }
                : {}),
            });
          } catch {
            // 分类写入失败时全局已 toast；草稿仍在，可到文档管理用「编辑信息」补全。
          }
        }
      } finally {
        hide();
      }
      if (!done) {
        return false;
      }
      message.success('小册已导入为私有草稿');
      if (done.contentId) {
        history.push(`/content/${done.contentId}`);
      } else {
        history.push('/workspace/booklets');
      }
      return true;
    }
    let primaryFileId: string | undefined;
    if (selected instanceof File && (type === ContentType.Pdf || type === ContentType.Word)) {
      const uploaded = await uploadAppFile(selected, uploadPurpose(type));
      primaryFileId = uploaded.id;
    }
    const created = await createContent({ ...values, primaryFileId });
    message.success('已创建草稿');
    history.push(nextEditPath(type, created.id));
    return true;
  };

  return (
    <PageContainer title={intl.formatMessage({ id: 'workspace.contentNew.title' })}>
      <Card>
        <ProForm
          form={form}
          onFinish={handleFinish}
          submitter={{ searchConfig: { submitText: '创建并继续' } }}
        >
          <ProFormRadio.Group
            name="type"
            label="内容类型"
            options={typeOptions}
            initialValue={ContentType.Markdown}
            rules={[{ required: true, message: '请选择内容类型' }]}
            fieldProps={{
              onChange: () => setFileList([]),
            }}
          />
          <ProFormDependency name={['type']}>
            {({ type }) => (
              <ProFormText
                name="title"
                label="标题"
                placeholder={type === ContentType.Booklet ? '可留空，选 ZIP 后自动填入' : '请输入标题'}
                extra={
                  type === ContentType.Booklet
                    ? '小册标题以 ZIP 为准（meta.json 或文件名）。这里选文件后会反填，导入时不会用表单覆盖 ZIP 标题。'
                    : undefined
                }
                rules={
                  type === ContentType.Booklet
                    ? []
                    : [{ required: true, message: '请输入标题' }]
                }
              />
            )}
          </ProFormDependency>
          <ProFormSelect
            name="categorySlug"
            label="分类"
            options={categoryOptions}
            extra="发布前必须有启用中的分类。小册导入成功后会写入草稿。"
            rules={[{ required: true, message: '请选择分类' }]}
          />
          <ProFormRadio.Group
            name="visibility"
            label="可见性"
            options={visibilityOptions}
            initialValue={ContentVisibility.Private}
            extra="ZIP 导入的小册会强制为私有草稿。编辑者发布进入审核；公开或登录可见须管理员在「内容审核」通过。"
          />
          <ProFormTextArea
            name="summary"
            label="摘要"
            placeholder="一句话描述内容"
          />
          <ProFormDependency name={['type']}>
            {({ type }) =>
              isFileType(type as ContentType) ? (
                <ProForm.Item
                  label={type === ContentType.Booklet ? '小册 ZIP' : '主文件'}
                  required
                  extra={
                    type === ContentType.Booklet
                      ? 'ZIP 内放 Markdown 章节与可选 meta.json。选文件后会反填标题；导入后不会出现站内编辑器。'
                      : '一期只支持上传、预览和下载，不提供 PDF / Word 站内编辑。选文件后会用文件名反填标题；已填写的标题不会被覆盖。'
                  }
                >
                  <Upload.Dragger
                    maxCount={1}
                    fileList={fileList}
                    accept={acceptFor(type as ContentType)}
                    beforeUpload={(file) => handleFileSelect(file, type as ContentType)}
                    onRemove={() => setFileList([])}
                  >
                    <p>点击或拖拽上传（不会发到编辑器，只走对象存储）</p>
                  </Upload.Dragger>
                </ProForm.Item>
              ) : null
            }
          </ProFormDependency>
        </ProForm>
      </Card>
    </PageContainer>
  );
};

export default ContentNew;
