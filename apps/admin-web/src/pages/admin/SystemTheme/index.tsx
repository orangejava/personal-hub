import {
  ProForm,
  ProFormDigit,
  ProFormSelect,
  ProFormText,
} from '@ant-design/pro-components';
import type {
  NavigationPosition,
  ThemeConfig,
} from '@personal-hub/shared-types';
import { Link } from '@umijs/max';
import { Card, Form, Grid, message, Switch } from 'antd';
import React, { useState } from 'react';
import {
  ErrorState,
  PageContainer,
  SectionSkeleton,
} from '@/components/shared';
import { useRequest } from '@/hooks/useRequest';
import {
  fetchAdminSystemConfig,
  updateAdminSystemNavigation,
  updateAdminSystemTheme,
} from '@/services/admin';

const HEX_COLOR_RULE = {
  pattern: /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/,
  message: '颜色必须是 #RGB / #RRGGBB',
};

interface ThemePreviewProps {
  siteName: string;
  colorPrimary: string;
  colorSecondary: string;
  colorAccent: string;
  borderRadius: number;
  position: NavigationPosition;
}

/**
 * 用表单里尚未保存的颜色和导航位置画预览。
 * 不请求公开站点，避免把未保存的值和线上配置混在一起。
 */
function ThemeLayoutPreview({
  siteName,
  colorPrimary,
  colorSecondary,
  colorAccent,
  borderRadius,
  position,
}: ThemePreviewProps) {
  const barStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 12px',
    background: '#fff',
    border: `1px solid ${colorPrimary}`,
    borderRadius,
    color: colorSecondary,
    minWidth: 0,
  };
  const brand = (
    <span style={{ color: colorPrimary, fontWeight: 700, flex: '0 0 auto' }}>
      {siteName}
    </span>
  );
  const links = (
    <span style={{ flex: '1 1 auto', minWidth: 0 }}>首页 / 内容 / 关于</span>
  );
  const action = (
    <span
      aria-hidden
      style={{
        width: 28,
        height: 28,
        borderRadius: '50%',
        background: colorAccent,
        flex: '0 0 auto',
      }}
    />
  );

  if (position === 'left' || position === 'right') {
    return (
      <div style={{ width: '100%', overflow: 'auto' }}>
        <div
          style={{
            display: 'flex',
            flexDirection: position === 'right' ? 'row-reverse' : 'row',
            minWidth: 320,
            border: '1px solid rgba(0,0,0,0.06)',
            borderRadius,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              ...barStyle,
              width: 240,
              flex: '0 0 240px',
              flexDirection: 'column',
              alignItems: 'stretch',
              border: 'none',
              borderRadius: 0,
            }}
          >
            {brand}
            {links}
            {action}
          </div>
          <div
            style={{ flex: '1 1 auto', minWidth: 48, background: '#f5f5f5' }}
          />
        </div>
      </div>
    );
  }

  return (
    <div style={barStyle}>
      {brand}
      {links}
      {action}
    </div>
  );
}

