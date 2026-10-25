import {
  CopyOutlined,
  DislikeFilled,
  DislikeOutlined,
  HistoryOutlined,
  PlusOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { type AiMessage, ContentTypeLabel } from '@personal-hub/shared-types';
import { Link, useModel, useSearchParams } from '@umijs/max';
import { Alert, App, Button, Drawer, Input, Modal, Skeleton, Space, Tag, Tooltip } from 'antd';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  type AiAttachmentItem,
  AiAttachmentPicker,
  AiChatAdvancedSettings,
  type AiChatAdvancedSettingsValue,
  AiComposer,
  AiConversationHistoryPanel,
  AiGenerationStatus,
  AiGuestLimitAlert,
  AiQuotaAlert,
  type AiReferenceItem,
  AiReferencePicker,
  AiWorkspaceFrame,
  useAiAvailableModels,
  useAiChat,
  useAiChatSessions,
} from '@/components/ai';
import { AiXBubble, AiXWelcome } from '@/components/ai-x';
import { useRequest } from '@/hooks/useRequest';
import { useViewportBand } from '@/hooks/useViewportBand';
import AiLayout from '@/layouts/AiLayout';
import {
  fetchAiHome,
  fetchAiMessages,
  fetchAiSessions,
  isLoggedIn,
  updateAiMessageFeedback,
} from '@/services/ai';
import { fetchContentDetail } from '@/services/content';

const EMPTY_CHAT_MESSAGES: AiMessage[] = [];

