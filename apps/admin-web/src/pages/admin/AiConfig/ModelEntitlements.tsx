import { useModel } from '@umijs/max';
import { App, Alert, Button, Drawer, Form, Select, Space, Switch, Table } from 'antd';
import { useState } from 'react';
import type { AdminAiEntitlement, AdminAiModelConfig } from '@personal-hub/shared-types';
import { updateAdminAiEntitlement } from '@/services/admin';

interface Props {
  entitlements: AdminAiEntitlement[];
  models: AdminAiModelConfig[];
  onSaved: () => Promise<unknown>;
  focusModel?: AdminAiModelConfig;
  onClearFocus: () => void;
}

export const roleLabels: Record<string, string> = {
  MEMBER: '普通用户',
  EDITOR: '编辑',
  ADMIN: '管理员',
  SUPER_ADMIN: '系统所有者',
};

/** 空白名单表示不限制；默认模型仍须满足角色授权。 */
export function modelAllowedForRole(row: AdminAiEntitlement, modelId: string) {
  return row.allowedModelIds.length === 0 || row.allowedModelIds.includes(modelId);
}

/** 授权有独立的编辑状态和权限点，避免模型新增隐式改变角色边界。 */
export default function ModelEntitlements({
  entitlements,
  models,
  onSaved,
  focusModel,
  onClearFocus,
}: Props) {
  const { initialState } = useModel('@@initialState');
  const canManage = initialState?.permissionGrants?.some(
    (grant) => grant.code === 'ai:entitlement:manage' && grant.dataScope === 'ALL',
  );
  const { message } = App.useApp();
  const [editing, setEditing] = useState<AdminAiEntitlement>();
  const [saving, setSaving] = useState(false);
  const [unrestricted, setUnrestricted] = useState(false);
  const [modelIds, setModelIds] = useState<string[]>([]);
  const open = (row: AdminAiEntitlement) => {
    setEditing(row);
    setUnrestricted(row.allowedModelIds.length === 0);
    // 从模型发布流程进入时只预选，不自动写入；管理员确认保存才会开放。
    setModelIds(
      focusModel && !modelAllowedForRole(row, focusModel.id)
        ? [...row.allowedModelIds, focusModel.id]
        : row.allowedModelIds,
    );
  };
  const save = async () => {
    if (!editing) return;
    if (!unrestricted && modelIds.length === 0) {
      message.warning('请选择至少一个授权模型，或启用全部模型访问权限');
      return;
    }
    setSaving(true);
    try {
      await updateAdminAiEntitlement(editing.roleId, unrestricted ? [] : modelIds);
      await onSaved();
      setEditing(undefined);
      message.success('模型访问权限已保存');
    } catch {
      // 接口错误由全局 errorHandler 显示，保留表单供修改或重试。
    } finally {
      setSaving(false);
    }
  };
  return (
    <>
      {focusModel && (
        <Alert
          type={
            entitlements.some((row) => modelAllowedForRole(row, focusModel.id)) ? 'info' : 'warning'
          }
          showIcon
          title={`模型访问权限：${focusModel.displayName}`}
          description="按角色配置当前模型的访问权限。模型启用、用户可见及默认设置均不替代角色授权；授权后，实际可用性仍受厂商和模型状态限制。"
          action={
            <Button size="small" onClick={onClearFocus}>
              查看全部角色权限
            </Button>
          }
          style={{ marginBottom: 16 }}
        />
      )}
      {!canManage && (
        <Alert
          type="warning"
          showIcon
          title="当前账号无模型授权操作权限，请联系具有 AI 权益管理权限的管理员。"
          style={{ marginBottom: 16 }}
        />
      )}
      {!focusModel && (
        <Alert
          type="info"
          showIcon
          title="角色模型访问权限"
          description="统一管理各角色可访问的模型范围。选择全部模型时，授权范围包含后续新增模型；选择指定模型时，新增模型须单独授权。模型实际可用性仍受厂商及模型状态限制。"
        />
      )}
      <Table<AdminAiEntitlement>
        className="ai-config-table"
        rowKey="id"
        pagination={false}
        dataSource={entitlements}
        scroll={{ x: 680 }}
        columns={[
          {
            title: '角色',
            dataIndex: 'roleCode',
            render: (code: string) => roleLabels[code] ?? code,
          },
          {
            title: '模型范围',
            render: (_, row) =>
              row.allowedModelIds.length === 0
                ? '全部模型（含后续新增）'
                : `指定 ${row.allowedModelIds.length} 个模型`,
          },
          {
            title: '操作',
            render: (_, row) => (
              <Button type="link" disabled={!canManage} onClick={() => open(row)}>
                {focusModel && !modelAllowedForRole(row, focusModel.id) ? '授权模型' : '编辑权限'}
              </Button>
            ),
          },
          ...(focusModel
            ? [
                {
                  title: '当前模型授权状态',
                  render: (_: unknown, row: AdminAiEntitlement) =>
                    modelAllowedForRole(row, focusModel.id) ? '已授权' : '未授权',
                },
              ]
            : []),
        ]}
      />
      <Drawer
        open={Boolean(editing)}
        onClose={() => setEditing(undefined)}
        title={`模型访问权限 · ${roleLabels[editing?.roleCode ?? ''] ?? editing?.roleCode ?? ''}`}
        extra={
          <Button type="primary" loading={saving} onClick={() => void save()}>
            保存
          </Button>
        }
      >
        <Space orientation="vertical" style={{ width: '100%' }}>
          <Alert
            type="warning"
            showIcon
            title="授权范围说明"
            description="全部模型：包含当前及后续新增模型。指定模型：仅授权所选模型。修改将在保存后生效。"
          />
          <Form layout="vertical">
            <Form.Item label="允许访问全部模型">
              <Switch checked={unrestricted} onChange={setUnrestricted} />
            </Form.Item>
            <Form.Item label="授权模型" required={!unrestricted}>
              <Select
                mode="multiple"
                style={{ width: '100%' }}
                disabled={unrestricted}
                value={modelIds}
                onChange={setModelIds}
                options={models.map((model) => ({
                  value: model.id,
                  label: `${model.displayName} · ${model.providerName}${model.enabled && model.visibleToUser ? '' : '（当前不可用）'}`,
                }))}
              />
            </Form.Item>
          </Form>
        </Space>
      </Drawer>
    </>
  );
}