/** 主题与导航分卡保存，避免一次提交把另一组配置写掉。 */
const SystemTheme: React.FC = () => {
  const [themeSaving, setThemeSaving] = useState(false);
  const [navSaving, setNavSaving] = useState(false);
  const [themeForm] = Form.useForm<ThemeConfig>();
  const [navForm] = Form.useForm<{ publicPosition: NavigationPosition }>();
  const screens = Grid.useBreakpoint();
  const { data, loading, error, run } = useRequest(fetchAdminSystemConfig);
  const theme = data?.theme;
  const loadedPosition =
    data?.navigationConfig?.publicPosition ?? data?.navigation ?? 'top';
  // 保存成功后用这次写入的值作为重置基准。打开页面时的 data 还是保存前的内容。
  const [savedTheme, setSavedTheme] = useState<ThemeConfig | null>(null);
  const [savedPosition, setSavedPosition] = useState<NavigationPosition | null>(
    null,
  );
  const themeBaseline = savedTheme ?? theme;
  const positionBaseline = savedPosition ?? loadedPosition;
  const colorPrimary =
    Form.useWatch('colorPrimary', themeForm) ||
    themeBaseline?.colorPrimary ||
    '#722ed1';
  const colorSecondary =
    Form.useWatch('colorSecondary', themeForm) ||
    themeBaseline?.colorSecondary ||
    '#14B8A6';
  const colorAccent =
    Form.useWatch('colorAccent', themeForm) ||
    themeBaseline?.colorAccent ||
    '#F97316';
  const borderRadius =
    Form.useWatch('borderRadius', themeForm) ??
    themeBaseline?.borderRadius ??
    8;
  const publicPosition =
    Form.useWatch('publicPosition', navForm) || positionBaseline;
  const previewBeside = screens.md === true;
  const twoColumns = screens.lg === true;
  const pageExtra = <Link to="/admin/system">返回系统配置</Link>;
  const fieldGrid: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: twoColumns ? '1fr 1fr' : '1fr',
    columnGap: 16,
  };

  const handleThemeFinish = async (values: ThemeConfig) => {
    setThemeSaving(true);
    try {
      await updateAdminSystemTheme(values);
      setSavedTheme(values);
      message.success('主题配置已保存（公开区需刷新后生效）');
      return true;
    } catch {
      return false;
    } finally {
      setThemeSaving(false);
    }
  };

  const handleNavigationFinish = async (values: {
    publicPosition: NavigationPosition;
  }) => {
    setNavSaving(true);
    try {
      await updateAdminSystemNavigation(values.publicPosition);
      setSavedPosition(values.publicPosition);
      message.success('导航位置已保存（公开区需刷新后生效）');
      return true;
    } catch {
      return false;
    } finally {
      setNavSaving(false);
    }
  };

  if (loading && !data) {
    return (
      <PageContainer title="主题配置" extra={pageExtra}>
        <SectionSkeleton variant="form" count={2} />
      </PageContainer>
    );
  }

  if (error) {
    return (
      <PageContainer title="主题配置" extra={pageExtra}>
        <ErrorState title="主题配置加载失败" onRetry={run} />
      </PageContainer>
    );
  }

  const preview = (
    <ThemeLayoutPreview
      siteName={data?.siteName || 'Personal Hub'}
      colorPrimary={colorPrimary}
      colorSecondary={colorSecondary}
      colorAccent={colorAccent}
      borderRadius={Number(borderRadius) || 0}
      position={publicPosition}
    />
  );

  return (
    <PageContainer title="主题配置" extra={pageExtra}>
      <Card title="主题">
        <div
          style={{
            display: 'flex',
            flexDirection: previewBeside ? 'row' : 'column',
            gap: 16,
            alignItems: 'flex-start',
          }}
        >
          <div style={{ flex: '1 1 auto', minWidth: 0 }}>
            <ProForm
              form={themeForm}
              initialValues={themeBaseline ?? {}}
              onReset={() => {
                if (themeBaseline) themeForm.setFieldsValue(themeBaseline);
              }}
              onFinish={handleThemeFinish}
              submitter={{
                submitButtonProps: { loading: themeSaving },
              }}
            >
              <div style={fieldGrid}>
                <ProFormText
                  name="colorPrimary"
                  label="主色"
                  rules={[{ required: true }, HEX_COLOR_RULE]}
                />
                <ProFormText
                  name="colorSecondary"
                  label="辅助色"
                  rules={[{ required: true }, HEX_COLOR_RULE]}
                />
                <ProFormText
                  name="colorAccent"
                  label="强调色"
                  rules={[{ required: true }, HEX_COLOR_RULE]}
                />
                <ProFormDigit
                  name="borderRadius"
                  label="圆角"
                  min={0}
                  max={24}
                />
                <ProFormSelect
                  name="mode"
                  label="默认模式"
                  options={[
                    { label: '亮色', value: 'light' },
                    { label: '暗色', value: 'dark' },
                    { label: '跟随系统', value: 'auto' },
                  ]}
                />
                <Form.Item
                  name="allowUserSwitch"
                  label="允许用户切换主题"
                  valuePropName="checked"
                >
                  <Switch />
                </Form.Item>
              </div>
            </ProForm>
          </div>
          <div
            style={{
              flex: previewBeside ? '0 0 360px' : '1 1 auto',
              width: previewBeside ? 360 : '100%',
            }}
          >
            {preview}
          </div>
        </div>
      </Card>
      <Card title="公开导航" style={{ marginTop: 16 }}>
        <ProForm
          form={navForm}
          initialValues={{ publicPosition: positionBaseline }}
          onReset={() =>
            navForm.setFieldsValue({ publicPosition: positionBaseline })
          }
          onFinish={handleNavigationFinish}
          submitter={{
            submitButtonProps: { loading: navSaving },
          }}
        >
          <ProFormSelect
            name="publicPosition"
            label="公开导航位置"
            fieldProps={{ style: { maxWidth: twoColumns ? 420 : '100%' } }}
            options={[
              { label: '顶部', value: 'top' },
              { label: '左侧', value: 'left' },
              { label: '右侧', value: 'right' },
            ]}
            rules={[{ required: true }]}
          />
        </ProForm>
      </Card>
    </PageContainer>
  );
};

export default SystemTheme;
