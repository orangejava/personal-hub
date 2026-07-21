import { ProForm, ProFormText } from '@ant-design/pro-components';
import type { AdminMenuConfig, MenuItem } from '@personal-hub/shared-types';
import { useModel, useRequest } from '@umijs/max';
import { Alert, Button, Card, Col, Drawer, Form, message, Row, Space, Tabs, Tag, Tree } from 'antd';
import type { DataNode } from 'antd/es/tree';
import React, { useMemo, useState } from 'react';
import { ErrorState, PageContainer, SectionSkeleton } from '@/components/shared';
import { fetchAdminMenuConfig, updateAdminMenuConfig } from '@/services/admin';

type MenuScope = keyof AdminMenuConfig;

const scopeLabels: Record<MenuScope, string> = {
  public: '公开前台',
  workspace: '工作区',
  admin: '后台管理',
  ai: 'AI 工作台',
};

type EditingState = {
  scope: MenuScope;
  path: string;
  item: MenuItem;
};

function cloneMenu(menu: MenuItem[]): MenuItem[] {
  return menu.map((item) => ({
    ...item,
    children: item.children ? cloneMenu(item.children) : undefined,
  }));
}

function toTreeData(menu: MenuItem[]): DataNode[] {
  return menu.map((item) => ({
    key: item.path,
    title: (
      <Space>
        <span>{item.name}</span>
        <Tag>{item.path}</Tag>
        {item.permissions?.length ? <Tag color="blue">{item.permissions.length} 权限</Tag> : null}
      </Space>
    ),
    children: item.children ? toTreeData(item.children) : undefined,
  }));
}

function updateMenuItem(menu: MenuItem[], path: string, patch: Partial<MenuItem>): MenuItem[] {
  return menu.map((item) => {
    if (item.path === path) return { ...item, ...patch };
    if (item.children) return { ...item, children: updateMenuItem(item.children, path, patch) };
    return item;
  });
}

function findMenuItem(menu: MenuItem[], path: string): MenuItem | undefined {
  for (const item of menu) {
    if (item.path === path) return item;
    const child = item.children ? findMenuItem(item.children, path) : undefined;
    if (child) return child;
  }
  return undefined;
}

/** 菜单管理：维护公开、工作区、后台和阶段 5 AI 侧边栏的 mock 菜单树。 */
const Menus: React.FC = () => {
  const { setInitialState } = useModel('@@initialState');
  const [config, setConfig] = useState<AdminMenuConfig>();
  const [editing, setEditing] = useState<EditingState | null>(null);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm<MenuItem & { permissionsText?: string }>();

  const { loading, error, refresh } = useRequest(fetchAdminMenuConfig, {
    onSuccess: (menu) => {
      if (menu) {
        setConfig({
          public: cloneMenu(menu.public),
          workspace: cloneMenu(menu.workspace),
          admin: cloneMenu(menu.admin),
          ai: cloneMenu(menu.ai),
        });
      }
    },
  });

  const tabs = useMemo(
    () =>
      (Object.keys(scopeLabels) as MenuScope[]).map((scope) => ({
        key: scope,
        label: scopeLabels[scope],
        children: (
          <Card>
            <Alert
              showIcon
              type={scope === 'ai' ? 'warning' : 'info'}
              style={{ marginBottom: 16 }}
              title={
                scope === 'ai'
                  ? 'AI 菜单为阶段 5 预留配置，本阶段只保存 mock'
                  : '菜单配置保存后会写入 mock，并同步当前 initialState'
              }
            />
            <Tree
              showLine
              blockNode
              treeData={toTreeData(config?.[scope] ?? [])}
              titleRender={(node) => {
                const item = findMenuItem(config?.[scope] ?? [], String(node.key));
                if (!item) return node.title as React.ReactNode;
                return (
                  <Row align="middle" justify="space-between" style={{ width: '100%' }}>
                    <Col>{node.title as React.ReactNode}</Col>
                    <Col>
                      <Button
                        size="small"
                        type="link"
                        onClick={() => {
                          setEditing({ scope, path: item.path, item });
                          form.setFieldsValue({
                            ...item,
                            permissionsText: item.permissions?.join(',') ?? '',
                          });
                        }}
                      >
                        编辑
                      </Button>
                    </Col>
                  </Row>
                );
              }}
            />
          </Card>
        ),
      })),
    [config, form],
  );

  const save = async () => {
    if (!config) return;
    setSaving(true);
    try {
      const res = await updateAdminMenuConfig(config);
      if (res?.code === 0 && res.data) {
        message.success('菜单配置已保存');
        setConfig(res.data);
        // 当前阶段只同步三大既有区域；AI 菜单到阶段 5 AiLayout 再接入。
        setInitialState((state) => ({
          ...state,
          menu: [
            ...res.data.public,
            { path: '/workspace', name: '工作区', icon: 'desktop', children: res.data.workspace },
            { path: '/admin', name: '后台管理', icon: 'crown', children: res.data.admin },
          ],
        }));
        return;
      }
      message.error(res?.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  if (error) {
    return (
      <PageContainer title="菜单管理">
        <ErrorState title="菜单配置加载失败" onRetry={refresh} />
      </PageContainer>
    );
  }

  if (loading && !config) {
    return (
      <PageContainer title="菜单管理">
        <SectionSkeleton variant="article" rows={6} />
      </PageContainer>
    );
  }

  return (
    <PageContainer
      title="菜单管理"
      extra={
        <Space>
          <Button onClick={() => refresh()} loading={loading} disabled={saving}>
            重新加载
          </Button>
          <Button type="primary" onClick={save} disabled={!config} loading={saving}>
            保存菜单
          </Button>
        </Space>
      }
    >
      <Tabs items={tabs} />
      <Drawer
        title="编辑菜单项"
        open={!!editing}
        size={420}
        onClose={() => setEditing(null)}
      >
        <ProForm<MenuItem & { permissionsText?: string }>
          form={form}
          layout="vertical"
          submitter={{
            searchConfig: { submitText: '应用到本地配置' },
            render: (_, dom) => dom,
          }}
          onFinish={async (values) => {
            if (!editing || !config) return false;
            const permissions = values.permissionsText
              ?.split(',')
              .map((item) => item.trim())
              .filter(Boolean);
            setConfig({
              ...config,
              [editing.scope]: updateMenuItem(config[editing.scope], editing.path, {
                name: values.name,
                icon: values.icon,
                permissions: permissions?.length ? (permissions as MenuItem['permissions']) : undefined,
              }),
            });
            setEditing(null);
            return true;
          }}
        >
          <ProFormText name="path" label="路由" disabled />
          <ProFormText name="name" label="名称 / locale key" rules={[{ required: true }]} />
          <ProFormText name="icon" label="图标 key" />
          <ProFormText
            name="permissionsText"
            label="权限点"
            tooltip="多个权限用英文逗号分隔"
          />
        </ProForm>
      </Drawer>
    </PageContainer>
  );
};

export default Menus;
