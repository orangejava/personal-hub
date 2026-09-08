import { ContentVisibility, ContentVisibilityLabel } from '@personal-hub/shared-types';
import { useIntl } from '@umijs/max';
import { Alert, App, Button, Drawer, Form, Input, Select, Space } from 'antd';
import React, { useEffect, useState } from 'react';
import { useRequest } from '@/hooks/useRequest';
import { fetchContentMeta } from '@/services/content';
import { fetchAppContent, updateContent } from '@/services/workspace';

const visibilityOptions = Object.values(ContentVisibility).map((value) => ({
  label: ContentVisibilityLabel[value],
  value,
}));

function isImportRestricted(restriction?: 'NONE' | 'PRIVATE_UNTIL_LICENSED'): boolean {
  return restriction === 'PRIVATE_UNTIL_LICENSED';
}

interface ContentMetaDrawerProps {
  contentId?: string;
  open: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

/**
 * PDF / Word / 小册没有正文编辑器，标题和分类在这个抽屉里改，发布前才能补齐。
 */
const ContentMetaDrawer: React.FC<ContentMetaDrawerProps> = ({
  contentId,
  open,
  onClose,
  onSaved,
}) => {
  const intl = useIntl();
  const { message } = App.useApp();
  const format = (id: string) => intl.formatMessage({ id });
  const [form] = Form.useForm();
  const [restricted, setRestricted] = useState(false);
  const { data: contentMeta } = useRequest(fetchContentMeta);
  const categoryOptions = (contentMeta?.categories ?? []).map((item) => ({
    label: item.name,
    value: item.slug,
  }));

  useEffect(() => {
    if (!open || !contentId) {
      return;
    }
    let cancelled = false;
    setRestricted(false);
    void fetchAppContent(contentId).then((detail) => {
      if (cancelled) {
        return;
      }
      setRestricted(isImportRestricted(detail.importRestriction));
      form.setFieldsValue({
        title: detail.title,
        categorySlug: detail.categorySlug,
        summary: detail.summary,
        visibility: detail.visibility ?? ContentVisibility.Private,
      });
    });
    return () => {
      cancelled = true;
    };
  }, [contentId, form, open]);

  const handleFinish = async (values: {
    title: string;
    categorySlug: string;
    summary?: string;
    visibility?: ContentVisibility;
  }) => {
    if (!contentId) {
      return;
    }
    await updateContent(contentId, {
      title: values.title.trim(),
      categorySlug: values.categorySlug,
      summary: values.summary,
      visibility: values.visibility,
    });
    message.success(format('workspace.contentMeta.saved'));
    onSaved?.();
    onClose();
  };

  return (
    <Drawer
      forceRender
      title={format('workspace.contentMeta.title')}
      open={open}
      onClose={onClose}
      size={380}
      extra={
        <Space>
          <Button onClick={onClose}>{format('workspace.contentMeta.cancel')}</Button>
          <Button type="primary" onClick={() => form.submit()}>
            {format('workspace.contentMeta.save')}
          </Button>
        </Space>
      }
    >
      <Form form={form} layout="vertical" onFinish={handleFinish}>
        {restricted ? (
          <Alert
            type="warning"
            showIcon
            style={{ marginBottom: 16 }}
            title={format('workspace.contentMeta.restrictedTitle')}
            description={format('workspace.contentMeta.restrictedDescription')}
          />
        ) : null}
        <Form.Item
          name="title"
          label={format('workspace.contentMeta.titleLabel')}
          rules={[{ required: true, message: format('workspace.contentMeta.titleRequired') }]}
        >
          <Input maxLength={200} placeholder={format('workspace.contentMeta.titlePlaceholder')} />
        </Form.Item>
        <Form.Item
          name="categorySlug"
          label={format('workspace.contentMeta.category')}
          rules={[{ required: true, message: format('workspace.contentMeta.categoryRequired') }]}
          extra={format('workspace.contentMeta.categoryHelp')}
        >
          <Select
            options={categoryOptions}
            placeholder={format('workspace.contentMeta.categoryPlaceholder')}
          />
        </Form.Item>
        <Form.Item
          name="visibility"
          label={format('workspace.contentMeta.visibility')}
          extra={
            restricted
              ? format('workspace.contentMeta.visibilityRestricted')
              : undefined
          }
        >
          <Select
            options={visibilityOptions.map((option) => ({
              ...option,
              disabled: restricted && option.value !== ContentVisibility.Private,
            }))}
          />
        </Form.Item>
        <Form.Item name="summary" label={format('workspace.contentMeta.summary')}>
          <Input.TextArea
            rows={4}
            placeholder={format('workspace.contentMeta.summaryPlaceholder')}
          />
        </Form.Item>
      </Form>
    </Drawer>
  );
};

export default ContentMetaDrawer;
