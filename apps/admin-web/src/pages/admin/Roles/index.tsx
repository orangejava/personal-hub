import { ProTable } from '@ant-design/pro-components';
import type {
  AdminPermissionItem,
  AdminRoleRecord,
} from '@personal-hub/shared-types';
import { useIntl } from '@umijs/max';
import { Alert, App, Button, Checkbox, Drawer, Space, Tag } from 'antd';
import React, { useEffect, useState } from 'react';
import { PageContainer, ResultState } from '@/components/shared';
import {
  fetchAdminPermissions,
  fetchAdminRoles,
  updateAdminRolePermissions,
} from '@/services/admin';
import { nestError } from '@/services/auth';

function groupCatalog(
  items: AdminPermissionItem[],
): Array<[string, AdminPermissionItem[]]> {
  const map = new Map<string, AdminPermissionItem[]>();
  for (const item of items) {
    const list = map.get(item.group) ?? [];
    list.push(item);
    map.set(item.group, list);
  }
  return [...map.entries()];
}

/** 角色管理：权限点按 Nest 目录分组勾选。 */
const Roles: React.FC = () => {
  const intl = useIntl();
  const { message } = App.useApp();
  const format = (id: string, values?: Record<string, string>) =>
    intl.formatMessage({ id }, values);
  const [catalog, setCatalog] = useState<AdminPermissionItem[]>([]);
  const [editing, setEditing] = useState<AdminRoleRecord | null>(null);
  const [checked, setChecked] = useState<string[]>([]);
  const [reloadKey, setReloadKey] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void fetchAdminPermissions().then((items) => setCatalog(items ?? []));
  }, []);

  const openEdit = (role: AdminRoleRecord) => {
    setEditing(role);
    setChecked([...role.permissions]);
  };

  const savePermissions = async () => {
    if (!editing || editing.isProtected) return;
    setSaving(true);
    try {
      await updateAdminRolePermissions(editing.code, checked, editing.version);
      message.success(format('admin.roles.saved'));
      setEditing(null);
      setReloadKey((k) => k + 1);
    } catch (error) {
      const nest = nestError(error);
      if (nest.code === 'ROLE_VERSION_CONFLICT') {
        const roles = await fetchAdminRoles();
        const latest = roles?.find((item) => item.code === editing.code);
        if (latest) {
          setEditing(latest);
          setChecked([...latest.permissions]);
        }
        setReloadKey((k) => k + 1);
      }
    } finally {
      setSaving(false);
    }
  };

  const toggleGroup = (codes: string[], allChecked: boolean) => {
    if (allChecked) {
      setChecked((prev) => prev.filter((code) => !codes.includes(code)));
      return;
    }
    setChecked((prev) => [...new Set([...prev, ...codes])]);
  };

  return (
    <PageContainer title={format('admin.roles.title')}>
      <ProTable<AdminRoleRecord>
        key={reloadKey}
        rowKey="code"
        search={false}
        pagination={false}
        locale={{
          emptyText: (
            <ResultState
              status="empty"
              description={format('admin.roles.empty')}
            />
          ),
        }}
        request={async () => {
          const res = await fetchAdminRoles();
          return { data: res ?? [], success: true };
        }}
        columns={[
          { title: format('admin.roles.role'), dataIndex: 'name' },
          { title: format('admin.roles.code'), dataIndex: 'code' },
          {
            title: format('admin.roles.system'),
            search: false,
            render: (_, r) =>
              r.isProtected ? (
                <Tag color="gold">{format('admin.roles.protected')}</Tag>
              ) : (
                <Tag>{format('admin.roles.systemRole')}</Tag>
              ),
          },
          {
            title: format('admin.roles.permissionCount'),
            search: false,
            render: (_, r) => <Tag>{r.permissions.length}</Tag>,
          },
          {
            title: format('admin.common.action'),
            valueType: 'option',
            render: (_, r) => [
              <a key="edit" onClick={() => openEdit(r)}>
                {format(
                  r.isProtected
                    ? 'admin.roles.viewPermissions'
                    : 'admin.roles.configurePermissions',
                )}
              </a>,
            ],
          },
        ]}
      />
      <Drawer
        title={format('admin.roles.drawerTitle', { name: editing?.name ?? '' })}
        open={!!editing}
        size={480}
        onClose={() => setEditing(null)}
        extra={
          <Space>
            <Button onClick={() => setEditing(null)}>
              {format('admin.common.cancel')}
            </Button>
            <Button
              type="primary"
              loading={saving}
              disabled={!!editing?.isProtected}
              onClick={() => void savePermissions()}
            >
              {format('admin.common.save')}
            </Button>
          </Space>
        }
      >
        {editing?.isProtected ? (
          <Alert
            type="warning"
            showIcon
            style={{ marginBottom: 16 }}
            title={format('admin.roles.protectedHint')}
          />
        ) : null}
        {groupCatalog(catalog).map(([group, items]) => {
          const codes = items.map((item) => item.code);
          const selectedCount = codes.filter((code) =>
            checked.includes(code),
          ).length;
          const allChecked = selectedCount === codes.length && codes.length > 0;
          return (
            <div key={group} style={{ marginBottom: 20 }}>
              <Space style={{ marginBottom: 8 }}>
                <strong>{format(`admin.roles.group.${group}`)}</strong>
                <Button
                  type="link"
                  size="small"
                  disabled={!!editing?.isProtected}
                  onClick={() => toggleGroup(codes, allChecked)}
                >
                  {format(
                    allChecked
                      ? 'admin.roles.deselectAll'
                      : 'admin.roles.selectAll',
                  )}
                </Button>
              </Space>
              <Checkbox.Group
                style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
                value={checked}
                disabled={!!editing?.isProtected}
                onChange={(value) => setChecked(value as string[])}
                options={items.map((item) => ({
                  label: `${item.label}（${item.code}）`,
                  value: item.code,
                }))}
              />
            </div>
          );
        })}
      </Drawer>
    </PageContainer>
  );
};

export default Roles;
