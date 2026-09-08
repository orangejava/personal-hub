import MDEditor from '@uiw/react-md-editor';
import { ContentType, ContentVisibility, ContentVisibilityLabel } from '@personal-hub/shared-types';
import {
  ArrowLeftOutlined,
  FullscreenExitOutlined,
  FullscreenOutlined,
} from '@ant-design/icons';
import { history, useIntl, useModel, useParams } from '@umijs/max';
import { App, Button, Drawer, Form, Input, Select, Tooltip, Space } from 'antd';
import React, { useEffect, useState } from 'react';
import { PageContainer } from '@/components/shared';
import { useRequest } from '@/hooks/useRequest';
import { fetchContentMeta } from '@/services/content';
import {
  createContent,
  fetchAppContent,
  publishContent,
  updateContent,
} from '@/services/workspace';

const visibilityOptions = Object.values(ContentVisibility).map((value) => ({
  label: ContentVisibilityLabel[value],
  value,
}));

/** Markdown 编辑：左右分栏 + 标题 + 基础信息抽屉 + 保存草稿/发布 */
const Markdown: React.FC = () => {
  const intl = useIntl();
  const { message } = App.useApp();
  const params = useParams<{ id: string }>();
  const isEdit = !!params.id;
  const { initialState, setInitialState } = useModel('@@initialState');
  const isFullscreen = !!initialState?.workspaceEditorFullscreen;

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  // 直接从编辑器首次保存时不改路由，避免路由组件重挂载造成整页闪动。
  const [draftId, setDraftId] = useState<string>();
  const [dirty, setDirty] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [form] = Form.useForm();
  const { data: contentMeta } = useRequest(fetchContentMeta);
  const categoryOptions = (contentMeta?.categories ?? []).map((item) => ({
    label: item.name,
    value: item.slug,
  }));

  useEffect(() => {
    if (!isEdit || !params.id) {
      return;
    }
    let cancelled = false;
    void fetchAppContent(params.id).then((detail) => {
      if (cancelled) {
        return;
      }
      setTitle(detail.title);
      setBody(detail.body ?? '');
      form.setFieldsValue({
        categorySlug: detail.categorySlug,
        summary: detail.summary,
        visibility: detail.visibility ?? ContentVisibility.Private,
      });
    });
    return () => {
      cancelled = true;
    };
  }, [form, isEdit, params.id]);

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

  // 退出编辑页后必须恢复工作区框架，避免全屏状态遗留到其他业务页面。
  useEffect(
    () => () => {
      void setInitialState((state) =>
        state?.workspaceEditorFullscreen
          ? { ...state, workspaceEditorFullscreen: false }
          : state,
      );
    },
    [setInitialState],
  );

  const toggleFullscreen = () => {
    void setInitialState((state) => ({
      ...state,
      workspaceEditorFullscreen: !state?.workspaceEditorFullscreen,
    }));
  };

  /** 返回文档管理页，避免编辑页只能依赖侧栏进行导航。 */
  const returnToContentList = () => {
    history.push('/workspace/content');
  };

  const save = async (status: 'draft' | 'published') => {
    try {
      const values = await form.validateFields();
      const id = params.id ?? draftId;
      const normalizedTitle = title.trim();
      const needsCategory = !id || status === 'published';
      if (needsCategory && !values.categorySlug) {
        form.setFields([
          {
            name: 'categorySlug',
            errors: [
              !id ? '创建内容前请选择一个分类' : '发布前请选择一个分类',
            ],
          },
        ]);
        setDrawerOpen(true);
        return;
      }
      if (status === 'published' && (normalizedTitle.length < 1 || normalizedTitle.length > 200)) {
        message.error('发布前需要 1～200 字标题');
        return;
      }
      const payload = {
        title: normalizedTitle,
        body,
        type: ContentType.Markdown,
        status,
        ...values,
      };
      const saved = id
        ? await updateContent(id, payload)
        : await createContent(payload);
      if (!id) {
        setDraftId(saved.id);
      }
      // 草稿写入成功后才发发布请求；发布失败仍能用已保存的 ID 继续编辑和重试。
      if (status === 'published') {
        const published = await publishContent(saved.id);
        message.success(published.reviewStatus === 'PENDING' ? '已提交审核' : '已发布');
      } else {
        message.success('已保存草稿');
      }
      setDirty(false);
    } catch {
      // 失败 toast 由全局 errorHandler 读 Nest error.message
    }
  };

  return (
    <PageContainer
      className="ph-workspace-editor-page"
      title={intl.formatMessage({
        id: isEdit ? 'workspace.markdown.editTitle' : 'workspace.markdown.newTitle',
      })}
      extra={
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={returnToContentList}>
            返回文档管理
          </Button>
          <Tooltip title={isFullscreen ? '退出全屏' : '全屏编辑'}>
            <Button
              aria-label={isFullscreen ? '退出全屏' : '全屏编辑'}
              icon={
                isFullscreen ? <FullscreenExitOutlined /> : <FullscreenOutlined />
              }
              onClick={toggleFullscreen}
            />
          </Tooltip>
          <Button onClick={() => setDrawerOpen(true)}>
            {intl.formatMessage({ id: 'workspace.markdown.basicInfo' })}
          </Button>
          <Button onClick={() => void save('draft')}>
            {intl.formatMessage({ id: 'workspace.markdown.saveDraft' })}
          </Button>
          <Button type="primary" onClick={() => void save('published')}>
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
      <div className="ph-markdown-editor" data-color-mode="light">
        <MDEditor
          value={body}
          onChange={(val) => {
            setBody(val ?? '');
            markDirty();
          }}
          height="100%"
          visibleDragbar={false}
          commandsFilter={(command) =>
            command.name === 'fullscreen' ? false : command
          }
        />
      </div>

      <Drawer
        forceRender
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
        {/* 抽屉保存只确认分类/可见性/摘要；正文仍由保存草稿或发布写入服务端。 */}
        <Form
          form={form}
          layout="vertical"
          onFinish={() => setDrawerOpen(false)}
        >
          <Form.Item
            name="categorySlug"
            label="分类"
            extra="首次创建和发布都必须选择启用中的分类，后续可在此修改。"
          >
            <Select
              allowClear
              options={categoryOptions}
              placeholder="请选择分类"
            />
          </Form.Item>
          <Form.Item name="visibility" label="可见性" initialValue={ContentVisibility.Private}>
            <Select options={visibilityOptions} />
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
