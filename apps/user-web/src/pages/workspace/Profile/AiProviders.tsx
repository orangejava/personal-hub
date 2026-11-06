import { App, Alert, Button, Card, Form, Input, List, Modal, Select, Space, Switch, Tag, Typography } from 'antd';
import React, { useState } from 'react';
import { useRequest } from '@/hooks/useRequest';
import {
  AiCredentialLocalError, deleteAiUserProvider, disableAiUserModel, fetchAiUserProviders,
  fetchAiSystemProviders, saveAiProviderPreference, saveAiUserModel, saveAiUserProvider,
  testAiUserProvider,
} from '@/services/ai';
import type { AiUserProviderState } from '@personal-hub/shared-types';

type Credential = AiUserProviderState['credentials'][number];
type Model = AiUserProviderState['models'][number];
type CredentialForm = { code?: string; label?: string; providerId?: string; baseUrl?: string; apiKey?: string; enabled: boolean };
type ModelForm = { credentialId: string; modelKey: string; displayName: string; enabled: boolean };

const AiProviders: React.FC = () => {
  const { message, modal } = App.useApp();
  const { data, loading, run } = useRequest(fetchAiUserProviders);
  const { data: systemProviders } = useRequest(fetchAiSystemProviders);
  const [credentialForm] = Form.useForm<CredentialForm>();
  const [modelForm] = Form.useForm<ModelForm>();
  const [editingCredential, setEditingCredential] = useState<Credential>();
  const [editingModel, setEditingModel] = useState<Model>();
  const [credentialOpen, setCredentialOpen] = useState(false);
  const [modelOpen, setModelOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [target, setTarget] = useState<'custom' | 'system'>('custom');
  const openCredential = (row?: Credential) => {
    setEditingCredential(row);
    setTarget(row?.providerId ? 'system' : 'custom');
    credentialForm.setFieldsValue({
      providerId: row?.providerId ?? undefined, code: row?.code ?? undefined,
      label: row?.label ?? undefined, baseUrl: row?.baseUrl ?? undefined,
      enabled: row?.enabled ?? true, apiKey: undefined,
    });
    setCredentialOpen(true);
  };

  const saveCredential = async () => {
    const values = await credentialForm.validateFields();
    setSaving(true);
    try {
      await saveAiUserProvider({ id: editingCredential?.id, ...values,
        providerId: target === 'system' ? values.providerId : undefined,
        code: target === 'custom' ? values.code : undefined,
        label: target === 'custom' ? values.label : undefined,
        baseUrl: target === 'custom' ? values.baseUrl : undefined,
      });
      setCredentialOpen(false);
      credentialForm.resetFields();
      await run();
      message.success('厂商已保存');
    } catch (error) {
      // 请求错误由全局处理；浏览器加密发生在请求前，需要在此反馈。
      if (error instanceof AiCredentialLocalError) message.error(error.message);
    } finally { setSaving(false); }
  };

  const saveModel = async () => {
    const values = await modelForm.validateFields();
    setSaving(true);
    try {
      await saveAiUserModel({ id: editingModel?.id, ...values });
      setModelOpen(false);
      modelForm.resetFields();
      await run();
      message.success('模型已保存');
    } catch {
      // 全局错误提示。
    } finally { setSaving(false); }
  };

  const changeMode = async (enabled: boolean, preferredUserModelId = data?.preferredUserModelId ?? null) => {
    try {
      await saveAiProviderPreference(enabled, preferredUserModelId);
      await run();
      message.success('自备模式设置已更新');
    } catch { /* 全局错误提示。 */ }
  };

  const removeCredential = (row: Credential) => {
    modal.confirm({ title: `删除 ${row.label ?? row.code}？`, content: '历史会话和用量保留，关联模型将不能继续调用。',
      onOk: async () => { await deleteAiUserProvider(row.id); await run(); },
    });
  };

  const removeModel = (row: Model) => {
    modal.confirm({ title: `停用 ${row.displayName}？`,
      onOk: async () => { await disableAiUserModel(row.id); await run(); },
    });
  };

  return <Card title="AI 自备厂商与模型" loading={loading}>
    {!data?.allowed && <Alert type="warning" showIcon title="管理员已暂停自备能力，配置仍会保留" style={{ marginBottom: 16 }} />}
    <Space wrap style={{ marginBottom: 16 }}>
      <Switch checked={Boolean(data?.enabled)} disabled={!data?.allowed && !data?.enabled} onChange={(value) => changeMode(value)} />
      <span>自备模式</span>
      <Button disabled={!data?.allowed} onClick={() => openCredential()}>添加厂商</Button>
      <Button disabled={!data?.allowed || !data?.credentials.some((row) => !row.providerId)} onClick={() => {
        setEditingModel(undefined);
        modelForm.resetFields();
        modelForm.setFieldsValue({ credentialId: data?.credentials.find((row) => !row.providerId)?.id, enabled: true });
        setModelOpen(true);
      }}>添加文本模型</Button>
    </Space>
    <List dataSource={data?.credentials ?? []} locale={{ emptyText: '尚未添加厂商' }} renderItem={(row) => <List.Item
      actions={[
        <Button key="test" type="link" disabled={!data?.allowed} onClick={async () => {
          try { const result = await testAiUserProvider(row.id); message.success(result.message); } catch { /* 全局错误提示。 */ }
        }}>测试连接</Button>,
        <Button key="edit" type="link" disabled={!data?.allowed} onClick={() => openCredential(row)}>编辑</Button>,
        <Button key="delete" type="link" danger disabled={!data?.allowed} onClick={() => removeCredential(row)}>删除</Button>,
      ]}>
      <List.Item.Meta title={<Space>{row.label ?? row.code}<Tag>{row.providerId ? '系统厂商 Key' : '自建厂商'}</Tag>{!row.enabled && <Tag>已停用</Tag>}</Space>}
        description={<Typography.Text style={{ overflowWrap: 'anywhere' }}>{row.baseUrl ?? '使用系统厂商地址'} · Key 已保存</Typography.Text>} />
    </List.Item>} />
    <Typography.Title level={5} style={{ marginTop: 20 }}>自建文本模型</Typography.Title>
    <List dataSource={data?.models ?? []} locale={{ emptyText: '尚未添加模型' }} renderItem={(row) => <List.Item actions={[
      <Button key="edit" type="link" disabled={!data?.allowed} onClick={() => {
        setEditingModel(row); modelForm.setFieldsValue({ credentialId: row.credentialId ?? '', modelKey: row.modelKey, displayName: row.displayName, enabled: row.enabled }); setModelOpen(true);
      }}>编辑</Button>,
      <Button key="disable" type="link" danger disabled={!data?.allowed || !row.enabled} onClick={() => removeModel(row)}>停用</Button>,
    ]}>
      <List.Item.Meta title={<Space>{row.displayName}{!row.enabled && <Tag>已停用</Tag>}</Space>} description={row.modelKey} />
    </List.Item>} />
    <Select style={{ width: '100%', maxWidth: 360, marginTop: 12 }} placeholder="首选自建模型" allowClear
      value={data?.preferredUserModelId ?? undefined} disabled={!data?.allowed}
      options={(data?.models ?? []).filter((row) => row.enabled && row.credentialId).map((row) => ({ label: row.displayName, value: row.id }))}
      onChange={(id) => changeMode(Boolean(data?.enabled), id ?? null)} />
    <Modal title={editingCredential ? '编辑厂商' : '添加厂商'} open={credentialOpen} confirmLoading={saving} onOk={saveCredential} onCancel={() => setCredentialOpen(false)} destroyOnHidden>
      <Form form={credentialForm} layout="vertical">
        {!editingCredential && <Select value={target} onChange={setTarget} style={{ width: '100%', marginBottom: 16 }} options={[{ label: '自建厂商', value: 'custom' }, { label: '系统厂商 Key', value: 'system' }]} />}
        {target === 'system' ? <Form.Item name="providerId" label="系统厂商" rules={[{ required: true }]}><Select disabled={Boolean(editingCredential)} options={(systemProviders ?? []).map((row) => ({ value: row.id, label: row.label }))} /></Form.Item> : <>
          <Form.Item name="code" label="厂商代号" rules={[{ required: true }, { pattern: /^[a-z][a-z0-9_-]{1,79}$/ }]}><Input disabled={Boolean(editingCredential)} /></Form.Item>
          <Form.Item name="label" label="名称" rules={[{ required: true }]}><Input maxLength={120} /></Form.Item>
          <Form.Item name="baseUrl" label="HTTPS Base URL" rules={[{ required: true }, { type: 'url' }]}><Input placeholder="https://example.com/v1" /></Form.Item>
        </>}
        <Form.Item name="apiKey" label="API Key" rules={[{ required: !editingCredential }]}><Input.Password autoComplete="off" placeholder={editingCredential ? '留空则保留原 Key' : '输入 API Key'} /></Form.Item>
        <Form.Item name="enabled" label="启用" valuePropName="checked"><Switch /></Form.Item>
      </Form>
    </Modal>
    <Modal title={editingModel ? '编辑文本模型' : '添加文本模型'} open={modelOpen} confirmLoading={saving} onOk={saveModel} onCancel={() => setModelOpen(false)} destroyOnHidden>
      <Form form={modelForm} layout="vertical">
        <Form.Item name="credentialId" label="所属厂商" rules={[{ required: true }]}><Select disabled={Boolean(editingModel)} options={(data?.credentials ?? []).filter((row) => !row.providerId).map((row) => ({ value: row.id, label: row.label ?? row.code }))} /></Form.Item>
        <Form.Item name="modelKey" label="模型标识" rules={[{ required: true }]}><Input maxLength={120} /></Form.Item>
        <Form.Item name="displayName" label="显示名" rules={[{ required: true }]}><Input maxLength={120} /></Form.Item>
        <Form.Item name="enabled" label="启用" valuePropName="checked"><Switch /></Form.Item>
      </Form>
    </Modal>
  </Card>;
};

export default AiProviders;
