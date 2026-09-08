import {
  ProForm,
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
import { Card, message } from 'antd';
import React from 'react';
import { PageContainer } from '@/components/shared';
import { useRequest } from '@/hooks/useRequest';
import { fetchContentMeta } from '@/services/content';
import { createContent } from '@/services/workspace';

// 文件、ZIP 与外链项目尚无完整的工作区编辑/导入链路，避免创建后没有继续编辑入口。
const supportedCreationTypes = [ContentType.Markdown, ContentType.RichText];
const typeOptions = supportedCreationTypes.map((type) => ({
  label: ContentTypeLabel[type],
  value: type,
}));

const visibilityOptions = Object.values(ContentVisibility).map((v) => ({
  label: ContentVisibilityLabel[v],
  value: v,
}));

function nextEditPath(type: ContentType, id: string): string {
  if (type === ContentType.Markdown) {
    return `/workspace/markdown/${id}`;
  }
  if (type === ContentType.RichText) {
    return `/workspace/richtext/${id}`;
  }
  if (type === ContentType.Booklet) {
    return '/workspace/booklets';
  }
  return '/workspace/content';
}

/** 新建内容向导：选择类型 → 基础信息 → 创建并跳转编辑 */
const ContentNew: React.FC = () => {
  const intl = useIntl();
  const { data: contentMeta } = useRequest(fetchContentMeta);
  const categoryOptions = (contentMeta?.categories ?? []).map((item) => ({
    label: item.name,
    value: item.slug,
  }));

  const handleFinish = async (values: Record<string, unknown>) => {
    const created = await createContent(values);
    message.success('已创建草稿');
    history.push(nextEditPath(values.type as ContentType, created.id));
    return true;
  };

  return (
    <PageContainer title={intl.formatMessage({ id: 'workspace.contentNew.title' })}>
      <Card>
        <ProForm
          onFinish={handleFinish}
          submitter={{ searchConfig: { submitText: '创建并继续' } }}
        >
          <ProFormRadio.Group
            name="type"
            label="内容类型"
            options={typeOptions}
            initialValue={ContentType.Markdown}
            rules={[{ required: true, message: '请选择内容类型' }]}
          />
          <ProFormText
            name="title"
            label="标题"
            placeholder="请输入标题"
            rules={[{ required: true, message: '请输入标题' }]}
          />
          <ProFormSelect
            name="categorySlug"
            label="分类"
            options={categoryOptions}
            extra="创建内容时必须选择一个启用中的分类，后续可在编辑页的基础信息中修改。"
            rules={[{ required: true, message: '请选择分类' }]}
          />
          <ProFormRadio.Group
            name="visibility"
            label="可见性"
            options={visibilityOptions}
            initialValue={ContentVisibility.Private}
          />
          <ProFormTextArea
            name="summary"
            label="摘要"
            placeholder="一句话描述内容"
          />
        </ProForm>
      </Card>
    </PageContainer>
  );
};

export default ContentNew;
