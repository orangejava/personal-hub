import { Link, useModel, useRequest, useSearchParams } from '@umijs/max';
import {
  CopyOutlined,
  DislikeFilled,
  DislikeOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { App, Button, Input, Modal, Skeleton, Space, Tag } from 'antd';
import { ContentTypeLabel, type AiMessage } from '@personal-hub/shared-types';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AiAttachmentPicker,
  type AiAttachmentItem,
  AiChatAdvancedSettings,
  type AiChatAdvancedSettingsValue,
  AiComposer,
  AiConversationHistoryPanel,
  AiReferencePicker,
  type AiReferenceItem,
  AiWorkspaceFrame,
  useAiAvailableModels,
  useAiChatMock,
  useAiChatSessionsMock,
} from '@/components/ai';
import { AiXBubble } from '@/components/ai-x';
import { ResultState } from '@/components/shared';
import AiLayout from '@/layouts/AiLayout';
import {
  fetchAiMessages,
  fetchAiSessions,
  updateAiMessageFeedback,
} from '@/services/ai';
import { fetchContentDetail } from '@/services/content';

const AiChatPage: React.FC = () => {
  const { message: messageApi, modal } = App.useApp();
  const [searchParams] = useSearchParams();
  const quotedContentId = searchParams.get('contentId') ?? '';
  const initialSessionId = searchParams.get('sessionId') ?? undefined;
  const isQuoteMode = searchParams.get('mode') === 'quote' && Boolean(quotedContentId);
  const { consumeQuota } = useModel('ai');
  const [value, setValue] = useState('');
  const [renameSessionId, setRenameSessionId] = useState<string>();
  const [renameTitle, setRenameTitle] = useState('');
  const [settingsExpanded, setSettingsExpanded] = useState(false);
  const [settingsBySession, setSettingsBySession] = useState<
    Record<string, AiChatAdvancedSettingsValue>
  >({});
  const [attachments, setAttachments] = useState<AiAttachmentItem[]>([]);
  const [references, setReferences] = useState<AiReferenceItem[]>([]);
  const { data: sessionsData, loading: sessionsLoading } =
    useRequest(fetchAiSessions);
  const {
    data: quotedContent,
    loading: quotedContentLoading,
  } = useRequest(() => fetchContentDetail(quotedContentId), {
    ready: isQuoteMode,
    refreshDeps: [quotedContentId, isQuoteMode],
  });
  const initialSessions = useMemo(() => sessionsData ?? [], [sessionsData]);
  const firstSessionId =
    initialSessionId && initialSessions.some((session) => session.id === initialSessionId)
      ? initialSessionId
      : initialSessions[0]?.id;
  const { data: messagesData, loading: messagesLoading } = useRequest(
    () => fetchAiMessages(firstSessionId),
    {
      ready: Boolean(firstSessionId),
      refreshDeps: [firstSessionId],
    },
  );
  const initialMessages = useMemo(() => messagesData ?? [], [messagesData]);
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
    syncSessionAfterMessagesChange,
    setSessionMessages,
  } = useAiChatSessionsMock({
    initialSessions,
    initialMessages,
    initialSessionId,
  });
  const currentSession = useMemo(
    () => sessions.find((session) => session.id === currentSessionId),
    [currentSessionId, sessions],
  );
  const currentSettings = useMemo<AiChatAdvancedSettingsValue>(
    () => ({
      modelId:
        settingsBySession[currentSessionId ?? '']?.modelId ?? currentSession?.modelId,
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
      if (!currentSessionId) return;
      setSettingsBySession((current) => ({
        ...current,
        [currentSessionId]: {
          ...currentSettings,
          modelId,
        },
      }));
    },
  });
  const updateCurrentSettings = useCallback(
    (nextSettings: AiChatAdvancedSettingsValue) => {
      if (!currentSessionId) return;
      setSettingsBySession((current) => ({
        ...current,
        [currentSessionId]: nextSettings,
      }));
      updateSessionSettings(currentSessionId, nextSettings);
    },
    [currentSessionId, updateSessionSettings],
  );
  const handleMessagesChange = useCallback(
    (nextMessages: AiMessage[]) => {
      updateCurrentMessages(nextMessages);
      syncSessionAfterMessagesChange(nextMessages);
    },
    [syncSessionAfterMessagesChange, updateCurrentMessages],
  );
  const handleChatComplete = useCallback(
    async (_completedMessages: AiMessage[], tokenCount: number) => {
      const result = await consumeQuota({
        toolType: 'chat',
        tokens: tokenCount,
        reason: 'AI 对话 mock 回复',
      });
      if (result?.reason === 'insufficient') {
        messageApi.warning('Token 余额不足，本次 mock 回复已保留但未扣减额度');
      }
    },
    [consumeQuota, messageApi],
  );
  const {
    messages,
    isGenerating,
    sendMessage,
    stopGenerating,
    regenerate,
  } = useAiChatMock({
    initialMessages: currentMessages,
    sessionId: currentSessionId,
    modelId: currentSettings.modelId,
    systemPrompt: currentSettings.systemPrompt,
    settings: currentSettings,
    onMessagesChange: handleMessagesChange,
    onComplete: handleChatComplete,
  });

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
      const updatedMessage = res.data;
      if (!updatedMessage) {
        messageApi.warning('当前消息暂不支持反馈');
        return;
      }
      updateCurrentMessages((current) =>
        current.map((item) => (item.id === updatedMessage.id ? updatedMessage : item)),
      );
      messageApi[nextFeedback ? 'success' : 'info'](
        nextFeedback ? '已记录反馈，后续会用于优化 mock 回复' : '已取消反馈',
      );
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
    (message: string) => {
      const normalized = message.trim();
      if (!normalized) return;
      const referencePrefix =
        references.length > 0
          ? `引用内容：${references
              .map((reference) => `《${reference.title}》`)
              .join('、')}\n\n`
          : '';
      const attachmentPrefix =
        attachments.length > 0
          ? `附件：${attachments
              .map((attachment) => `${attachment.name}（${attachment.typeLabel}）`)
              .join('、')}\n\n`
          : '';
      sendMessage(`${referencePrefix}${attachmentPrefix}${normalized}`);
      setValue('');
    },
    [attachments, references, sendMessage],
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

  useEffect(() => {
    if (!currentSessionId) return;
    setSettingsBySession((current) => {
      if (current[currentSessionId]) return current;
      return { ...current, [currentSessionId]: currentSettings };
    });
  }, [currentSessionId, currentSettings]);

  useEffect(() => {
    if (!quotedContent || value) return;
    setValue(
      `请基于《${quotedContent.title}》这篇内容，帮我总结核心观点并给出可执行建议。`,
    );
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
    if (!currentSessionId) return;
    fetchAiMessages(currentSessionId).then((res) => {
      const nextMessages = res.data ?? [];
      setSessionMessages(currentSessionId, nextMessages);
      syncSessionAfterMessagesChange(nextMessages);
    });
  }, [currentSessionId, setSessionMessages, syncSessionAfterMessagesChange]);

  const messageAutoScrollKey = useMemo(
    () =>
      messages
        .map((message) => `${message.id}:${message.status}:${message.content.length}`)
        .join('|'),
    [messages],
  );

  return (
    <AiLayout>
      <AiWorkspaceFrame
        autoScrollKey={messageAutoScrollKey}
        className="ph-ai-chat-shell ph-ai-workspace-frame-with-side"
        sidePanel={(
          <AiConversationHistoryPanel
            activeKey={currentSessionId}
            loading={sessionsLoading}
            sessions={sessions}
            onActiveChange={setActiveSessionId}
            onCreate={createNewSession}
            onDelete={(sessionId, title) => {
              modal.confirm({
                title: '删除对话',
                content: `确定删除“${title}”吗？`,
                okText: '删除',
                okButtonProps: { danger: true },
                cancelText: '取消',
                onOk: () => deleteSession(sessionId),
              });
            }}
            onRename={(sessionId, title) => {
              setRenameSessionId(sessionId);
              setRenameTitle(title);
            }}
          />
        )}
        showWelcome={!messagesLoading && messages.length === 0}
        welcome={{
          title: '今天想聊点什么？',
          description: '可以直接提问、引用知识内容，或切换模型开始一段新的 AI 对话。',
        }}
        messageArea={(
          <section className="ph-ai-panel ph-ai-message-panel">
          {isQuoteMode && (
            <div className="ph-ai-reference-chip">
              {quotedContentLoading ? (
                <Skeleton active paragraph={false} title={{ width: 260 }} />
              ) : quotedContent ? (
                <Space wrap>
                  <Tag color="blue">引用内容</Tag>
                  <Link to={`/content/${quotedContent.id}`}>{quotedContent.title}</Link>
                  <Tag>{ContentTypeLabel[quotedContent.type]}</Tag>
                  {quotedContent.categorySlug && <Tag>{quotedContent.categorySlug}</Tag>}
                </Space>
              ) : (
                <Space wrap>
                  <Tag color="warning">引用内容不可用</Tag>
                  <span>未找到 contentId={quotedContentId} 的内容</span>
                </Space>
              )}
            </div>
          )}
          <div className="ph-ai-message-list">
            {messagesLoading && <Skeleton active paragraph={{ rows: 5 }} />}
            {!messagesLoading && !currentSessionId && (
              <ResultState
                actionText="新建对话"
                actionTo="/ai/chat"
                description="还没有可用的 mock 会话。"
                status="empty"
              />
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
                        disabled={isGenerating}
                        icon={<ReloadOutlined />}
                        size="small"
                        type="text"
                        onClick={regenerate}
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
        )}
        composer={(
          <div className="ph-ai-sender-bar">
            <Space orientation="vertical" size={8} style={{ width: '100%' }}>
              <AiChatAdvancedSettings
                expanded={settingsExpanded}
                hasModels={modelState.hasModels}
                modelLoading={modelState.loading}
                modelOptions={modelState.options}
                showModelSelect={false}
                value={currentSettings}
                onChange={updateCurrentSettings}
                onExpandedChange={setSettingsExpanded}
              />
              <AiComposer
                loading={isGenerating}
                model={{
                  value: currentSettings.modelId,
                  options: modelState.options,
                  loading: modelState.loading,
                  disabled: !modelState.hasModels,
                  placeholder: '选择对话模型',
                  onChange: (modelId) =>
                    updateCurrentSettings({ ...currentSettings, modelId }),
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
                leadingActions={(
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
                )}
                extraActions={(
                  <Button disabled={isGenerating} size="small" onClick={regenerate}>
                    重新生成
                  </Button>
                )}
                onChange={setValue}
                onClear={clearComposer}
                onOptimize={optimizePrompt}
                onStop={stopGenerating}
                onSubmit={submitMessage}
              />
            </Space>
          </div>
        )}
      />

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
