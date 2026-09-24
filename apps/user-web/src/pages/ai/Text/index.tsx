import { useModel, useSearchParams } from '@umijs/max';
import { useRequest } from '@/hooks/useRequest';
import { useViewportBand } from '@/hooks/useViewportBand';
import {
  CopyOutlined,
  FileTextOutlined,
  ReloadOutlined,
  SaveOutlined,
  StopOutlined,
} from '@ant-design/icons';
import { App, Button, Card, Input, Select, Space, Statistic, Tabs, Tag } from 'antd';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AiGuestLimitAlert,
  AiPageHeader,
  AiQuotaAlert,
  type AiTextDraft,
  useAiAvailableModels,
  useAiTextGeneration,
} from '@/components/ai';
import { AiXMarkdown } from '@/components/ai-x';
import AiLayout from '@/layouts/AiLayout';
import { createAiAsset, fetchAiHome } from '@/services/ai';

const scenarioItems = [
  { key: 'write', label: '写作辅助' },
  { key: 'rewrite', label: '改写润色' },
  { key: 'summary', label: '摘要提炼' },
  { key: 'expand', label: '扩写' },
  { key: 'translate', label: '翻译' },
  { key: 'custom', label: '自定义 Prompt' },
];

/** 手机一行放不下全部类型，前 3 个留在外面，其余进「其他」。 */
const phoneVisibleScenarioCount = 3;
const phoneVisibleScenarios = scenarioItems.slice(0, phoneVisibleScenarioCount);
const phoneOverflowScenarios = scenarioItems.slice(phoneVisibleScenarioCount);

const toneOptions = [
  { label: '专业', value: 'professional' },
  { label: '正式', value: 'formal' },
  { label: '轻松', value: 'casual' },
];

const lengthOptions = [
  { label: '短', value: 'short' },
  { label: '中', value: 'medium' },
  { label: '长', value: 'long' },
];

/** 文本产出语言使用固定选项，避免手机端在窄输入框中编辑自由文本。 */
const targetLanguageOptions = [
  { label: '中文（简体）', value: '中文' },
  { label: 'English（英语）', value: '英文' },
  { label: '日本語（日语）', value: '日语' },
  { label: '한국어（韩语）', value: '韩语' },
  { label: 'Français（法语）', value: '法语' },
  { label: 'Deutsch（德语）', value: '德语' },
  { label: 'Español（西班牙语）', value: '西班牙语' },
  { label: 'Português（葡萄牙语）', value: '葡萄牙语' },
  { label: 'Русский（俄语）', value: '俄语' },
  { label: 'العربية（阿拉伯语）', value: '阿拉伯语' },
  { label: 'हिन्दी（印地语）', value: '印地语' },
];

/**
 * 文本生成页。
 *
 * 文本生成页。流式输出走 Nest SSE，额度由服务端预占结算。
 */
