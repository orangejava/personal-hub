import { ProTable } from '@ant-design/pro-components';
import { useRequest } from '@/hooks/useRequest';
import type {
  AdminAiBrandingConfig,
  AdminAiModelConfig,
  AdminAiProviderConfig,
  AdminAiToolConfig,
  AiToolStatus,
} from '@personal-hub/shared-types';

import {
  App,
  Card,
  Drawer,
  Form,
  Input,
  InputNumber,
  Popconfirm,
  Segmented,
  Select,
  Space,
  Switch,
  Tag,
  Button,
} from 'antd';
import React, { useMemo, useState } from 'react';
import { ErrorState, PageContainer, SectionSkeleton } from '@/components/shared';
import {
  createAdminAiModelConfig,
  deleteAdminAiModelConfig,
  fetchAdminAiConfig,
  moveAdminAiToolSort,
  updateAdminAiBrandingConfig,
  updateAdminAiModelConfig,
  updateAdminAiProviderConfig,
  updateAdminAiToolConfig,
  updateAdminAiToolStatus,
} from '@/services/admin';
import AiConfigSummaryCards from './SummaryCards';
import { aiToolTypeOptions, toolStatusLabels } from './constants';

/** 后台 AI 配置：阶段 5 先展示 mock 厂商、模型和工具启停契约。 */
const AiConfig: React.FC = () => {
  const { message } = App.useApp();
  const [providerForm] = Form.useForm<
    AdminAiProviderConfig & { apiKey?: string }
  >();
  const [brandingForm] = Form.useForm<AdminAiBrandingConfig>();
  const [modelForm] = Form.useForm<AdminAiModelConfig>();
  const [toolForm] = Form.useForm<AdminAiToolConfig>();
  const [section, setSection] = useState<'branding' | 'providers' | 'models' | 'tools'>('branding');
  const [savingToolCode, setSavingToolCode] = useState<string>();
  const [movingToolCode, setMovingToolCode] = useState<string>();
  const [editingProvider, setEditingProvider] =
    useState<AdminAiProviderConfig | null>(null);
  const [editingBranding, setEditingBranding] =
    useState<AdminAiBrandingConfig | null>(null);
  const [editingModel, setEditingModel] = useState<AdminAiModelConfig | null>(null);
  const [creatingModel, setCreatingModel] = useState(false);
  const [editingTool, setEditingTool] = useState<AdminAiToolConfig | null>(null);
  const [savingProvider, setSavingProvider] = useState(false);
  const [savingBranding, setSavingBranding] = useState(false);
  const [savingModel, setSavingModel] = useState(false);
  const [deletingModelId, setDeletingModelId] = useState<string>();
  const [savingTool, setSavingTool] = useState(false);
  const { data, loading, error, run } = useRequest(fetchAdminAiConfig);

  const enabledProviderCount = useMemo(
    () => data?.providers.filter((item) => item.enabled).length ?? 0,
    [data?.providers],
  );
  const visibleModelCount = useMemo(
    () => data?.models.filter((item) => item.visibleToUser && item.enabled).length ?? 0,
    [data?.models],
  );
  const enabledToolCount = useMemo(
    () => data?.tools.filter((item) => item.status === 'enabled').length ?? 0,
    [data?.tools],
  );
  const toolModelOptions = useMemo(() => {
    if (!editingTool) return [];
    return (data?.models ?? [])
      .filter(
        (model) =>
          model.enabled &&
          model.visibleToUser &&
          model.toolTypes.includes(editingTool.code),
      )
      .map((model) => ({
        label: `${model.displayName} · ${model.providerName}`,
        value: model.modelId,
      }));
  }, [data?.models, editingTool]);
  const providerOptions = useMemo(
    () =>
      (data?.providers ?? []).map((provider) => ({
        label: provider.name,
        value: provider.code,
      })),
    [data?.providers],
  );

  const openBrandingDrawer = () => {
    if (!data?.branding) return;
    setEditingBranding(data.branding);
    brandingForm.setFieldsValue(data.branding);
  };

  const closeBrandingDrawer = () => {
    setEditingBranding(null);
    brandingForm.resetFields();
  };

  if (error) {
    return (
      <PageContainer title="AI 配置">
        <ErrorState title="AI 配置加载失败" onRetry={run} />
      </PageContainer>
    );
  }

  if (loading && !data) {
    return (
      <PageContainer title="AI 配置">
        <SectionSkeleton variant="card" count={3} columns={3} />
      </PageContainer>
    );
  }

  /**
   * 保存 AI 工具启停状态。
   *
   * 阶段 5 先只开放状态字段，用于验证后台配置能影响用户端工具入口；
   * 默认模型、计费和排序后续接真实后端时再扩展表单。
   */
  const handleToolStatusChange = async (
    code: AdminAiToolConfig['code'],
    status: AiToolStatus,
  ) => {
    setSavingToolCode(code);
    try {
      await updateAdminAiToolStatus(code, { status });
      await run();
      message.success('AI 工具状态已保存');
    } finally {
      setSavingToolCode(undefined);
    }
  };

  const openProviderDrawer = (provider: AdminAiProviderConfig) => {
    setEditingProvider(provider);
    providerForm.setFieldsValue({ ...provider, apiKey: undefined });
  };

  const closeProviderDrawer = () => {
    setEditingProvider(null);
    providerForm.resetFields();
  };

  const openModelDrawer = (model: AdminAiModelConfig) => {
    setCreatingModel(false);
    setEditingModel(model);
    modelForm.setFieldsValue(model);
  };

  const openCreateModelDrawer = () => {
    setCreatingModel(true);
    setEditingModel(null);
    modelForm.setFieldsValue({
      enabled: true,
      visibleToUser: true,
      isDefault: false,
      contextTokens: 8192,
      inputPricePer1k: 0,
      outputPricePer1k: 0,
      toolTypes: ['chat'],
    });
  };

  const closeModelDrawer = () => {
    setEditingModel(null);
    setCreatingModel(false);
    modelForm.resetFields();
  };

  const openToolDrawer = (tool: AdminAiToolConfig) => {
    setEditingTool(tool);
    toolForm.setFieldsValue(tool);
  };

  const closeToolDrawer = () => {
    setEditingTool(null);
    toolForm.resetFields();
  };

  /**
   * 保存 AI 厂商基础配置。
   *
   * API Key 在 mock 阶段也按真实产品处理成只写字段；
   * 留空表示不修改，接口响应只展示脱敏后的 `apiKeyMasked`。
   */
  const handleProviderSave = async () => {
    if (!editingProvider) return;
    const values = await providerForm.validateFields();
    setSavingProvider(true);
    try {
      await updateAdminAiProviderConfig(editingProvider.code, {
        name: values.name,
        baseUrl: values.baseUrl,
        apiKey: values.apiKey,
        enabled: values.enabled,
      });
      await run();
      message.success('AI 厂商配置已保存');
      closeProviderDrawer();
    } finally {
      setSavingProvider(false);
    }
  };

  /** 保存 AI 品牌配置，用户端 AI Layout 会通过首页配置读取最新品牌名。 */
  const handleBrandingSave = async () => {
    const values = await brandingForm.validateFields();
    setSavingBranding(true);
    try {
      await updateAdminAiBrandingConfig({
        brandName: values.brandName,
        logoText: values.logoText,
      });
      await run();
      message.success('AI 品牌配置已保存');
      closeBrandingDrawer();
    } finally {
      setSavingBranding(false);
    }
  };

  /**
   * 保存 AI 模型基础配置。
   *
   * 阶段 5 先开放用户端会直接感知的字段：启用、可见、默认、名称、上下文和计费；
   * 厂商、模型 ID、支持工具仍只展示，避免 mock 阶段引入复杂迁移。
   */
  const handleModelSave = async () => {
    const values = await modelForm.validateFields();
    setSavingModel(true);
    try {
      if (creatingModel) {
        await createAdminAiModelConfig({
          modelId: values.modelId,
          displayName: values.displayName,
          providerCode: values.providerCode,
          toolTypes: values.toolTypes,
          enabled: values.enabled,
          visibleToUser: values.visibleToUser,
          isDefault: values.isDefault,
          contextTokens: values.contextTokens,
          inputPricePer1k: values.inputPricePer1k,
          outputPricePer1k: values.outputPricePer1k,
        });
      } else if (editingModel) {
        await updateAdminAiModelConfig(editingModel.id, {
          displayName: values.displayName,
          enabled: values.enabled,
          visibleToUser: values.visibleToUser,
          isDefault: values.isDefault,
          contextTokens: values.contextTokens,
          inputPricePer1k: values.inputPricePer1k,
          outputPricePer1k: values.outputPricePer1k,
        });
      }
      await run();
      message.success(creatingModel ? 'AI 模型已新增' : 'AI 模型配置已保存');
      closeModelDrawer();
    } finally {
      setSavingModel(false);
    }
  };

  /** 删除 AI 模型配置，mock 层会同步清理工具默认模型引用。 */
  const handleModelDelete = async (model: AdminAiModelConfig) => {
    setDeletingModelId(model.id);
    try {
      await deleteAdminAiModelConfig(model.id);
      await run();
      message.success('AI 模型已删除');
    } finally {
      setDeletingModelId(undefined);
    }
  };

  /**
   * 保存 AI 工具配置。
   *
   * 这里保存的是用户端首页和 AI Layout 会直接读取的字段；
   * 后续真实后端接入时可继续沿用该 service 契约扩展排序和权限。
   */
  const handleToolSave = async () => {
    if (!editingTool) return;
    const values = await toolForm.validateFields();
    setSavingTool(true);
    try {
      await updateAdminAiToolConfig(editingTool.code, {
        status: values.status,
        defaultModelId: values.defaultModelId,
        tokenCostLabel: values.tokenCostLabel,
        guestTrialEnabled: values.guestTrialEnabled,
        sort: values.sort,
      });
      await run();
      message.success('AI 工具配置已保存');
      closeToolDrawer();
    } finally {
      setSavingTool(false);
    }
  };

  /**
   * 移动 AI 工具展示顺序。
   *
   * 阶段 5 先采用相邻上移/下移，用户端 `/api/ai/home` 会按排序后的
   * mock 配置返回工具卡片，后续接真实后端时可替换为拖拽排序。
   */
  const handleToolMove = async (
    code: AdminAiToolConfig['code'],
    direction: 'up' | 'down',
  ) => {
    setMovingToolCode(code);
    try {
      await moveAdminAiToolSort(code, direction);
      await run();
      message.success('AI 工具排序已保存');
    } finally {
      setMovingToolCode(undefined);
    }
  };

  return (
    <PageContainer title="AI 配置">
      <AiConfigSummaryCards
        branding={data?.branding}
        enabledProviderCount={enabledProviderCount}
        providerCount={data?.providers.length ?? 0}
        visibleModelCount={visibleModelCount}
        modelCount={data?.models.length ?? 0}
        enabledToolCount={enabledToolCount}
        toolCount={data?.tools.length ?? 0}
        onEditBranding={openBrandingDrawer}
      />

      <Card style={{ marginTop: 16 }}>
        <Segmented
          value={section}
          onChange={(value) => setSection(value as typeof section)}
          options={[
            { label: '品牌设置', value: 'branding' },
            { label: '厂商管理', value: 'providers' },
            { label: '模型管理', value: 'models' },
            { label: '工具配置', value: 'tools' },
          ]}
          style={{ marginBottom: 16 }}
        />

        {section === 'branding' && (
          <ProTable<AdminAiBrandingConfig>
            rowKey="brandName"
            search={false}
            pagination={false}
            dataSource={data?.branding ? [data.branding] : []}
            columns={[
              { title: '品牌名', dataIndex: 'brandName' },
              { title: 'Logo 文案', dataIndex: 'logoText' },
              { title: '更新时间', dataIndex: 'updatedAt', valueType: 'dateTime' },
              {
                title: '操作',
                valueType: 'option',
                render: () => [
                  <Button key="edit" size="small" type="link" onClick={openBrandingDrawer}>
                    编辑
                  </Button>,
                ],
              },
            ]}
          />
        )}

        {section === 'providers' && (
          <ProTable<AdminAiProviderConfig>
            rowKey="code"
            search={false}
            pagination={false}
            dataSource={data?.providers ?? []}
            columns={[
              { title: '厂商标识', dataIndex: 'code' },
              { title: '展示名称', dataIndex: 'name' },
              { title: 'Base URL', dataIndex: 'baseUrl', ellipsis: true },
              { title: 'API Key', dataIndex: 'apiKeyMasked' },
              {
                title: '启用状态',
                dataIndex: 'enabled',
                render: (_, record) => (
                  <Switch
                    checked={record.enabled}
                    checkedChildren="启用"
                    unCheckedChildren="禁用"
                    disabled
                  />
                ),
              },
              { title: '更新时间', dataIndex: 'updatedAt', valueType: 'dateTime' },
              {
                title: '操作',
                valueType: 'option',
                render: (_, record) => [
                  <Button
                    key="edit"
                    size="small"
                    type="link"
                    onClick={() => openProviderDrawer(record)}
                  >
                    编辑
                  </Button>,
                ],
              },
            ]}
          />
        )}

        {section === 'models' && (
          <ProTable<AdminAiModelConfig>
            rowKey="id"
            search={false}
            pagination={false}
            toolBarRender={() => [
              <Button key="create" type="primary" onClick={openCreateModelDrawer}>
                新增模型
              </Button>,
            ]}
            dataSource={data?.models ?? []}
            columns={[
              {
                title: '模型',
                dataIndex: 'displayName',
                render: (_, record) => (
                  <div>
                    <span>{record.displayName}</span>
                    <div style={{ color: '#667085', fontSize: 12 }}>{record.modelId}</div>
                  </div>
                ),
              },
              { title: '厂商', dataIndex: 'providerName' },
              {
                title: '支持工具',
                dataIndex: 'toolTypes',
                render: (_, record) =>
                  record.toolTypes.map((toolType) => <Tag key={toolType}>{toolType}</Tag>),
              },
              {
                title: '状态',
                dataIndex: 'enabled',
                render: (_, record) => (
                  <Space>
                    <Tag color={record.enabled ? 'success' : 'default'}>
                      {record.enabled ? '可用' : '停用'}
                    </Tag>
                    {record.visibleToUser ? (
                      <Tag color="blue">用户可见</Tag>
                    ) : (
                      <Tag>后台可见</Tag>
                    )}
                    {record.isDefault ? <Tag color="gold">默认</Tag> : null}
                  </Space>
                ),
              },
              {
                title: '上下文',
                dataIndex: 'contextTokens',
                render: (_, record) => `${record.contextTokens.toLocaleString()} tokens`,
              },
              {
                title: '价格',
                dataIndex: 'price',
                render: (_, record) =>
                  `输入 ¥${record.inputPricePer1k}/1K，输出 ¥${record.outputPricePer1k}/1K`,
              },
              {
                title: '操作',
                valueType: 'option',
                render: (_, record) => [
                  <Button
                    key="edit"
                    size="small"
                    type="link"
                    onClick={() => openModelDrawer(record)}
                  >
                    编辑
                  </Button>,
                  <Popconfirm
                    key="delete"
                    title="删除模型"
                    description="删除后用户端将不再看到该模型，相关工具默认模型会自动回落。"
                    okText="删除"
                    okButtonProps={{ danger: true, loading: deletingModelId === record.id }}
                    cancelText="取消"
                    onConfirm={() => handleModelDelete(record)}
                  >
                    <Button danger size="small" type="link">
                      删除
                    </Button>
                  </Popconfirm>,
                ],
              },
            ]}
          />
        )}

        {section === 'tools' && (
          <ProTable<AdminAiToolConfig>
            rowKey="code"
            search={false}
            pagination={false}
            dataSource={[...(data?.tools ?? [])].sort((a, b) => a.sort - b.sort)}
            columns={[
              { title: '排序', dataIndex: 'sort', width: 80 },
              { title: '工具', dataIndex: 'name' },
              { title: '标识', dataIndex: 'code' },
              {
                title: '状态',
                dataIndex: 'status',
                render: (_, record) => {
                  const status = toolStatusLabels[record.status];
                  return (
                    <Space>
                      <Tag color={status.color}>{status.text}</Tag>
                      <Select
                        aria-label={`设置 ${record.name} 状态`}
                        options={[
                          { label: '已启用', value: 'enabled' },
                          { label: '即将上线', value: 'comingSoon' },
                          { label: '已禁用', value: 'disabled' },
                        ]}
                        popupMatchSelectWidth={false}
                        size="small"
                        value={record.status}
                        loading={savingToolCode === record.code}
                        disabled={savingToolCode === record.code}
                        onChange={(value) =>
                          handleToolStatusChange(record.code, value)
                        }
                      />
                    </Space>
                  );
                },
              },
              {
                title: '默认模型',
                dataIndex: 'defaultModelId',
                renderText: (value) => value || '待配置',
              },
              { title: '计费说明', dataIndex: 'tokenCostLabel' },
              {
                title: '访客试用',
                dataIndex: 'guestTrialEnabled',
                render: (_, record) => (
                  <Tag color={record.guestTrialEnabled ? 'blue' : 'default'}>
                    {record.guestTrialEnabled ? '允许' : '不允许'}
                  </Tag>
                ),
              },
              {
                title: '操作',
                valueType: 'option',
                render: (_, record, index) => {
                  const isMoving = movingToolCode === record.code;
                  const toolCount = data?.tools.length ?? 0;
                  return [
                    <Button
                      disabled={index === 0 || Boolean(movingToolCode)}
                      key="up"
                      loading={isMoving}
                      size="small"
                      type="link"
                      onClick={() => handleToolMove(record.code, 'up')}
                    >
                      上移
                    </Button>,
                    <Button
                      disabled={index === toolCount - 1 || Boolean(movingToolCode)}
                      key="down"
                      loading={isMoving}
                      size="small"
                      type="link"
                      onClick={() => handleToolMove(record.code, 'down')}
                    >
                      下移
                    </Button>,
                    <Button
                      key="edit"
                      size="small"
                      type="link"
                      onClick={() => openToolDrawer(record)}
                    >
                      编辑
                    </Button>,
                  ];
                },
              },
            ]}
          />
        )}
      </Card>

      <Drawer
        destroyOnHidden
        footer={
          <Space>
            <Button onClick={closeBrandingDrawer}>取消</Button>
            <Button loading={savingBranding} type="primary" onClick={handleBrandingSave}>
              保存
            </Button>
          </Space>
        }
        open={Boolean(editingBranding)}
        size="large"
        title="编辑 AI 品牌"
        onClose={closeBrandingDrawer}
      >
        {editingBranding && (
          <Form form={brandingForm} layout="vertical">
            <Form.Item
              label="AI 品牌名"
              name="brandName"
              rules={[{ required: true, message: '请输入 AI 品牌名' }]}
            >
              <Input maxLength={40} placeholder="例如 Personal Hub AI" showCount />
            </Form.Item>
            <Form.Item
              label="Logo 文案"
              name="logoText"
              rules={[{ required: true, message: '请输入 Logo 文案' }]}
            >
              <Input maxLength={12} placeholder="例如 PH AI" showCount />
            </Form.Item>
          </Form>
        )}
      </Drawer>

      <Drawer
        destroyOnHidden
        footer={
          <Space>
            <Button onClick={closeProviderDrawer}>取消</Button>
            <Button loading={savingProvider} type="primary" onClick={handleProviderSave}>
              保存
            </Button>
          </Space>
        }
        open={Boolean(editingProvider)}
        size="large"
        title="编辑厂商配置"
        onClose={closeProviderDrawer}
      >
        {editingProvider && (
          <Form form={providerForm} layout="vertical">
            <Form.Item label="厂商标识">
              <Input disabled value={editingProvider.code} />
            </Form.Item>
            <Form.Item
              label="展示名称"
              name="name"
              rules={[{ required: true, message: '请输入厂商展示名称' }]}
            >
              <Input maxLength={40} placeholder="例如 阿里云百炼" showCount />
            </Form.Item>
            <Form.Item
              label="Base URL"
              name="baseUrl"
              rules={[{ required: true, message: '请输入 Base URL' }]}
            >
              <Input placeholder="https://api.example.com" />
            </Form.Item>
            <Form.Item label="当前 API Key">
              <Input disabled value={editingProvider.apiKeyMasked} />
            </Form.Item>
            <Form.Item label="新 API Key" name="apiKey">
              <Input.Password placeholder="留空表示不修改当前 Key" />
            </Form.Item>
            <Form.Item label="启用厂商" name="enabled" valuePropName="checked">
              <Switch checkedChildren="启用" unCheckedChildren="停用" />
            </Form.Item>
          </Form>
        )}
      </Drawer>

      <Drawer
        destroyOnHidden
        footer={
          <Space>
            <Button onClick={closeModelDrawer}>取消</Button>
            <Button loading={savingModel} type="primary" onClick={handleModelSave}>
              保存
            </Button>
          </Space>
        }
        open={creatingModel || Boolean(editingModel)}
        size="large"
        title={creatingModel ? '新增模型配置' : '编辑模型配置'}
        onClose={closeModelDrawer}
      >
        {(creatingModel || editingModel) && (
          <Form form={modelForm} layout="vertical">
            {creatingModel ? (
              <>
                <Form.Item
                  label="模型 ID"
                  name="modelId"
                  rules={[{ required: true, message: '请输入模型 ID' }]}
                >
                  <Input placeholder="例如 qwen-max" />
                </Form.Item>
                <Form.Item
                  label="厂商"
                  name="providerCode"
                  rules={[{ required: true, message: '请选择厂商' }]}
                >
                  <Select options={providerOptions} placeholder="选择厂商" />
                </Form.Item>
                <Form.Item
                  label="支持工具"
                  name="toolTypes"
                  rules={[{ required: true, message: '请选择至少一个支持工具' }]}
                >
                  <Select
                    mode="multiple"
                    options={aiToolTypeOptions}
                    placeholder="选择工具类型"
                  />
                </Form.Item>
              </>
            ) : (
              <>
                <Form.Item label="模型 ID">
                  <Input disabled value={editingModel?.modelId} />
                </Form.Item>
                <Form.Item label="厂商">
                  <Input disabled value={editingModel?.providerName} />
                </Form.Item>
                <Form.Item label="支持工具">
                  <Select
                    disabled
                    mode="multiple"
                    options={aiToolTypeOptions}
                    value={editingModel?.toolTypes}
                  />
                </Form.Item>
              </>
            )}
            <Form.Item
              label="展示名称"
              name="displayName"
              rules={[{ required: true, message: '请输入模型展示名称' }]}
            >
              <Input maxLength={40} placeholder="例如 Qwen Turbo" showCount />
            </Form.Item>
            <Form.Item label="启用模型" name="enabled" valuePropName="checked">
              <Switch checkedChildren="启用" unCheckedChildren="停用" />
            </Form.Item>
            <Form.Item label="用户可见" name="visibleToUser" valuePropName="checked">
              <Switch checkedChildren="可见" unCheckedChildren="隐藏" />
            </Form.Item>
            <Form.Item label="设为默认模型" name="isDefault" valuePropName="checked">
              <Switch checkedChildren="默认" unCheckedChildren="普通" />
            </Form.Item>
            <Form.Item
              label="上下文 Tokens"
              name="contextTokens"
              rules={[{ required: true, message: '请输入上下文长度' }]}
            >
              <InputNumber min={1} precision={0} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item
              label="输入价格（¥ / 1K Tokens）"
              name="inputPricePer1k"
              rules={[{ required: true, message: '请输入输入价格' }]}
            >
              <InputNumber min={0} precision={6} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item
              label="输出价格（¥ / 1K Tokens）"
              name="outputPricePer1k"
              rules={[{ required: true, message: '请输入输出价格' }]}
            >
              <InputNumber min={0} precision={6} style={{ width: '100%' }} />
            </Form.Item>
          </Form>
        )}
      </Drawer>

      <Drawer
        destroyOnHidden
        footer={
          <Space>
            <Button onClick={closeToolDrawer}>取消</Button>
            <Button loading={savingTool} type="primary" onClick={handleToolSave}>
              保存
            </Button>
          </Space>
        }
        open={Boolean(editingTool)}
        size="large"
        title="编辑工具配置"
        onClose={closeToolDrawer}
      >
        {editingTool && (
          <Form form={toolForm} layout="vertical">
            <Form.Item label="工具标识">
              <Input disabled value={editingTool.code} />
            </Form.Item>
            <Form.Item label="工具名称">
              <Input disabled value={editingTool.name} />
            </Form.Item>
            <Form.Item
              label="展示顺序"
              name="sort"
              rules={[{ required: true, message: '请输入展示顺序' }]}
            >
              <InputNumber min={1} precision={0} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item
              label="工具状态"
              name="status"
              rules={[{ required: true, message: '请选择工具状态' }]}
            >
              <Select
                options={[
                  { label: '已启用', value: 'enabled' },
                  { label: '即将上线', value: 'comingSoon' },
                  { label: '已禁用', value: 'disabled' },
                ]}
              />
            </Form.Item>
            <Form.Item label="默认模型" name="defaultModelId">
              <Select
                allowClear
                options={toolModelOptions}
                placeholder={
                  toolModelOptions.length > 0
                    ? '选择默认模型'
                    : '当前工具暂无可用模型'
                }
              />
            </Form.Item>
            <Form.Item
              label="计费说明"
              name="tokenCostLabel"
              rules={[{ required: true, message: '请输入计费说明' }]}
            >
              <Input maxLength={40} placeholder="例如 500 Token / 次" showCount />
            </Form.Item>
            <Form.Item label="允许访客试用" name="guestTrialEnabled" valuePropName="checked">
              <Switch checkedChildren="允许" unCheckedChildren="不允许" />
            </Form.Item>
          </Form>
        )}
      </Drawer>
    </PageContainer>
  );
};

export default AiConfig;
