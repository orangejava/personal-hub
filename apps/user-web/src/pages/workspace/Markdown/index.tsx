import MDEditor from '@uiw/react-md-editor';
import { history, useIntl, useParams } from '@umijs/max';
import { Button, Drawer, Form, Input, message, Space } from 'antd';
import React, { useEffect, useState } from 'react';
import { PageContainer } from '@/components/shared';
import { createContent, updateContent } from '@/services/workspace';

/** Markdown 编辑：左右分栏 + 标题 + 基础信息抽屉 + 保存草稿/发布（mock） */
const Markdown: React.FC = () => {
  const intl = useIntl();
  const params = useParams<{ id: string }>();
  const isEdit = !!params.id;

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [dirty, setDirty] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [form] = Form.useForm();

  // 编辑模式：拉取已有内容填充（mock 阶段直接用示例）
  useEffect(() => {
    if (isEdit) {
      setTitle(`编辑内容 ${params.id}`);
      setBody(`# 示例正文\n\n这是 ${params.id} 的草稿正文，可继续编辑。`);
    }
  }, [isEdit, params.id]);

  const markDirty = () => setDirty(true);

  /** 离开未保存提醒：通过浏览器原生 beforeunload */
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  const save = async (status: 'draft' | 'published') => {
    try {
      const values = await form.validateFields().catch(() => ({}));
      const payload = { title, body, status, ...values };
      const id = params.id;
      const created =
        isEdit && id
          ? await updateContent(id, payload)
          : await createContent(payload);
      message.success(status === 'published' ? '已发布' : '已保存草稿');
      setDirty(false);
      if (!isEdit) history.push(`/workspace/markdown/${created.id}`);
    } catch {
      message.error('保存失败');
    }
  };

  return (
    <PageContainer
      title={intl.formatMessage({
        id: isEdit ? 'workspace.markdown.editTitle' : 'workspace.markdown.newTitle',
      })}
      extra={
        <Space>
          <Button onClick={() => setDrawerOpen(true)}>
            {intl.formatMessage({ id: 'workspace.markdown.basicInfo' })}
          </Button>
          <Button onClick={() => save('draft')}>
            {intl.formatMessage({ id: 'workspace.markdown.saveDraft' })}
          </Button>
          <Button type="primary" onClick={() => save('published')}>
            {intl.formatMessage({ id: 'workspace.markdown.publish' })}
          </Button>
        </Space>
      }
    >
      <Input
        size="large"
        placeholder="请输入标题"
        value={title}
        onChange={(e) => {
          setTitle(e.target.value);
          markDirty();
        }}
        style={{ marginBottom: 16 }}
      />
      <div data-color-mode="light">
        <MDEditor
          value={body}
          onChange={(val) => {
            setBody(val ?? '');
            markDirty();
          }}
          height={560}
        />
      </div>

      <Drawer
        title={intl.formatMessage({ id: 'workspace.markdown.basicInfo' })}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        size={380}
        extra={
          <Space>
            <Button onClick={() => setDrawerOpen(false)}>取消</Button>
            <Button
              type="primary"
              onClick={() => {
                form.submit();
              }}
            >
              保存信息
            </Button>
          </Space>
        }
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={() => setDrawerOpen(false)}
        >
          <Form.Item name="categorySlug" label="分类">
            <Input placeholder="如 frontend" />
          </Form.Item>
          <Form.Item name="summary" label="摘要">
            <Input.TextArea rows={4} placeholder="一句话描述内容" />
          </Form.Item>
        </Form>
      </Drawer>
    </PageContainer>
  );
};

export default Markdown;