const AiTextPage: React.FC = () => {
  const { message } = App.useApp();
  const [searchParams] = useSearchParams();
  const { initialState } = useModel('@@initialState');
  const { consumeQuota, runtimeConfig } = useModel('ai');
  const templateId = searchParams.get('templateId');
  const appliedTemplateIdRef = useRef<string | undefined>(undefined);
  const { data: homeData } = useRequest(fetchAiHome);
  const handleGenerationComplete = useCallback(
    async (_draft: AiTextDraft, _output: string, estimatedTokens: number) => {
      await consumeQuota({
        tokens: estimatedTokens,
        toolType: 'text',
        reason: '文本生成完成',
      });
    },
    [consumeQuota],
  );
  const generation = useAiTextGeneration({
    onComplete: handleGenerationComplete,
  });
  const activeTemplate = useMemo(
    () =>
      homeData?.templates.find(
        (template) => template.id === templateId && template.toolType === 'text',
      ),
    [homeData?.templates, templateId],
  );
  const [savingAsset, setSavingAsset] = useState(false);
  const modelState = useAiAvailableModels({
    toolType: 'text',
    value: generation.draft.modelId,
    onDefaultModel: (modelId) => generation.updateDraft({ modelId }),
  });
  const authRestoreFailed = Boolean(initialState?.sessionRestoreFailed);
  const isAuthenticated = Boolean(initialState?.currentUser);
  const isGuest = !isAuthenticated && !authRestoreFailed;
  const textTool = homeData?.tools.find((tool) => tool.code === 'text');
  const requiresLogin = Boolean(textTool?.requiresLogin);
  const quotaInsufficient =
    isAuthenticated &&
    runtimeConfig.quota !== undefined &&
    runtimeConfig.quota.remainingTokens < generation.tokenEstimate;
  const guestLimitExceeded = Boolean(homeData?.guestTrial?.exceeded);
  const guestBlocked = isGuest && (requiresLogin || guestLimitExceeded);
  const [guestPrompt, setGuestPrompt] = useState(0);
  const { band } = useViewportBand();
  const canSubmit =
    !authRestoreFailed && generation.canGenerate && modelState.hasModels && !quotaInsufficient;
  const overflowScenarioActive = phoneOverflowScenarios.some(
    (item) => item.key === generation.draft.scenario,
  );

  const handleScenarioChange = (scenario: string) => {
    generation.updateDraft({
      scenario: scenario as typeof generation.draft.scenario,
    });
  };

  useEffect(() => {
    if (!activeTemplate || appliedTemplateIdRef.current === activeTemplate.id) return;
    appliedTemplateIdRef.current = activeTemplate.id;
    generation.updateDraft({
      scenario: activeTemplate.textScenario ?? 'write',
      input: activeTemplate.prompt,
      modelId: activeTemplate.modelId,
      tone: activeTemplate.textTone ?? 'professional',
      length: activeTemplate.textLength ?? 'medium',
      targetLanguage: activeTemplate.targetLanguage ?? '英文',
    });
    message.info(`已应用模板：${activeTemplate.title}`);
  }, [activeTemplate, generation.updateDraft, message]);

  const saveOutputAsAsset = async () => {
    if (!generation.hasOutput || generation.isGenerating) return;
    const titleSource = generation.lastSubmittedDraft?.input || generation.draft.input;
    const submittedScenario =
      generation.lastSubmittedDraft?.scenario ?? generation.draft.scenario;
    const scenarioLabel =
      scenarioItems.find((item) => item.key === submittedScenario)?.label ??
      '文本生成';
    const assetTitle = `${scenarioLabel}：${titleSource.slice(0, 18) || '未命名结果'}`;
    setSavingAsset(true);
    try {
      await createAiAsset({
        title: assetTitle,
        type: 'text',
        source: 'generated',
        status: 'saved',
        modelId: generation.lastSubmittedDraft?.modelId ?? generation.draft.modelId,
        content: generation.output,
        prompt: generation.lastSubmittedDraft?.input ?? generation.draft.input,
        folderId: 'folder-writing',
        folderName: '写作素材',
      });
      message.success('已保存到 AI 资产');
    } finally {
      setSavingAsset(false);
    }
  };

  return (
    <AiLayout>
      <AiPageHeader
        description={
          activeTemplate
            ? `已从首页模板预填：${activeTemplate.title}`
            : '文本生成支持写作、改写、摘要、扩写、翻译和自定义 Prompt。'
        }
        title="文本生成"
      />

      <div className="ph-ai-text-shell">
        <Card className="ph-ai-text-input-card">
          {band === 'phone' ? (
            <div className="ph-ai-text-scenario-compact" role="tablist" aria-label="生成类型">
              {phoneVisibleScenarios.map((item) => (
                <button
                  key={item.key}
                  aria-selected={generation.draft.scenario === item.key}
                  className={
                    generation.draft.scenario === item.key
                      ? 'ph-ai-text-scenario-compact-active'
                      : undefined
                  }
                  role="tab"
                  type="button"
                  onClick={() => handleScenarioChange(item.key)}
                >
                  {item.label}
                </button>
              ))}
              <Select
                aria-label="其他生成类型"
                className={
                  overflowScenarioActive
                    ? 'ph-ai-text-scenario-more ph-ai-text-scenario-more-active'
                    : 'ph-ai-text-scenario-more'
                }
                options={phoneOverflowScenarios.map((item) => ({
                  label: item.label,
                  value: item.key,
                }))}
                placeholder="其他"
                popupMatchSelectWidth={false}
                value={overflowScenarioActive ? generation.draft.scenario : undefined}
                onChange={handleScenarioChange}
              />
            </div>
          ) : (
            <Tabs
              className="ph-ai-text-scenario-tabs"
              activeKey={generation.draft.scenario}
              items={scenarioItems}
              onChange={handleScenarioChange}
            />
          )}
          <div className="ph-ai-text-hint">{generation.scenarioHint}</div>

          <Input.TextArea
            autoSize={{ minRows: 9, maxRows: 16 }}
            placeholder="输入原文、提纲、关键词，或直接写下你希望 AI 完成的任务"
            value={generation.draft.input}
            onChange={(event) =>
              generation.updateDraft({ input: event.target.value })
            }
          />

          <div className="ph-ai-text-control-grid">
            <Select
              value={generation.draft.modelId}
              options={modelState.options}
              loading={modelState.loading}
              disabled={!modelState.hasModels}
              placeholder="选择模型"
              onChange={(modelId) => generation.updateDraft({ modelId })}
            />
            <Select
              value={generation.draft.tone}
              options={toneOptions}
              onChange={(tone) => generation.updateDraft({ tone })}
            />
            <Select
              value={generation.draft.length}
              options={lengthOptions}
              onChange={(length) =>
                generation.updateDraft({
                  length: length as typeof generation.draft.length,
                })
              }
            />
            <Select
              aria-label="选择目标语言"
              showSearch
              value={generation.draft.targetLanguage}
              options={targetLanguageOptions}
              optionFilterProp="label"
              placeholder="选择目标语言"
              onChange={(targetLanguage) => generation.updateDraft({ targetLanguage })}
            />
          </div>

          <div className="ph-ai-text-actions">
            <Space wrap>
              {generation.isGenerating ? (
                <Button
                  icon={<StopOutlined />}
                  onClick={generation.stop}
                >
                  停止生成
                </Button>
              ) : (
                <Button
                  icon={<FileTextOutlined />}
                  type="primary"
                  disabled={!canSubmit}
                  onClick={() => {
                    if (guestBlocked) {
                      setGuestPrompt((current) => current + 1);
                      return;
                    }
                    generation.generate();
                  }}
                >
                  生成文本
                </Button>
              )}
              <Button
                icon={<ReloadOutlined />}
                disabled={authRestoreFailed || generation.isGenerating || !generation.hasOutput}
                onClick={() => {
                  if (guestBlocked) {
                    setGuestPrompt((current) => current + 1);
                    return;
                  }
                  generation.regenerate();
                }}
              >
                重新生成
              </Button>
            </Space>
            <Statistic
              title={modelState.hasModels ? '预计消耗' : '暂无可用模型'}
              value={generation.tokenEstimate}
              suffix="Token"
            />
          </div>
          <AiQuotaAlert
            estimatedTokens={generation.tokenEstimate}
            quota={runtimeConfig.quota}
            toolName="文本生成"
            visible={isAuthenticated}
          />
          <AiGuestLimitAlert
            dailyLimit={homeData?.guestTrial?.dailyLimit}
            exceeded={guestLimitExceeded}
            isGuest={isGuest}
            remainingUses={homeData?.guestTrial?.remaining}
            promptSignal={guestPrompt}
            requiresLogin={requiresLogin}
            toolName="文本生成"
          />
        </Card>

        <Card
          className="ph-ai-text-output-card"
          extra={
            <Space>
              <Tag color={generation.isGenerating ? 'blue' : 'default'}>
                {generation.isGenerating ? '生成中' : '已完成'}
              </Tag>
              <Button
                icon={<CopyOutlined />}
                size="small"
                disabled={!generation.hasOutput}
                onClick={async () => {
                  await navigator.clipboard.writeText(generation.output);
                  message.success('已复制生成结果');
                }}
              >
                复制
              </Button>
              <Button
                icon={<SaveOutlined />}
                size="small"
                disabled={!generation.hasOutput || generation.isGenerating}
                loading={savingAsset}
                onClick={saveOutputAsAsset}
              >
                保存到资产
              </Button>
            </Space>
          }
          title="输出结果"
        >
          {generation.hasOutput ? (
            <div
              className={
                generation.isGenerating
                  ? 'ph-ai-text-output ph-ai-generating'
                  : 'ph-ai-text-output'
              }
            >
              <AiXMarkdown>{generation.output}</AiXMarkdown>
            </div>
          ) : (
            <div className="ph-ai-text-empty">
              选择场景并输入内容后，生成结果会在这里流式展示。
            </div>
          )}
        </Card>
      </div>
    </AiLayout>
  );
};

export default AiTextPage;
