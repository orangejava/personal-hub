import {
  ProForm,
  ProFormRadio,
  ProFormSelect,
  ProFormText,
  ProFormTextArea,
} from '@ant-design/pro-components';
import { ContentType, ContentTypeLabel } from '@personal-hub/shared-types';
import { history, useIntl } from '@umijs/max';
import { Card, message } from 'antd';
import React from 'react';
import { PageContainer } from '@/components/shared';
import { createContent } from '@/services/workspace';

const typeOptions = Object.values(ContentType).map((t) => ({
  label: ContentTypeLabel[t],
  value: t,
}));

/** 新建内容向导：选择类型 → 基础信息 → 创建并跳转编辑/阅读 */
const ContentNew: React.FC = () => {
  const intl = useIntl();
  return (
    <PageContainer title={intl.formatMessage({ id: 'workspace.contentNew.title' })}>
      <Card>
        <ProForm
          onFinish={async (values) => {
            const created = await createContent(values);
            message.success('已创建草稿');
            const id = created.id;
            if (values.type === ContentType.Markdown) {
              history.push(`/workspace/markdown/${id}`);
            } else if (values.type === ContentType.RichText) {
              history.push(`/workspace/richtext/${id}`);
            } else if (values.type === ContentType.Booklet) {
              history.push('/workspace/booklets');
            } else {
              history.push(`/content/${id}`);
            }
            return true;
          }}
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
            options={[
              { label: '前端', value: 'frontend' },
              { label: '后端', value: 'backend' },
              { label: '工程', value: 'engineering' },
              { label: 'AI', value: 'ai' },
            ]}
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
