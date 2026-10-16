import { ProTable } from '@ant-design/pro-components';
import { useRequest } from '@/hooks/useRequest';
import type {
  AdminAiBrandingConfig,
  AdminAiModelConfig,
  AdminAiNavigationItem,
  AdminAiProviderConfig,
  AdminAiToolConfig,
  AiToolStatus,
} from '@personal-hub/shared-types';

import {
  App,
  Alert,
  Card,
  Drawer,
  Form,
  Input,
  InputNumber,
  Segmented,
  Select,
  Space,
  Switch,
  Tag,
  Button,
} from 'antd';
import React, { useEffect, useMemo, useState } from 'react';
import { ErrorState, PageContainer, SectionSkeleton } from '@/components/shared';
import {
  createAdminAiProviderConfig,
  createAdminAiModelConfig,
  fetchAdminAiConfig,
  moveAdminAiToolSort,
  updateAdminAiBrandingConfig,
  updateAdminAiModelConfig,
  updateAdminAiNavigationItem,
  testAdminAiProvider,
  updateAdminAiProviderConfig,
  updateAdminAiToolConfig,
  updateAdminAiToolStatus,
} from '@/services/admin';
import AiConfigSummaryCards from './SummaryCards';
import ModelEntitlements, { modelAllowedForRole, roleLabels } from './ModelEntitlements';
import { aiToolTypeOptions, navGroupLabels, toolStatusLabels } from './constants';
import './index.less';

/** 模型能力只对应库里的 AiToolCode。WebUI / LoRA 不是模型列。 */
const modelToolTypeOptions = aiToolTypeOptions.filter(
  (item) =>
    item.value === 'chat' ||
    item.value === 'text' ||
    item.value === 'image' ||
    item.value === 'video',
);

const modalityOptions = [
  { label: '文本', value: 'text' },
  { label: '图片', value: 'image' },
  { label: '视频', value: 'video' },
  { label: '多模态', value: 'multimodal' },
];

/** 密钥列只显示是否已保存，不展示掩码。 */
function providerKeyStatus(hasKey: boolean): string {
  return hasKey ? '已配置' : '未配置';
}

