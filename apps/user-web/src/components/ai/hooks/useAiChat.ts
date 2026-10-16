import type { AiConversationSettings, AiMessage } from '@personal-hub/shared-types';
import { useCallback, useEffect, useRef, useState } from 'react';
import { regenerateAiMessage, stopAiMessage, streamAiChat, type SsePayload } from '@/services/ai';
import { createAiStreamRenderScheduler, type AiStreamRenderScheduler } from './aiStreamScheduler';

interface UseAiChatOptions {
  initialMessages: AiMessage[];
  sessionId?: string;
  modelId?: string;
  systemPrompt?: string;
  settings?: AiConversationSettings;
  /** 还没有会话时先建一条，避免登录用户回落到匿名接口。 */
  ensureSession?: () => Promise<string>;
  onMessagesChange?: (messages: AiMessage[], sessionId: string) => void;
  onComplete?: (messages: AiMessage[], tokenCount: number) => void;
  onError?: (message: string) => void;
}

function isPlaceholderSessionId(sessionId?: string) {
  return !sessionId || sessionId === 'pending-session' || sessionId.startsWith('msg-');
}

function createMessage(
  sessionId: string,
  role: AiMessage['role'],
  content: string,
  status: AiMessage['status'] = 'done',
): AiMessage {
  // 这是服务端响应前的 UI 临时键，不代表数据库中的会话或消息 ID。
  return {
    id: `msg-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    sessionId,
    role,
    content,
    status,
    createdAt: new Date().toISOString(),
  };
}

function messageListSignature(messages: AiMessage[]): string {
  return JSON.stringify(messages);
}

const MAX_CONCURRENT_CHATS = 3;

interface ActiveChatRun {
  assistantId: string;
  serverMessageId?: string;
  controller: AbortController;
  scheduler: AiStreamRenderScheduler<SsePayload>;
  stopRequested?: boolean;
}

/** 保留尚未入库的失败提问，且不让服务端未收尾的快照回退本地终态。 */
function mergeHistory(local: AiMessage[], remote: AiMessage[]): AiMessage[] {
  const byId = new Map(local.map((message) => [message.id, message]));
  const merged = remote.map((message) => {
    const previous = byId.get(message.id);
    if (!previous) return message;
    if (message.status === 'generating' && previous.status !== 'generating') return previous;
    if (message.status === 'failed' && !message.content && previous.content) {
      return { ...message, content: previous.content };
    }
    return message;
  });
  const remoteIds = new Set(remote.map((message) => message.id));
  return [
    ...merged,
    ...local.filter((message) => message.id.startsWith('msg-') && !remoteIds.has(message.id)),
  ];
}

/** 停止请求失败由全局请求层提示；保留流和名额，允许用户重试停止。 */
function requestRunStop(run: ActiveChatRun) {
  if (!run.serverMessageId) return;
  void stopAiMessage(run.serverMessageId).catch(() => {
    run.stopRequested = false;
  });
}

/**
 * Chat 流式状态。发送走 Canonical SSE；停止调用显式 stop 接口。
 */
export function useAiChat({
  initialMessages,
  sessionId = 'pending-session',
  modelId,
  ensureSession,
  onMessagesChange,
  onComplete,
  onError,
}: UseAiChatOptions) {
  const [messages, setMessages] = useState<AiMessage[]>(initialMessages);
  // 每条流只写自己的会话快照，切换视图不会改变流的归属。
  const messagesBySessionRef = useRef(new Map<string, AiMessage[]>([[sessionId, initialMessages]]));
  const [boundSessionId, setBoundSessionId] = useState(sessionId);
  const selectedSessionIdRef = useRef(sessionId);
  const [, setActiveRevision] = useState(0);
  const activeRunsRef = useRef(new Map<string, ActiveChatRun>());
  const creatingSessionRef = useRef(false);
  const creatingForSessionRef = useRef<string | undefined>(undefined);
  const lifecycleRef = useRef(0);
  const revisionsRef = useRef(new Map<string, number>());
  const lastInitialMessagesSignatureRef = useRef(
    new Map([[sessionId, messageListSignature(initialMessages)]]),
  );

  const initialMessagesSignature = messageListSignature(initialMessages);
  selectedSessionIdRef.current = sessionId;

  // 渲染期切换可避免闪现上一会话气泡；旧会话的流仍在后台继续。
  if (sessionId !== boundSessionId) {
    const cached = messagesBySessionRef.current.get(sessionId);
    const next = activeRunsRef.current.has(sessionId)
      ? (cached ?? initialMessages)
      : initialMessages.length
        ? mergeHistory(cached ?? [], initialMessages)
        : (cached ?? initialMessages);
    messagesBySessionRef.current.set(sessionId, next);
    setMessages(next);
    setBoundSessionId(sessionId);
    lastInitialMessagesSignatureRef.current.set(sessionId, initialMessagesSignature);
  }

  const commitMessages = useCallback(
    (targetSessionId: string, updater: AiMessage[] | ((current: AiMessage[]) => AiMessage[])) => {
      const currentMessages = messagesBySessionRef.current.get(targetSessionId) ?? [];
      const nextMessages = typeof updater === 'function' ? updater(currentMessages) : updater;
      messagesBySessionRef.current.set(targetSessionId, nextMessages);
      revisionsRef.current.set(
        targetSessionId,
        (revisionsRef.current.get(targetSessionId) ?? 0) + 1,
      );
      if (selectedSessionIdRef.current === targetSessionId) setMessages(nextMessages);
      onMessagesChange?.(nextMessages, targetSessionId);
      return nextMessages;
    },
    [onMessagesChange],
  );

  const getSessionRevision = useCallback((id: string) => revisionsRef.current.get(id) ?? 0, []);
  const applyHistory = useCallback(
    (id: string, remote: AiMessage[], revision: number) => {
      // 请求期间即使生成已开始并结束，版本变化也能识别出过期快照。
      if (activeRunsRef.current.has(id) || getSessionRevision(id) !== revision) return;
      commitMessages(id, (local) => mergeHistory(local, remote));
    },
    [commitMessages, getSessionRevision],
  );

  const refreshActive = useCallback(() => setActiveRevision((current) => current + 1), []);
  const isSessionGenerating = useCallback(
    (targetSessionId: string) => activeRunsRef.current.has(targetSessionId),
    [],
  );
  const activeRun = activeRunsRef.current.get(sessionId);
  const isGenerating = Boolean(activeRun);
  const isCreatingSession =
    creatingSessionRef.current && creatingForSessionRef.current === sessionId;

  const sendMessage = useCallback(
    async (content: string) => {
      const lifecycle = lifecycleRef.current;
      const normalized = content.trim();
      if (
        !normalized ||
        activeRunsRef.current.has(sessionId) ||
        (isPlaceholderSessionId(sessionId) && creatingSessionRef.current)
      ) {
        return false;
      }
      if (activeRunsRef.current.size + Number(creatingSessionRef.current) >= MAX_CONCURRENT_CHATS) {
        throw new Error('最多同时生成 3 条对话，请等待一条完成后重试');
      }
      let resolvedSessionId: string = sessionId;
      if (isPlaceholderSessionId(resolvedSessionId)) {
        if (!ensureSession) {
          throw new Error('无法创建对话，请刷新页面后重试');
        }
        creatingSessionRef.current = true;
        creatingForSessionRef.current = sessionId;
        refreshActive();
        try {
          resolvedSessionId = await ensureSession();
        } finally {
          creatingSessionRef.current = false;
          creatingForSessionRef.current = undefined;
          if (lifecycleRef.current === lifecycle) refreshActive();
        }
        if (lifecycleRef.current !== lifecycle) return false;
        messagesBySessionRef.current.set(resolvedSessionId, []);
      }
      const userMessage = createMessage(resolvedSessionId, 'user', normalized);
      const assistant = createMessage(resolvedSessionId, 'assistant', '', 'generating');
      commitMessages(resolvedSessionId, (current) => [...current, userMessage, assistant]);
      const controller = new AbortController();
      const run = {} as ActiveChatRun;
      run.assistantId = assistant.id;
      run.controller = controller;
      run.scheduler = createAiStreamRenderScheduler<SsePayload>(
        (chunk) => {
          if (activeRunsRef.current.get(resolvedSessionId) !== run) return;
          commitMessages(resolvedSessionId, (current) =>
            current.map((item) =>
              item.id === (run.serverMessageId ?? assistant.id)
                ? { ...item, content: `${item.content}${chunk}` }
                : item,
            ),
          );
        },
        (event) => {
          if (activeRunsRef.current.get(resolvedSessionId) !== run) return;
          const tokenCount = (event.usage?.inputTokens ?? 0) + (event.usage?.outputTokens ?? 0);
          const next = commitMessages(resolvedSessionId, (current) =>
            current.map((item) =>
              item.id === (run.serverMessageId ?? assistant.id)
                ? {
                    ...item,
                    status:
                      event.type === 'ERROR'
                        ? 'failed'
                        : event.status === 'stopped'
                          ? 'stopped'
                          : 'done',
                    tokenCount,
                    content:
                      event.type === 'ERROR' && !item.content
                        ? (event.message ?? event.code ?? '生成失败')
                        : item.content,
                    errorCode: event.type === 'ERROR' ? event.code : undefined,
                  }
                : item,
            ),
          );
          activeRunsRef.current.delete(resolvedSessionId);
          refreshActive();
          if (event.code !== 'AI_STREAM_CLIENT_FAILED') {
            void Promise.resolve()
              .then(() => onComplete?.(next, tokenCount))
              .catch(() => undefined);
          }
        },
      );
      activeRunsRef.current.set(resolvedSessionId, run);
      refreshActive();
      void streamAiChat({
        sessionId: resolvedSessionId,
        content: normalized,
        modelId,
        signal: controller.signal,
        onEvent: (event) => {
          if (activeRunsRef.current.get(resolvedSessionId) !== run) return;
          if (event.type === 'STARTED') {
            const assistantMessageId = event.assistantMessageId;
            if (assistantMessageId) {
              run.serverMessageId = assistantMessageId;
              if (run.stopRequested) requestRunStop(run);
              refreshActive();
            }
            commitMessages(resolvedSessionId, (current) =>
              current.map((item) => {
                if (item.id === userMessage.id && event.userMessageId) {
                  return { ...item, id: event.userMessageId };
                }
                if (item.id === assistant.id && assistantMessageId) {
                  return { ...item, id: assistantMessageId };
                }
                return item;
              }),
            );
          }
          if (event.type === 'DELTA' && event.content) {
            run.scheduler.enqueue(event.content);
          }
          if (event.type === 'DONE' || event.type === 'ERROR') {
            run.scheduler.finish(event);
          }
        },
      }).catch((error: unknown) => {
        if (activeRunsRef.current.get(resolvedSessionId) !== run) return;
        run.scheduler.finish({
          type: 'ERROR',
          message: error instanceof Error ? error.message : '生成失败',
          code: 'AI_STREAM_CLIENT_FAILED',
        });
      });
      return true;
    },
    [commitMessages, ensureSession, modelId, onComplete, refreshActive, sessionId],
  );

  const stopGenerating = useCallback(() => {
    const run = activeRunsRef.current.get(sessionId);
    if (!run || run.stopRequested) return;
    run.scheduler.flush();
    if (activeRunsRef.current.get(sessionId) !== run) return;
    // STARTED 前先记下停止意图；收到真实 ID 后再请求服务端停止。
    run.stopRequested = true;
    requestRunStop(run);
  }, [sessionId]);

  const regenerate = useCallback(
    (messageId?: string) => {
      if (activeRunsRef.current.has(sessionId)) return;
      if (activeRunsRef.current.size + Number(creatingSessionRef.current) >= MAX_CONCURRENT_CHATS) {
        throw new Error('最多同时生成 3 条对话，请等待一条完成后重试');
      }
      const lastAssistant = messageId
        ? messages.find((item) => item.id === messageId && item.role === 'assistant')
        : [...messages].reverse().find((item) => item.role === 'assistant');
      if (!lastAssistant || lastAssistant.id.startsWith('msg-')) {
        return;
      }
      const regenerateSessionId = lastAssistant.sessionId || sessionId;
      commitMessages(regenerateSessionId, (current) =>
        current.map((item) =>
          item.id === lastAssistant.id ? { ...item, content: '', status: 'generating' } : item,
        ),
      );
      const controller = new AbortController();
      const run = {} as ActiveChatRun;
      run.assistantId = lastAssistant.id;
      run.controller = controller;
      run.scheduler = createAiStreamRenderScheduler<SsePayload>(
        (chunk) => {
          if (activeRunsRef.current.get(regenerateSessionId) !== run) return;
          commitMessages(regenerateSessionId, (current) =>
            current.map((item) =>
              item.id === (run.serverMessageId ?? lastAssistant.id)
                ? { ...item, content: `${item.content}${chunk}` }
                : item,
            ),
          );
        },
        (event) => {
          if (activeRunsRef.current.get(regenerateSessionId) !== run) return;
          const next = commitMessages(regenerateSessionId, (current) =>
            current.map((item) =>
              item.id === (run.serverMessageId ?? lastAssistant.id)
                ? {
                    ...item,
                    status:
                      event.type === 'ERROR'
                        ? 'failed'
                        : event.status === 'stopped'
                          ? 'stopped'
                          : 'done',
                    content:
                      event.type === 'ERROR' && !run.serverMessageId
                        ? lastAssistant.content
                        : event.type === 'ERROR' && !item.content
                          ? (event.message ?? event.code ?? '生成失败')
                          : item.content,
                    errorCode: event.type === 'ERROR' ? event.code : undefined,
                  }
                : item,
            ),
          );
          activeRunsRef.current.delete(regenerateSessionId);
          refreshActive();
          if (event.type === 'ERROR') onError?.(event.message ?? '重新生成失败，请稍后重试');
          if (event.code !== 'AI_STREAM_CLIENT_FAILED') {
            const tokens = (event.usage?.inputTokens ?? 0) + (event.usage?.outputTokens ?? 0);
            void Promise.resolve()
              .then(() => onComplete?.(next, tokens))
              .catch(() => undefined);
          }
        },
      );
      activeRunsRef.current.set(regenerateSessionId, run);
      refreshActive();
      void regenerateAiMessage(
        lastAssistant.id,
        (event) => {
          if (activeRunsRef.current.get(regenerateSessionId) !== run) return;
          if (event.type === 'STARTED') {
            const assistantMessageId = event.assistantMessageId;
            if (assistantMessageId) {
              run.serverMessageId = assistantMessageId;
              if (run.stopRequested) requestRunStop(run);
              refreshActive();
            }
            if (assistantMessageId && assistantMessageId !== lastAssistant.id) {
              commitMessages(regenerateSessionId, (current) =>
                current.map((item) =>
                  item.id === lastAssistant.id ? { ...item, id: assistantMessageId } : item,
                ),
              );
            }
          }
          if (event.type === 'DELTA' && event.content) {
            run.scheduler.enqueue(event.content);
          }
          if (event.type === 'DONE' || event.type === 'ERROR') {
            run.scheduler.finish(event);
          }
        },
        controller.signal,
      ).catch((error: unknown) => {
        if (activeRunsRef.current.get(regenerateSessionId) !== run) return;
        run.scheduler.finish({
          type: 'ERROR',
          message: error instanceof Error ? error.message : '生成失败',
          code: 'AI_STREAM_CLIENT_FAILED',
        });
      });
    },
    [commitMessages, messages, onComplete, onError, refreshActive, sessionId],
  );

  // 离开页面才关闭当前页面持有的流；会话切换不触发清理。
  useEffect(() => {
    return () => {
      lifecycleRef.current += 1;
      for (const run of activeRunsRef.current.values()) {
        run.scheduler.cancel();
        run.controller.abort();
      }
      activeRunsRef.current.clear();
    };
  }, []);

  useEffect(() => {
    if (activeRunsRef.current.has(sessionId) || boundSessionId !== sessionId) return;
    if (lastInitialMessagesSignatureRef.current.get(sessionId) === initialMessagesSignature) return;
    lastInitialMessagesSignatureRef.current.set(sessionId, initialMessagesSignature);
    messagesBySessionRef.current.set(sessionId, initialMessages);
    setMessages(initialMessages);
  }, [boundSessionId, initialMessages, initialMessagesSignature, sessionId]);

  return {
    messages,
    isCreatingSession,
    isGenerating,
    isSessionGenerating,
    getSessionRevision,
    applyHistory,
    sendMessage,
    stopGenerating,
    regenerate,
  };
}
