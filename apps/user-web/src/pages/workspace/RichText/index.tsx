import { ContentType } from '@personal-hub/shared-types';
import { history, useParams } from '@umijs/max';
import { Button, Drawer, Form, Input, message, Space } from 'antd';
import React, { useRef, useState } from 'react';
import TextbusEditor, {
  type TextbusEditorHandle,
} from '@/components/workspace/TextbusEditor';
import { PageContainer } from '@/components/shared';
import { createContent, updateContent } from '@/services/workspace';

const defaultBody =
  '<h2>富文本草稿</h2><p>使用 Textbus 编辑，保存后可在公开阅读页预览。</p>';

/** 富文本编辑：Textbus 编辑器 + 草稿/发布 */
const RichText: React.FC = () => {
  const params = useParams<{ id: string }>();
  const isEdit = !!params.id;
  const editorRef = useRef<TextbusEditorHandle>(null);

  const [title, setTitle] = useState(isEdit ? `富文本 ${params.id}` : '');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [form] = Form.useForm();

  const save = async (status: 'draft' | 'published') => {
    const body = editorRef.current?.getHTML() ?? '';
    const values = await form.validateFields().catch(() => ({}));
    const payload = {
      title,
      body,
      type: ContentType.RichText,
      status,
      ...values,
    };
    const id = params.id;
    const created =
      isEdit && id
        ? await updateContent(id, payload)
        : await createContent(payload);
    message.success(status === 'published' ? '已发布' : '已保存草稿');
    if (!isEdit) history.push(`/workspace/richtext/${created.id}`);
  };

  return (
    <PageContainer
      title={isEdit ? '编辑富文本' : '新建富文本'}
      extra={
        <Space>
          <Button onClick={() => setDrawerOpen(true)}>基础信息</Button>
          <Button onClick={() => save('draft')}>保存草稿</Button>
          <Button type="primary" onClick={() => save('published')}>
            发布
          </Button>
        </Space>
      }
    >
      <Input
        size="large"
        placeholder="标题"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        style={{ marginBottom: 16 }}
      />
      <TextbusEditor ref={editorRef} initialHtml={defaultBody} />
      <Drawer
        title="基础信息"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        size={400}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="summary" label="摘要">
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item name="categorySlug" label="分类 slug">
            <Input placeholder="frontend" />
          </Form.Item>
        </Form>
      </Drawer>
    </PageContainer>
  );
};

export default RichText;