/** 后台 AI 配置：品牌、导航、厂商、模型和工具均写库。 */
const AiConfig: React.FC = () => {
  const { message } = App.useApp();
  const [providerForm] = Form.useForm<AdminAiProviderConfig & { apiKey?: string }>();
  const [brandingForm] = Form.useForm<AdminAiBrandingConfig>();
  const [modelForm] = Form.useForm<AdminAiModelConfig>();
  const [toolForm] = Form.useForm<AdminAiToolConfig>();
  const [section, setSection] = useState<
    'branding' | 'navigation' | 'providers' | 'models' | 'tools' | 'entitlements'
  >('branding');
  const [savingToolCode, setSavingToolCode] = useState<string>();
  const [movingToolCode, setMovingToolCode] = useState<string>();
  const [editingProvider, setEditingProvider] = useState<AdminAiProviderConfig | null>(null);
  const [creatingProvider, setCreatingProvider] = useState(false);
  const [editingBranding, setEditingBranding] = useState<AdminAiBrandingConfig | null>(null);
  const [editingModel, setEditingModel] = useState<AdminAiModelConfig | null>(null);
  const [creatingModel, setCreatingModel] = useState(false);
  const [authorizationModel, setAuthorizationModel] = useState<AdminAiModelConfig>();
  const [editingTool, setEditingTool] = useState<AdminAiToolConfig | null>(null);
  const [savingProvider, setSavingProvider] = useState(false);
  const [savingBranding, setSavingBranding] = useState(false);
  const [savingModel, setSavingModel] = useState(false);
  const [savingTool, setSavingTool] = useState(false);
  const [savingNavId, setSavingNavId] = useState<string>();
  const [testingId, setTestingId] = useState<string>();
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
          model.enabled && model.visibleToUser && model.toolTypes.includes(editingTool.code),
      )
      .map((model) => ({
        label: `${model.displayName} · ${model.providerName}`,
        value: model.id,
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

  /** Drawer 内 Form 挂载后再回填，避免 destroyOnHidden 导致 useForm 未连接。 */
  useEffect(() => {
    if (editingBranding) {
      brandingForm.setFieldsValue(editingBranding);
    }
  }, [editingBranding, brandingForm]);

  useEffect(() => {
    if (creatingProvider) {
      providerForm.setFieldsValue({ enabled: true, sourceFiled: false });
      return;
    }
    if (editingProvider) {
      providerForm.setFieldsValue({ ...editingProvider, apiKey: undefined });
    }
  }, [creatingProvider, editingProvider, providerForm]);

  useEffect(() => {
    if (creatingModel) {
      modelForm.setFieldsValue({
        enabled: true,
        visibleToUser: true,
        isDefault: false,
        defaultToolTypes: [],
        modality: 'text',
        contextTokens: 8192,
        maxOutputTokens: 2048,
        inputPricePer1k: 1,
        outputPricePer1k: 2,
        toolTypes: ['chat'],
      });
      return;
    }
    if (editingModel) {
      modelForm.setFieldsValue({
        ...editingModel,
        defaultToolTypes: editingModel.defaultToolTypes ?? [],
      });
    }
  }, [creatingModel, editingModel, modelForm]);

  useEffect(() => {
    if (editingTool) {
      toolForm.setFieldsValue(editingTool);
    }
  }, [editingTool, toolForm]);

  const openBrandingDrawer = () => {
    if (!data?.branding) return;
    setEditingBranding({
      ...data.branding,
      aiEnabled: data.branding.aiEnabled !== false,
    });
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
  const handleToolStatusChange = async (code: AdminAiToolConfig['code'], status: AiToolStatus) => {
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
    setCreatingProvider(false);
    setEditingProvider(provider);
  };

  const openCreateProviderDrawer = () => {
    setEditingProvider(null);
    setCreatingProvider(true);
  };

  const closeProviderDrawer = () => {
    setEditingProvider(null);
    setCreatingProvider(false);
    providerForm.resetFields();
  };

  const openModelDrawer = (model: AdminAiModelConfig) => {
    setCreatingModel(false);
    setEditingModel(model);
  };

  const openCreateModelDrawer = () => {
    setEditingModel(null);
    setCreatingModel(true);
  };

  const closeModelDrawer = () => {
    setEditingModel(null);
    setCreatingModel(false);
    modelForm.resetFields();
  };

  const openToolDrawer = (tool: AdminAiToolConfig) => {
    setEditingTool(tool);
  };

  const closeToolDrawer = () => {
    setEditingTool(null);
    toolForm.resetFields();
  };

  /**
   * 保存 AI 厂商配置。密钥留空表示不轮换；失败提示由全局 errorHandler 读 error.message。
   */
  const handleProviderSave = async () => {
    if (!editingProvider && !creatingProvider) return;
    const values = await providerForm.validateFields();
    const apiKey = typeof values.apiKey === 'string' ? values.apiKey.trim() : '';
    setSavingProvider(true);
    try {
      const mutation = {
        name: values.name,
        baseUrl: values.baseUrl,
        enabled: values.enabled,
        remark: values.remark,
        sourceFiled: values.sourceFiled,
        filingNote: values.filingNote,
        ...(apiKey ? { apiKey } : {}),
      };
      if (creatingProvider) {
        await createAdminAiProviderConfig({ ...mutation, code: values.code });
      } else if (editingProvider) {
        await updateAdminAiProviderConfig(editingProvider.id, mutation);
      }
      await run();
      message.success(creatingProvider ? 'AI 厂商已新增' : 'AI 厂商配置已保存');
      closeProviderDrawer();
    } catch (error) {
      if (error instanceof Error && error.message.includes('安全上下文')) {
        message.error(error.message);
      }
    } finally {
      setSavingProvider(false);
    }
  };

  /** 厂商行或模型行的连接测试。模型行把模型 ID 交给同一个接口。 */
  const handleProviderTest = async (providerId: string, modelId?: string) => {
    setTestingId(modelId ?? providerId);
    try {
      const result = await testAdminAiProvider(providerId, modelId);
      message.success(result.message);
    } catch {
      return;
    } finally {
      setTestingId(undefined);
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
        aiEnabled: values.aiEnabled,
      });
      await run();
      message.success('AI 品牌配置已保存');
      closeBrandingDrawer();
    } finally {
      setSavingBranding(false);
    }
  };

  /** 新增或编辑模型，失败提示交给全局 errorHandler。 */
  const openModelAuthorization = (model: AdminAiModelConfig) => {
    setAuthorizationModel(model);
    setSection('entitlements');
  };

  const renderModelRoles = (_: unknown, model: AdminAiModelConfig) => {
    const roles = (data?.entitlements ?? []).filter((row) => modelAllowedForRole(row, model.id));
    if (!roles.length)
      return (
        <Tag color="warning">{model.isDefault ? '默认模型未配置角色授权' : '未配置角色授权'}</Tag>
      );
    return (
      <Space wrap>
        {roles.map((row) => (
          <Tag key={row.roleId}>{roleLabels[row.roleCode] ?? row.roleCode}</Tag>
        ))}
      </Space>
    );
  };

  const handleModelSave = async () => {
    const values = await modelForm.validateFields();
    setSavingModel(true);
    try {
      let createdModel: AdminAiModelConfig | undefined;
      if (creatingModel) {
        createdModel = await createAdminAiModelConfig({
          modelId: values.modelId,
          displayName: values.displayName,
          providerCode: values.providerCode,
          toolTypes: values.toolTypes,
          enabled: values.enabled,
          visibleToUser: values.visibleToUser,
          isDefault: Boolean(values.defaultToolTypes?.length),
          defaultToolTypes: values.defaultToolTypes ?? [],
          contextTokens: values.contextTokens,
          maxOutputTokens: values.maxOutputTokens,
          modality: values.modality,
          fixedPlatformCost: values.fixedPlatformCost,
          inputPricePer1k: values.inputPricePer1k,
          outputPricePer1k: values.outputPricePer1k,
        });
      } else if (editingModel) {
        await updateAdminAiModelConfig(editingModel.id, {
          displayName: values.displayName,
          modelId: values.modelId,
          toolTypes: values.toolTypes,
          modality: values.modality,
          enabled: values.enabled,
          visibleToUser: values.visibleToUser,
          defaultToolTypes:
            values.enabled && values.visibleToUser ? (values.defaultToolTypes ?? []) : [],
          contextTokens: values.contextTokens,
          ...(values.maxOutputTokens == null ? {} : { maxOutputTokens: values.maxOutputTokens }),
          fixedPlatformCost: values.fixedPlatformCost ?? null,
          inputPricePer1k: values.inputPricePer1k,
          outputPricePer1k: values.outputPricePer1k,
        });
      }
      // 写入成功即结束创建态，刷新失败也不能让重试重复创建模型。
      closeModelDrawer();
      if (createdModel) {
        openModelAuthorization(createdModel);
        message.success('模型已创建，请配置访问权限');
      } else {
        message.success('AI 模型配置已保存');
      }
      await run();
    } catch {
      return;
    } finally {
      setSavingModel(false);
    }
  };

  /**
   * 保存 AI 导航项。隐藏后用户端不展示；禁用/即将上线仍展示但不可进入。
   */
  const handleNavPatch = async (
    item: AdminAiNavigationItem,
    patch: Partial<Pick<AdminAiNavigationItem, 'visible' | 'status' | 'sortOrder' | 'label'>>,
  ) => {
    setSavingNavId(item.id);
    try {
      await updateAdminAiNavigationItem(item.id, { ...patch, version: item.version });
      await run();
      message.success('AI 导航已保存');
    } catch (error) {
      message.error(error instanceof Error ? error.message : '保存失败');
    } finally {
      setSavingNavId(undefined);
    }
  };

  /**
   * 保存 AI 工具配置。
   *
   * 这里保存的是用户端首页和 AI Layout 会直接读取的字段。
   */
  const handleToolSave = async () => {
    if (!editingTool) return;
    const values = await toolForm.validateFields();
    setSavingTool(true);
    try {
      await updateAdminAiToolConfig(editingTool.code, {
        status: values.status,
        defaultModelId: values.defaultModelId ?? null,
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
  const handleToolMove = async (code: AdminAiToolConfig['code'], direction: 'up' | 'down') => {
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

      <Card className="ai-config-card" style={{ marginTop: 16 }}>
        <div className="ai-config-sections">
          <Segmented
            value={section}
            onChange={(value) => setSection(value as typeof section)}
            options={[
              { label: '品牌设置', value: 'branding' },
              { label: 'AI 导航', value: 'navigation' },
              { label: '厂商管理', value: 'providers' },
              { label: '模型管理', value: 'models' },
              { label: '模型访问权限', value: 'entitlements' },
              { label: '工具配置', value: 'tools' },
            ]}
          />
        </div>
        {section === 'entitlements' && (
          <ModelEntitlements
            entitlements={data?.entitlements ?? []}
            models={data?.models ?? []}
            onSaved={run}
            focusModel={authorizationModel}
            onClearFocus={() => setAuthorizationModel(undefined)}
          />
        )}

        {section === 'branding' && (
          <ProTable<AdminAiBrandingConfig>
            className="ai-config-table"
            rowKey="brandName"
            scroll={{ x: 720 }}
            search={false}
            pagination={false}
            dataSource={data?.branding ? [data.branding] : []}
            columns={[
              { title: '品牌名', dataIndex: 'brandName' },
              { title: 'Logo 文案', dataIndex: 'logoText' },
              {
                title: 'AI 入口',
                dataIndex: 'aiEnabled',
                render: (_, record) => (record.aiEnabled === false ? '关闭' : '开启'),
              },
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

        {section === 'navigation' && (
          <ProTable<AdminAiNavigationItem>
            className="ai-config-table"
            rowKey="id"
            scroll={{ x: 1200 }}
            search={false}
            pagination={false}
            dataSource={[...(data?.navigation ?? [])].sort((a, b) => a.sortOrder - b.sortOrder)}
            columns={[
              {
                title: '排序',
                dataIndex: 'sortOrder',
                width: 96,
                render: (_, record) => (
                  <InputNumber
                    key={`${record.id}-${record.version}`}
                    min={0}
                    precision={0}
                    size="small"
                    defaultValue={record.sortOrder}
                    disabled={savingNavId === record.id}
                    onBlur={(event) => {
                      const next = Number((event.target as HTMLInputElement).value);
                      if (!Number.isFinite(next) || next === record.sortOrder) return;
                      void handleNavPatch(record, { sortOrder: next });
                    }}
                    onPressEnter={(event) => {
                      (event.target as HTMLInputElement).blur();
                    }}
                  />
                ),
              },
              { title: '名称', dataIndex: 'label' },
              { title: '标识', dataIndex: 'code' },
              {
                title: '分组',
                dataIndex: 'group',
                render: (_, record) => navGroupLabels[record.group] ?? record.group,
              },
              { title: '路径', dataIndex: 'path' },
              {
                title: '展示',
                dataIndex: 'visible',
                render: (_, record) => (
                  <Switch
                    checked={record.visible}
                    checkedChildren="显示"
                    unCheckedChildren="隐藏"
                    loading={savingNavId === record.id}
                    onChange={(visible) => {
                      void handleNavPatch(record, { visible });
                    }}
                  />
                ),
              },
              {
                title: '状态',
                dataIndex: 'status',
                render: (_, record) => (
                  <Space>
                    <Tag color={toolStatusLabels[record.status]?.color}>
                      {toolStatusLabels[record.status]?.text ?? record.status}
                    </Tag>
                    <Select
                      size="small"
                      style={{ width: 120 }}
                      value={record.status}
                      disabled={savingNavId === record.id}
                      options={[
                        { label: '已启用', value: 'enabled' },
                        { label: '即将上线', value: 'comingSoon' },
                        { label: '已禁用', value: 'disabled' },
                      ]}
                      onChange={(status: AiToolStatus) => {
                        void handleNavPatch(record, { status });
                      }}
                    />
                  </Space>
                ),
              },
            ]}
          />
        )}

        {section === 'providers' && (
          <ProTable<AdminAiProviderConfig>
            className="ai-config-table"
            rowKey="code"
            scroll={{ x: 1080 }}
            search={false}
            pagination={false}
            toolBarRender={() => [
              <Button key="create" type="primary" onClick={openCreateProviderDrawer}>
                新增厂商
              </Button>,
            ]}
            dataSource={data?.providers ?? []}
            columns={[
              { title: '厂商标识', dataIndex: 'code' },
              { title: '展示名称', dataIndex: 'name' },
              { title: 'Base URL', dataIndex: 'baseUrl', ellipsis: true },
              {
                title: 'API Key',
                dataIndex: 'hasKey',
                render: (_, record) => providerKeyStatus(record.hasKey),
              },
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
                    key="test"
                    size="small"
                    type="link"
                    loading={testingId === record.id}
                    onClick={() => void handleProviderTest(record.id)}
                  >
                    测试
                  </Button>,
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
            className="ai-config-table"
            rowKey="id"
            scroll={{ x: 1500 }}
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
              { title: '已授权角色', render: renderModelRoles },
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
                  <Space wrap>
                    <Tag color={record.enabled ? 'success' : 'default'}>
                      {record.enabled ? '可用' : '停用'}
                    </Tag>
                    {record.visibleToUser ? <Tag color="blue">用户可见</Tag> : <Tag>后台可见</Tag>}
                    {record.defaultToolTypes?.map((tool) => (
                      <Tag key={tool} color="gold">
                        {tool} 默认
                      </Tag>
                    ))}
                  </Space>
                ),
              },
              {
                title: '上下文',
                dataIndex: 'contextTokens',
                render: (_, record) => `${record.contextTokens.toLocaleString()} tokens`,
              },
              {
                title: '平台消耗',
                dataIndex: 'price',
                render: (_, record) =>
                  `输入 ${record.inputPricePer1k}/1K，输出 ${record.outputPricePer1k}/1K`,
              },
              {
                title: '操作',
                valueType: 'option',
                width: 230,
                render: (_, record) => {
                  const provider = data?.providers.find(
                    (item) => item.code === record.providerCode,
                  );
                  return [
                    <Button
                      key="authorize"
                      size="small"
                      type="link"
                      onClick={() => openModelAuthorization(record)}
                    >
                      配置访问权限
                    </Button>,
                    <Button
                      key="test"
                      size="small"
                      type="link"
                      disabled={!provider}
                      loading={testingId === record.id}
                      onClick={() => {
                        if (!provider) return;
                        void handleProviderTest(provider.id, record.id);
                      }}
                    >
                      测试
                    </Button>,
                    <Button
                      key="edit"
                      size="small"
                      type="link"
                      onClick={() => openModelDrawer(record)}
                    >
                      编辑
                    </Button>,
                  ];
                },
              },
            ]}
          />
        )}

        {section === 'tools' && (
          <ProTable<AdminAiToolConfig>
            className="ai-config-table"
            rowKey="code"
            scroll={{ x: 1100 }}
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
                        onChange={(value) => handleToolStatusChange(record.code, value)}
                      />
                    </Space>
                  );
                },
              },
              {
                title: '默认模型',
                dataIndex: 'defaultModelId',
                renderText: (value) =>
                  data?.models.find((model) => model.id === value)?.displayName ?? '待配置',
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
            <Form.Item
              label="AI 入口"
              name="aiEnabled"
              valuePropName="checked"
              extra="关闭后公开菜单不再显示 /ai，直接打开地址仍然可以进入"
            >
              <Switch checkedChildren="开启" unCheckedChildren="关闭" />
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
        open={creatingProvider || Boolean(editingProvider)}
        size="large"
        title={creatingProvider ? '新增厂商' : '编辑厂商配置'}
        onClose={closeProviderDrawer}
      >
        {(creatingProvider || editingProvider) && (
          <Form form={providerForm} layout="vertical">
            {creatingProvider ? (
              <Form.Item
                label="厂商标识"
                name="code"
                rules={[
                  { required: true, message: '请输入厂商标识' },
                  {
                    pattern: /^[a-z][a-z0-9_-]{1,39}$/,
                    message: '使用 2-40 位小写字母、数字、下划线或短横线，并以字母开头',
                  },
                ]}
              >
                <Input maxLength={40} placeholder="例如 my-provider" />
              </Form.Item>
            ) : (
              <Form.Item label="厂商标识">
                <Input disabled value={editingProvider?.code} />
              </Form.Item>
            )}
            {creatingProvider && (
              <Form.Item label="厂商类型">
                <Input disabled value="OpenAI-compatible" />
              </Form.Item>
            )}
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
              rules={[
                { required: true, message: '请输入 Base URL' },
                { pattern: /^https?:\/\//, message: '请输入 http(s) 地址' },
              ]}
            >
              <Input placeholder="https://api.example.com" />
            </Form.Item>
            {!creatingProvider && (
              <Form.Item label="API Key">
                <Input disabled value={providerKeyStatus(editingProvider?.hasKey ?? false)} />
              </Form.Item>
            )}
            <Form.Item label={creatingProvider ? 'API Key' : '新 API Key'} name="apiKey">
              <Input.Password
                placeholder={creatingProvider ? '可稍后配置' : '留空表示不修改当前 Key'}
              />
            </Form.Item>
            <Form.Item label="备注" name="remark">
              <Input.TextArea maxLength={500} placeholder="仅管理端可见" rows={3} />
            </Form.Item>
            <Form.Item label="已备案模型来源" name="sourceFiled" valuePropName="checked">
              <Switch checkedChildren="已备案" unCheckedChildren="未备案" />
            </Form.Item>
            <Form.Item label="备案说明" name="filingNote">
              <Input maxLength={200} placeholder="备案号或说明，不返回给用户端" />
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
            <Alert
              type="info"
              showIcon
              title="模型配置与访问权限"
              description="此处管理模型属性与运行状态。角色授权由「模型访问权限」统一管理；新建模型保存后将进入授权配置。"
              style={{ marginBottom: 16 }}
            />
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
                    options={modelToolTypeOptions}
                    placeholder="选择工具类型"
                  />
                </Form.Item>
                <Form.Item label="能力类型" name="modality">
                  <Select options={modalityOptions} placeholder="选择能力类型" />
                </Form.Item>
              </>
            ) : (
              <>
                <Form.Item
                  label="模型 ID"
                  name="modelId"
                  rules={[{ required: true, message: '请输入模型 ID' }]}
                >
                  <Input placeholder="例如 qwen-max" />
                </Form.Item>
                <Form.Item label="厂商">
                  <Input disabled value={editingModel?.providerName} />
                </Form.Item>
                <Form.Item
                  label="支持工具"
                  name="toolTypes"
                  rules={[{ required: true, message: '请选择至少一个支持工具' }]}
                >
                  <Select
                    mode="multiple"
                    options={modelToolTypeOptions}
                    placeholder="选择工具类型"
                  />
                </Form.Item>
                <Form.Item label="能力类型" name="modality">
                  <Select options={modalityOptions} placeholder="选择能力类型" />
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
            <Form.Item
              label="作为以下工具的默认模型"
              name="defaultToolTypes"
              extra="仅选择模型支持的工具；每个工具独立保存默认模型。"
            >
              <Select
                mode="multiple"
                options={modelToolTypeOptions}
                allowClear
                placeholder="不设为默认"
              />
            </Form.Item>
            <Form.Item
              label="上下文 Tokens"
              name="contextTokens"
              rules={[{ required: true, message: '请输入上下文长度' }]}
            >
              <InputNumber min={1} precision={0} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item label="最大输出 Tokens" name="maxOutputTokens">
              <InputNumber min={1} precision={0} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item label="固定平台消耗" name="fixedPlatformCost">
              <InputNumber min={0} precision={0} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item
              label="输入消耗（平台额度 / 1K Tokens）"
              name="inputPricePer1k"
              rules={[{ required: true, message: '请输入输入价格' }]}
            >
              <InputNumber min={0} precision={0} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item
              label="输出消耗（平台额度 / 1K Tokens）"
              name="outputPricePer1k"
              rules={[{ required: true, message: '请输入输出价格' }]}
            >
              <InputNumber min={0} precision={0} style={{ width: '100%' }} />
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
                placeholder={toolModelOptions.length > 0 ? '选择默认模型' : '当前工具暂无可用模型'}
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
