import {
  type ContentAccessGrantList,
  ContentVisibility,
  ContentVisibilityLabel,
} from '@personal-hub/shared-types';
import { useIntl } from '@umijs/max';
import {
  Alert,
  App,
  Button,
  Drawer,
  Form,
  Input,
  Segmented,
  Select,
  Space,
} from 'antd';
import React, { useEffect, useRef, useState } from 'react';
import { useRequest } from '@/hooks/useRequest';
import { nestError } from '@/services/auth';
import { fetchContentMeta } from '@/services/content';
import {
  fetchAppContent,
  fetchContentAccessGrants,
  replaceContentAccessGrants,
  updateContent,
} from '@/services/workspace';

const visibilityOptions = Object.values(ContentVisibility).map((value) => ({
  label: ContentVisibilityLabel[value],
  value,
}));

function isImportRestricted(
  restriction?: 'NONE' | 'PRIVATE_UNTIL_LICENSED',
): boolean {
  return restriction === 'PRIVATE_UNTIL_LICENSED';
}

function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

interface ContentMetaFormValues {
  title: string;
  categorySlug: string;
  summary?: string;
  visibility?: ContentVisibility;
  privateAccessMode?: 'only_me' | 'specific_users';
  grantEmails?: string[];
}

export function toAccessGrantFormState(grants: ContentAccessGrantList) {
  const grantEmails = grants.list.map((item) => item.email);
  return {
    privateAccessMode:
      grantEmails.length > 0
        ? ('specific_users' as const)
        : ('only_me' as const),
    grantEmails,
    ignoredEmails: grants.ignoredEmails,
  };
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
  const format = (id: string, values?: Record<string, string>) =>
    intl.formatMessage({ id }, values);
  const commonErrorMessage = format('workspace.common.error');
  const [form] = Form.useForm();
  const [restricted, setRestricted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  // 详情与授权分开记录：授权未知时可展示基础信息，但绝不能提交覆盖名单。
  const [detailLoadedContentId, setDetailLoadedContentId] = useState<string>();
  const [accessGrantsLoaded, setAccessGrantsLoaded] = useState(false);
  const [loadedContentId, setLoadedContentId] = useState<string>();
  const loadSequenceRef = useRef(0);
  const visibility = Form.useWatch<ContentVisibility>('visibility', form);
  const privateAccessMode = Form.useWatch<'only_me' | 'specific_users'>(
    'privateAccessMode',
    form,
  );
  const { data: contentMeta } = useRequest(fetchContentMeta);
  const categoryOptions = (contentMeta?.categories ?? []).map((item) => ({
    label: item.name,
    value: item.slug,
  }));

  useEffect(() => {
    const loadSequence = ++loadSequenceRef.current;
    setDetailLoadedContentId(undefined);
    setAccessGrantsLoaded(false);
    setLoadedContentId(undefined);
    setRestricted(false);
    form.resetFields();
    form.setFieldsValue({ privateAccessMode: 'only_me', grantEmails: [] });
    if (!open || !contentId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    void Promise.allSettled([
      fetchAppContent(contentId, { skipErrorHandler: true }),
      fetchContentAccessGrants(contentId, { skipErrorHandler: true }),
    ])
      .then(([detailResult, grantsResult]) => {
        if (loadSequenceRef.current !== loadSequence) {
          return;
        }

        if (detailResult.status === 'fulfilled') {
          const detail = detailResult.value;
          setRestricted(isImportRestricted(detail.importRestriction));
          form.setFieldsValue({
            title: detail.title,
            categorySlug: detail.categorySlug,
            summary: detail.summary,
            visibility: detail.visibility ?? ContentVisibility.Private,
          });
          setDetailLoadedContentId(contentId);
        }

        if (grantsResult.status === 'fulfilled') {
          const { ignoredEmails: _ignoredEmails, ...grantFields } =
            toAccessGrantFormState(grantsResult.value);
          form.setFieldsValue(grantFields);
          setAccessGrantsLoaded(true);
        }

        if (
          detailResult.status === 'fulfilled' &&
          grantsResult.status === 'fulfilled'
        ) {
          setLoadedContentId(contentId);
        } else {
          const error =
            detailResult.status === 'rejected'
              ? detailResult.reason
              : grantsResult.status === 'rejected'
                ? grantsResult.reason
                : undefined;
          message.error(nestError(error).message || commonErrorMessage);
        }
      })
      .finally(() => {
        if (loadSequenceRef.current === loadSequence) {
          setLoading(false);
        }
      });
    return () => {
      if (loadSequenceRef.current === loadSequence) {
        loadSequenceRef.current += 1;
      }
    };
  }, [commonErrorMessage, contentId, form, message, open]);

  const handleFinish = async (values: ContentMetaFormValues) => {
    if (!contentId || loadedContentId !== contentId || loading || saving) {
      return;
    }
    setSaving(true);
    try {
      await updateContent(contentId, {
        title: values.title.trim(),
        categorySlug: values.categorySlug,
        summary: values.summary,
        visibility: values.visibility,
      });
      let ignoredEmails: string[] = [];
      if (values.visibility === ContentVisibility.Private) {
        const grants = await replaceContentAccessGrants(
          contentId,
          values.privateAccessMode === 'specific_users'
            ? (values.grantEmails ?? [])
            : [],
        );
        const { ignoredEmails: responseIgnoredEmails, ...grantFields } =
          toAccessGrantFormState(grants);
        ignoredEmails = responseIgnoredEmails;
        form.setFieldsValue(grantFields);
      }
      if (ignoredEmails.length > 0) {
        message.warning(
          format('workspace.contentMeta.authorEmailsIgnored', {
            emails: ignoredEmails.join('、'),
          }),
        );
      } else {
        message.success(format('workspace.contentMeta.saved'));
      }
      onSaved?.();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    if (!saving) {
      onClose();
    }
  };

  const canSubmit =
    Boolean(open && contentId && loadedContentId === contentId) &&
    !loading &&
    !saving;
  const canEditDetail =
    Boolean(open && contentId && detailLoadedContentId === contentId) &&
    !loading &&
    !saving;
  const canEditAccessGrants = canEditDetail && accessGrantsLoaded;

  return (
    <Drawer
      forceRender
      title={format('workspace.contentMeta.title')}
      open={open}
      onClose={handleClose}
      size={380}
      extra={
        <Space>
          <Button disabled={saving} onClick={handleClose}>
            {format('workspace.contentMeta.cancel')}
          </Button>
          <Button
            type="primary"
            loading={loading || saving}
            disabled={!canSubmit}
            onClick={() => form.submit()}
          >
            {format('workspace.contentMeta.save')}
          </Button>
        </Space>
      }
    >
      <Form
        form={form}
        layout="vertical"
        disabled={!canEditDetail}
        onFinish={handleFinish}
      >
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
          rules={[
            {
              required: true,
              message: format('workspace.contentMeta.titleRequired'),
            },
          ]}
        >
          <Input
            maxLength={200}
            placeholder={format('workspace.contentMeta.titlePlaceholder')}
          />
        </Form.Item>
        <Form.Item
          name="categorySlug"
          label={format('workspace.contentMeta.category')}
          rules={[
            {
              required: true,
              message: format('workspace.contentMeta.categoryRequired'),
            },
          ]}
          extra={format('workspace.contentMeta.categoryHelp')}
        >
          <Select
            options={categoryOptions}
            placeholder={format('workspace.contentMeta.categoryPlaceholder')}
          />
        </Form.Item>
        {visibility === ContentVisibility.Private ? (
          <>
            <Form.Item
              name="privateAccessMode"
              label={format('workspace.contentMeta.privateAccessMode')}
              initialValue="only_me"
            >
              <Segmented
                block
                disabled={!canEditAccessGrants}
                options={[
                  {
                    label: format('workspace.contentMeta.onlyMe'),
                    value: 'only_me',
                  },
                  {
                    label: format('workspace.contentMeta.specificUsers'),
                    value: 'specific_users',
                    disabled: restricted,
                  },
                ]}
              />
            </Form.Item>
            {privateAccessMode === 'specific_users' ? (
              <Form.Item
                name="grantEmails"
                label={format('workspace.contentMeta.grantEmails')}
                extra={format('workspace.contentMeta.grantEmailsHelp')}
                rules={[
                  {
                    validator: async (_, values?: string[]) => {
                      if (!values?.length) {
                        throw new Error(
                          format('workspace.contentMeta.grantEmailsRequired'),
                        );
                      }
                      if (values.some((email) => !isEmail(email))) {
                        throw new Error(
                          format('workspace.contentMeta.grantEmailsInvalid'),
                        );
                      }
                    },
                  },
                ]}
              >
                <Select
                  mode="tags"
                  maxCount={50}
                  disabled={!canEditAccessGrants}
                  open={false}
                  placeholder={format(
                    'workspace.contentMeta.grantEmailsPlaceholder',
                  )}
                  tokenSeparators={[',', '，', ' ']}
                />
              </Form.Item>
            ) : null}
          </>
        ) : null}
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
              disabled:
                restricted && option.value !== ContentVisibility.Private,
            }))}
          />
        </Form.Item>
        <Form.Item
          name="summary"
          label={format('workspace.contentMeta.summary')}
        >
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
