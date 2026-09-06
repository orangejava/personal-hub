import { ProForm, ProFormText } from '@ant-design/pro-components';
import { useRequest } from '@/hooks/useRequest';
import type { AdminMenuConfig, MenuItem } from '@personal-hub/shared-types';

import { Alert, Button, Card, Col, Drawer, Form, message, Row, Space, Tabs, Tag, Tree } from 'antd';
import type { DataNode } from 'antd/es/tree';
import React, { useMemo, useState } from 'react';
import { ErrorState, PageContainer, SectionSkeleton } from '@/components/shared';
import { fetchAdminMenuConfig, updateAdminMenuItem } from '@/services/admin';

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

/** 菜单管理：维护 Nest 菜单树，单项编辑立即保存。 */
const Menus: React.FC = () => {
  const [config, setConfig] = useState<AdminMenuConfig>();
  const [editing, setEditing] = useState<EditingState | null>(null);
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
                  ? 'AI 区域暂无系统菜单，可后续新增外链或内部项'
                  : '编辑单项会立即写入 Nest；核心恢复入口不能禁用或删除'
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
        <Button onClick={() => refresh()} loading={loading}>
          重新加载
        </Button>
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
            const nestId = editing.item.id;
            try {
              if (nestId) {
                await updateAdminMenuItem({
                  id: nestId,
                  name: values.name,
                  icon: values.icon,
                  permissionCodes: permissions,
                });
              }
            } catch {
              return false;
            }
            setConfig({
              ...config,
              [editing.scope]: updateMenuItem(config[editing.scope], editing.path, {
                name: values.name,
                icon: values.icon,
                permissions: permissions?.length ? (permissions as MenuItem['permissions']) : undefined,
              }),
            });
            setEditing(null);
            message.success('菜单项已保存');
            return true;
          }}
        >
          <ProFormText name="path" label="路由" disabled />
          <ProFormText name="name" label="名称" rules={[{ required: true }]} />
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