const AiChatPage: React.FC = () => {
  const { message: messageApi, modal } = App.useApp();
  const [searchParams] = useSearchParams();
  const quotedContentId = searchParams.get('contentId') ?? '';
  const initialSessionId = searchParams.get('sessionId') ?? undefined;
  const isQuoteMode = searchParams.get('mode') === 'quote' && Boolean(quotedContentId);
  const { initialState } = useModel('@@initialState');
  const { consumeQuota, runtimeConfig } = useModel('ai');
  const { data: homeData } = useRequest(fetchAiHome);
  const [value, setValue] = useState('');
  const [renameSessionId, setRenameSessionId] = useState<string>();
  const [renameTitle, setRenameTitle] = useState('');
  const [conversationDrawerOpen, setConversationDrawerOpen] = useState(false);
  const [guestPrompt, setGuestPrompt] = useState(0);
  // 首次发送会先创建会话；页面级状态让手机端立即进入提交中，避免重复点击。
  const [submittingMessage, setSubmittingMessage] = useState(false);
  const { band, chatHistoryDrawer } = useViewportBand();
  const [settingsBySession, setSettingsBySession] = useState<
    Record<string, AiChatAdvancedSettingsValue>
  >({});
  const [attachments, setAttachments] = useState<AiAttachmentItem[]>([]);
  const [references, setReferences] = useState<AiReferenceItem[]>([]);
  const { data: sessionsData, loading: sessionsLoading } = useRequest(fetchAiSessions);
  const { data: quotedContent, loading: quotedContentLoading } = useRequest(
    () => fetchContentDetail(quotedContentId),
    {
      ready: isQuoteMode,
      refreshDeps: [quotedContentId, isQuoteMode],
    },
  );
  const initialSessions = useMemo(() => sessionsData ?? [], [sessionsData]);
  const {
    sessions,
    currentSessionId,
    currentMessages,
    setActiveSessionId,
    createNewSession,
    renameSession,
    updateSessionSettings,
    deleteSession,
    updateCurrentMessages,
    updateMessagesForSession,
    syncSessionAfterMessagesChangeFor,
  } = useAiChatSessions({
    initialSessions,
    initialMessages: EMPTY_CHAT_MESSAGES,
    initialSessionId,
  });
  const [messagesLoading, setMessagesLoading] = useState(false);
  const currentSession = useMemo(
    () => sessions.find((session) => session.id === currentSessionId),
    [currentSessionId, sessions],
  );
  const currentSettings = useMemo<AiChatAdvancedSettingsValue>(
    () => ({
      modelId: settingsBySession[currentSessionId ?? '']?.modelId ?? currentSession?.modelId,
      systemPrompt:
        settingsBySession[currentSessionId ?? '']?.systemPrompt ??
        currentSession?.systemPrompt ??
        '你是 Personal Hub AI，回答时先理解用户目标，再给出结构清晰、可执行的建议。',
      contextLimit:
        settingsBySession[currentSessionId ?? '']?.contextLimit ??
        currentSession?.contextLimit ??
        20,
      enableKnowledgeReference:
        settingsBySession[currentSessionId ?? '']?.enableKnowledgeReference ??
        currentSession?.enableKnowledgeReference ??
        true,
    }),
    [currentSession, currentSessionId, settingsBySession],
  );
  const modelState = useAiAvailableModels({
    toolType: 'chat',
    value: currentSettings.modelId,
    onDefaultModel: (modelId) => {
      const settingsKey = currentSessionId ?? '';
      setSettingsBySession((current) => ({
        ...current,
        [settingsKey]: {
          ...currentSettings,
          modelId,
        },
      }));
    },
  });
  // 会话可能保留已停用模型；输入区只显示当前仍可选的模型。
  const activeModelId = modelState.models.some((model) => model.id === currentSettings.modelId)
    ? currentSettings.modelId
    : modelState.defaultModel?.id;
  const updateCurrentSettings = useCallback(
    (nextSettings: AiChatAdvancedSettingsValue) => {
      // 首次对话尚未创建会话，也需要保留用户选择的模型和高级设置。
      setSettingsBySession((current) => ({
        ...current,
        [currentSessionId ?? '']: nextSettings,
      }));
      if (currentSessionId) updateSessionSettings(currentSessionId, nextSettings);
    },
    [currentSessionId, updateSessionSettings],
  );
  const handleMessagesChange = useCallback(
    (nextMessages: AiMessage[], targetSessionId: string) => {
      updateMessagesForSession(targetSessionId, nextMessages);
      syncSessionAfterMessagesChangeFor(targetSessionId, nextMessages);
    },
    [syncSessionAfterMessagesChangeFor, updateMessagesForSession],
  );
  const handleCreateSession = useCallback(async () => {
    return createNewSession({
      ...currentSettings,
      modelId: activeModelId,
    });
  }, [activeModelId, createNewSession, currentSettings]);

  const handleCreateSessionFromHistory = () => {
    setConversationDrawerOpen(false);
    void handleCreateSession().catch((error: unknown) => {
      messageApi.error(error instanceof Error ? error.message : '创建对话失败，请稍后重试');
    });
  };

  const handleSelectSession = (sessionId: string) => {
    setActiveSessionId(sessionId);
    setConversationDrawerOpen(false);
  };

  const handleDeleteSession = (sessionId: string, title: string) => {
    if (isSessionGenerating(sessionId)) {
      messageApi.info('该对话仍在生成，请停止或等待完成后再删除');
      return;
    }
    const confirmDelete = async () => {
      if (isSessionGenerating(sessionId)) {
        messageApi.info('该对话仍在生成，请停止或等待完成后再删除');
        throw new Error('会话仍在生成');
      }
      await deleteSession(sessionId);
    };
    modal.confirm({
      title: '删除对话',
      content: `确定删除“${title}”吗？`,
      okText: '删除',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: confirmDelete,
    });
  };

  const handleRenameSession = (sessionId: string, title: string) => {
    setRenameSessionId(sessionId);
    setRenameTitle(title);
  };
  const handleChatComplete = useCallback(
    async (_completedMessages: AiMessage[], tokenCount: number) => {
      await consumeQuota({
        toolType: 'chat',
        tokens: tokenCount,
        reason: 'AI 对话完成',
      });
    },
    [consumeQuota],
  );
  const {
    messages,
    isCreatingSession,
    isGenerating,
    isSessionGenerating,
    getSessionRevision,
    applyHistory,
    sendMessage,
    stopGenerating,
    regenerate,
  } = useAiChat({
    initialMessages: currentMessages,
    sessionId: currentSessionId,
    modelId: activeModelId,
    systemPrompt: currentSettings.systemPrompt,
    settings: currentSettings,
    ensureSession: handleCreateSession,
    onMessagesChange: handleMessagesChange,
    onComplete: handleChatComplete,
    onError: (text) => messageApi.error(text),
  });
  const authRestoreFailed = Boolean(initialState?.sessionRestoreFailed);
  const isAuthenticated = Boolean(initialState?.currentUser);
  const isGuest = !isAuthenticated && !authRestoreFailed;
  const chatTool = homeData?.tools.find((tool) => tool.code === 'chat');
  const requiresLogin = Boolean(chatTool?.requiresLogin);
  const guestLimitExceeded = Boolean(homeData?.guestTrial?.exceeded);
  const quotaInsufficient =
    isAuthenticated &&
    runtimeConfig.quota !== undefined &&
    runtimeConfig.quota.remainingTokens <= 0;
  const guestBlocked = isGuest && (requiresLogin || guestLimitExceeded);
  const submitDisabled = authRestoreFailed || !modelState.hasModels || quotaInsufficient;

  const copyAssistantMessage = useCallback(
    async (message: AiMessage) => {
      try {
        await navigator.clipboard.writeText(message.content);
        messageApi.success('已复制 AI 回复');
      } catch {
        messageApi.warning('当前浏览器暂不支持自动复制，请手动选择文本复制');
      }
    },
    [messageApi],
  );

  const toggleAssistantFeedback = useCallback(
    async (message: AiMessage) => {
      const nextFeedback = message.feedback ? undefined : 'dislike';
      const res = await updateAiMessageFeedback(message.id, {
        feedback: nextFeedback,
      });
      const updatedMessage = res;
      if (!updatedMessage) {
        messageApi.warning('当前消息暂不支持反馈');
        return;
      }
      updateCurrentMessages((current) =>
        current.map((item) => (item.id === updatedMessage.id ? updatedMessage : item)),
      );
      messageApi[nextFeedback ? 'success' : 'info'](nextFeedback ? '已记录反馈' : '已取消反馈');
    },
    [messageApi, updateCurrentMessages],
  );

  const addReference = useCallback(
    (reference: AiReferenceItem) => {
      setReferences((current) => {
        if (current.some((item) => item.id === reference.id)) {
          messageApi.info('该内容已在引用列表中');
          return current;
        }
        messageApi.success(`已引用《${reference.title}》`);
        return [...current, reference];
      });
    },
    [messageApi],
  );

  const removeReference = useCallback((referenceId: string) => {
    setReferences((current) => current.filter((item) => item.id !== referenceId));
  }, []);

  const addAttachment = useCallback(
    (attachment: AiAttachmentItem) => {
      setAttachments((current) => {
        if (current.some((item) => item.id === attachment.id)) {
          messageApi.info('该附件已在输入区');
          return current;
        }
        messageApi.success(`已添加附件：${attachment.name}`);
        return [...current, attachment];
      });
    },
    [messageApi],
  );

  const removeAttachment = useCallback((attachmentId: string) => {
    setAttachments((current) => current.filter((item) => item.id !== attachmentId));
  }, []);

  const submitMessage = useCallback(
    async (message: string) => {
      if (submittingMessage) return;
      if (guestBlocked) {
        setGuestPrompt((current) => current + 1);
        return;
      }
      const normalized = message.trim();
      if (!normalized) return;
      const referencePrefix =
        references.length > 0
          ? `引用内容：${references.map((reference) => `《${reference.title}》`).join('、')}\n\n`
          : '';
      const attachmentPrefix =
        attachments.length > 0
          ? `附件：${attachments
              .map((attachment) => `${attachment.name}（${attachment.typeLabel}）`)
              .join('、')}\n\n`
          : '';
      try {
        setSubmittingMessage(true);
        const accepted = await sendMessage(`${referencePrefix}${attachmentPrefix}${normalized}`);
        if (accepted) {
          setValue((current) => (current === message ? '' : current));
        }
      } catch (error) {
        messageApi.error(error instanceof Error ? error.message : '发送失败，请稍后重试');
      } finally {
        setSubmittingMessage(false);
      }
    },
    [attachments, guestBlocked, messageApi, references, sendMessage, submittingMessage],
  );

  const clearComposer = useCallback(() => {
    setValue('');
    setAttachments([]);
    setReferences([]);
  }, []);

  const optimizePrompt = useCallback((currentValue: string) => {
    const normalized = currentValue.trim();
    if (!normalized) return currentValue;
    return `请更精准地回答下面的问题，并优先给出可执行步骤：\n\n${normalized}`;
  }, []);

  const handleRegenerateMessage = (messageId: string) => {
    if (guestBlocked) {
      setGuestPrompt((current) => current + 1);
      return;
    }
    try {
      regenerate(messageId);
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : '重新生成失败，请稍后重试');
    }
  };

  useEffect(() => {
    if (!currentSessionId) return;
    setSettingsBySession((current) => {
      if (current[currentSessionId]) return current;
      return { ...current, [currentSessionId]: currentSettings };
    });
  }, [currentSessionId, currentSettings]);

  useEffect(() => {
    if (!chatHistoryDrawer) setConversationDrawerOpen(false);
  }, [chatHistoryDrawer]);

  useEffect(() => {
    if (!quotedContent || value) return;
    setValue(`请基于《${quotedContent.title}》这篇内容，帮我总结核心观点并给出可执行建议。`);
  }, [quotedContent, value]);

  useEffect(() => {
    if (!quotedContent) return;
    setReferences((current) => {
      if (current.some((item) => item.id === quotedContent.id)) return current;
      return [
        ...current,
        {
          id: quotedContent.id,
          title: quotedContent.title,
          typeLabel: ContentTypeLabel[quotedContent.type],
          summary: quotedContent.summary,
        },
      ];
    });
  }, [quotedContent]);

  useEffect(() => {
    if (!currentSessionId || !isLoggedIn() || isSessionGenerating(currentSessionId)) {
      setMessagesLoading(false);
      return;
    }
    let cancelled = false;
    const revision = getSessionRevision(currentSessionId);
    setMessagesLoading(true);
    fetchAiMessages(currentSessionId)
      .then((res) => {
        if (cancelled || isSessionGenerating(currentSessionId)) return;
        applyHistory(currentSessionId, res ?? [], revision);
      })
      .catch(() => {
        // 全局请求层已负责错误提示；这里仅避免 effect 里留下未处理 Promise。
      })
      .finally(() => {
        if (!cancelled) setMessagesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [currentSessionId, isGenerating, isSessionGenerating, getSessionRevision, applyHistory]);

  const messageAutoScrollKey = useMemo(
    () =>
      messages
        .map((message) => `${message.id}:${message.status}:${message.content.length}`)
        .join('|'),
    [messages],
  );
  const currentSessionTitle = currentSession?.title || '新对话';
  const conversationPanel = (
    <AiConversationHistoryPanel
      activeKey={currentSessionId}
      loading={sessionsLoading}
      sessions={sessions}
      onActiveChange={handleSelectSession}
      onCreate={handleCreateSessionFromHistory}
      onDelete={handleDeleteSession}
      onRename={handleRenameSession}
    />
  );

  return (
    <AiLayout>
      <AiWorkspaceFrame
        autoScrollKey={messageAutoScrollKey}
        resetPinOnKeyChange={false}
        className="ph-ai-chat-shell"
        sidePanel={chatHistoryDrawer ? undefined : conversationPanel}
        showWelcome={!chatHistoryDrawer && !messagesLoading && messages.length === 0}
        welcome={{
          title: '今天想聊点什么？',
          description: '可以直接提问、引用知识内容，或切换模型开始一段新的 AI 对话。',
        }}
        messageArea={
          <section className="ph-ai-panel ph-ai-message-panel">
            {chatHistoryDrawer && (
              <div className="ph-ai-chat-toolbar">
                <Tooltip title={currentSessionTitle}>
                  <span className="ph-ai-chat-current-title">{currentSessionTitle}</span>
                </Tooltip>
                <div className="ph-ai-chat-toolbar-actions">
                  <Button
                    aria-label="打开对话历史"
                    icon={<HistoryOutlined />}
                    type="text"
                    onClick={() => setConversationDrawerOpen(true)}
                  >
                    对话
                  </Button>
                  <Tooltip title="新建对话">
                    <Button
                      aria-label="新建对话"
                      icon={<PlusOutlined />}
                      type="text"
                      onClick={handleCreateSessionFromHistory}
                    />
                  </Tooltip>
                </div>
              </div>
            )}
            {isQuoteMode && (
              <div className="ph-ai-reference-chip">
                {quotedContentLoading ? (
                  <Skeleton active paragraph={false} title={{ width: 260 }} />
                ) : quotedContent ? (
                  <Space wrap>
                    <Tag color="blue">引用内容</Tag>
                    <Link to={`/content/${quotedContent.id}`}>{quotedContent.title}</Link>
                    <Tag>{ContentTypeLabel[quotedContent.type]}</Tag>
                    {(quotedContent.categoryName || quotedContent.categorySlug) && (
                      <Tag>{quotedContent.categoryName || quotedContent.categorySlug}</Tag>
                    )}
                  </Space>
                ) : (
                  <Space wrap>
                    <Tag color="warning">引用内容不可用</Tag>
                    <span>未找到 contentId={quotedContentId} 的内容</span>
                  </Space>
                )}
              </div>
            )}
            <div
              className={[
                'ph-ai-message-list',
                chatHistoryDrawer && !messagesLoading && messages.length === 0
                  ? 'ph-ai-message-list-empty'
                  : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              {messagesLoading && <Skeleton active paragraph={{ rows: 5 }} />}
              {chatHistoryDrawer && !messagesLoading && messages.length === 0 && (
                <div className="ph-ai-workspace-welcome">
                  <AiXWelcome
                    description="可以直接提问、引用知识内容，或切换模型开始一段新的 AI 对话。"
                    title="今天想聊点什么？"
                  />
                </div>
              )}
              {messages.map((message) => {
                const isAssistant = message.role === 'assistant';
                const feedback = message.feedback;
                return (
                  <div className="ph-ai-chat-message" key={message.id}>
                    <AiXBubble
                      content={message.content}
                      message={message}
                      placement={message.role === 'user' ? 'end' : 'start'}
                      streaming={message.status === 'generating'}
                      style={{ marginBottom: isAssistant ? 6 : 16 }}
                    />
                    {isAssistant && (
                      <Space className="ph-ai-chat-message-actions" size={2}>
                        <Button
                          aria-label="复制 AI 回复"
                          icon={<CopyOutlined />}
                          size="small"
                          type="text"
                          onClick={() => copyAssistantMessage(message)}
                        />
                        <Button
                          aria-label="重新生成 AI 回复"
                          disabled={authRestoreFailed || isGenerating}
                          icon={<ReloadOutlined />}
                          size="small"
                          type="text"
                          onClick={() => handleRegenerateMessage(message.id)}
                        />
                        <Button
                          aria-label={feedback ? '取消点踩反馈' : '点踩反馈'}
                          icon={feedback ? <DislikeFilled /> : <DislikeOutlined />}
                          size="small"
                          type="text"
                          onClick={() => toggleAssistantFeedback(message)}
                        />
                      </Space>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        }
        composer={
          <div className="ph-ai-sender-bar">
            <Space orientation="vertical" size={8} style={{ width: '100%' }}>
              <AiGenerationStatus active={submittingMessage || isCreatingSession || isGenerating} />
              {!modelState.loading && !modelState.error && !modelState.hasModels && (
                <Alert showIcon type="info" title="暂无可用模型，请联系管理员启用对话模型" />
              )}
              {band !== 'phone' && (
                <AiChatAdvancedSettings
                  hasModels={modelState.hasModels}
                  modelLoading={modelState.loading}
                  modelOptions={modelState.options}
                  showModelSelect={false}
                  value={currentSettings}
                  onChange={updateCurrentSettings}
                />
              )}
              <AiComposer
                pinnedLeading={
                  band === 'phone' ? (
                    <AiChatAdvancedSettings
                      compact
                      hasModels={modelState.hasModels}
                      modelLoading={modelState.loading}
                      modelOptions={modelState.options}
                      showModelSelect={false}
                      value={currentSettings}
                      onChange={updateCurrentSettings}
                    />
                  ) : undefined
                }
                loading={isGenerating}
                submitDisabled={submitDisabled || submittingMessage || isCreatingSession}
                model={{
                  value: activeModelId,
                  options: modelState.options,
                  loading: modelState.loading,
                  disabled: !modelState.hasModels,
                  placeholder: '选择对话模型',
                  onChange: (modelId) => updateCurrentSettings({ ...currentSettings, modelId }),
                }}
                placeholder="输入问题，Shift + Enter 换行"
                value={value}
                references={
                  references.length > 0 ? (
                    <div className="ph-ai-sender-references">
                      {references.map((reference) => (
                        <Tag
                          closable
                          color="blue"
                          key={reference.id}
                          onClose={() => removeReference(reference.id)}
                        >
                          {reference.typeLabel}：{reference.title}
                        </Tag>
                      ))}
                    </div>
                  ) : undefined
                }
                attachments={
                  attachments.length > 0 ? (
                    <div className="ph-ai-sender-attachments">
                      {attachments.map((attachment) => (
                        <Tag
                          closable
                          color="purple"
                          key={attachment.id}
                          onClose={() => removeAttachment(attachment.id)}
                        >
                          {attachment.typeLabel}：{attachment.name}
                        </Tag>
                      ))}
                    </div>
                  ) : undefined
                }
                leadingActions={
                  <>
                    <AiReferencePicker
                      disabled={!currentSettings.enableKnowledgeReference}
                      selectedIds={references.map((reference) => reference.id)}
                      onSelect={addReference}
                    />
                    <AiAttachmentPicker
                      selectedIds={attachments.map((attachment) => attachment.id)}
                      onSelect={addAttachment}
                    />
                  </>
                }
                onChange={setValue}
                onClear={clearComposer}
                onOptimize={optimizePrompt}
                onStop={stopGenerating}
                onSubmit={submitMessage}
              />
              <AiQuotaAlert
                estimatedTokens={1}
                quota={runtimeConfig.quota}
                toolName="AI 对话"
                visible={isAuthenticated}
              />
              <AiGuestLimitAlert
                dailyLimit={homeData?.guestTrial?.dailyLimit}
                exceeded={guestLimitExceeded}
                isGuest={isGuest}
                remainingUses={homeData?.guestTrial?.remaining}
                promptSignal={guestPrompt}
                requiresLogin={requiresLogin}
                toolName="AI 对话"
              />
            </Space>
          </div>
        }
      />

      <Drawer
        destroyOnHidden
        open={chatHistoryDrawer && conversationDrawerOpen}
        placement="left"
        rootClassName="ph-ai-chat-history-drawer"
        size="default"
        title="对话历史"
        onClose={() => setConversationDrawerOpen(false)}
      >
        {conversationPanel}
      </Drawer>

      <Modal
        destroyOnHidden
        okText="保存"
        open={Boolean(renameSessionId)}
        title="重命名对话"
        onCancel={() => {
          setRenameSessionId(undefined);
          setRenameTitle('');
        }}
        onOk={() => {
          if (renameSessionId) {
            renameSession(renameSessionId, renameTitle);
          }
          setRenameSessionId(undefined);
          setRenameTitle('');
        }}
      >
        <Input
          maxLength={40}
          placeholder="输入对话名称"
          showCount
          value={renameTitle}
          onChange={(event) => setRenameTitle(event.target.value)}
          onPressEnter={() => {
            if (renameSessionId) {
              renameSession(renameSessionId, renameTitle);
            }
            setRenameSessionId(undefined);
            setRenameTitle('');
          }}
        />
      </Modal>
    </AiLayout>
  );
};

export default AiChatPage;
