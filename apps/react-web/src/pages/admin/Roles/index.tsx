import { ProTable } from '@ant-design/pro-components';
import { Button, Checkbox, Drawer, message, Space, Tag } from 'antd';
import React, { useState } from 'react';
import type { AdminRoleRecord, PermissionCode } from '@personal-hub/shared-types';
import { PageContainer, ResultState } from '@/components/shared';
import { fetchAdminRoles, updateAdminRolePermissions } from '@/services/admin';

const ALL_PERMISSIONS: PermissionCode[] = [
  'content:read',
  'content:write',
  'content:publish',
  'content:delete',
  'booklet:read',
  'booklet:write',
  'workspace:access',
  'admin:access',
  'user:manage',
  'role:manage',
  'ai:use',
  'ai:manage',
  'system:config',
];

/** 角色管理：权限点勾选（mock） */
const Roles: React.FC = () => {
  const [editing, setEditing] = useState<AdminRoleRecord | null>(null);
  const [checked, setChecked] = useState<PermissionCode[]>([]);
  const [reloadKey, setReloadKey] = useState(0);
  const [saving, setSaving] = useState(false);

  const openEdit = (role: AdminRoleRecord) => {
    setEditing(role);
    setChecked([...role.permissions]);
  };

  const savePermissions = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      const res = await updateAdminRolePermissions(editing.code, checked);
      if (res?.code === 0) {
        message.success('权限已保存');
        setEditing(null);
        setReloadKey((k) => k + 1);
      } else {
        message.error(res?.message || '保存失败');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageContainer title="角色管理">
      <ProTable<AdminRoleRecord>
        key={reloadKey}
        rowKey="code"
        search={false}
        pagination={false}
        locale={{
          emptyText: <ResultState status="empty" description="暂无角色" />,
        }}
        request={async () => {
          const res = await fetchAdminRoles();
          return { data: res.data ?? [], success: res.code === 0 };
        }}
        columns={[
          { title: '角色', dataIndex: 'name' },
          { title: '标识', dataIndex: 'code' },
          { title: '说明', dataIndex: 'description', ellipsis: true },
          {
            title: '权限数',
            search: false,
            render: (_, r) => <Tag>{r.permissions.length}</Tag>,
          },
          {
            title: '操作',
            valueType: 'option',
            render: (_, r) => [<a key="edit" onClick={() => openEdit(r)}>配置权限</a>],
          },
        ]}
      />
      <Drawer
        title={`配置权限：${editing?.name ?? ''}`}
        open={!!editing}
        size={480}
        onClose={() => setEditing(null)}
        extra={
          <Space>
            <Button onClick={() => setEditing(null)}>取消</Button>
            <Button type="primary" loading={saving} onClick={savePermissions}>
              保存
            </Button>
          </Space>
        }
      >
        <Checkbox.Group
          style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
          value={checked}
          onChange={(v) => setChecked(v as PermissionCode[])}
          options={ALL_PERMISSIONS.map((p) => ({ label: p, value: p }))}
        />
      </Drawer>
    </PageContainer>
  );
};

export default Roles;
