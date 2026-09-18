import type { AiConversationSettings, AiMessage } from '@personal-hub/shared-types';
import { useCallback, useEffect, useRef, useState } from 'react';
import { regenerateAiMessage, stopAiMessage, streamAiChat } from '@/services/ai';

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
  return messages
    .map(
      (message) =>
        `${message.id}:${message.status}:${message.createdAt}:${message.feedback ?? ''}:${message.feedbackAt ?? ''}`,
    )
    .join('|');
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
}: UseAiChatOptions) {
  const [messages, setMessages] = useState<AiMessage[]>(initialMessages);
  // SSE 回调可能连续到达，用 ref 保留最新快照，避免把副作用放进 state updater。
  const messagesRef = useRef(initialMessages);
  const [boundSessionId, setBoundSessionId] = useState(sessionId);
  const [streamingMessageId, setStreamingMessageId] = useState<string>();
  const abortRef = useRef<AbortController | undefined>(undefined);
  const serverMessageIdRef = useRef<string | undefined>(undefined);
  const streamSessionIdRef = useRef(sessionId);
  const streamRunRef = useRef(0);
  const lastInitialMessagesSignatureRef = useRef(
    messageListSignature(initialMessages),
  );

  const initialMessagesSignature = messageListSignature(initialMessages);

  // 切会话必须在渲染期清空气泡，等 effect 会闪一帧旧消息。
  if (sessionId !== boundSessionId) {
    streamRunRef.current += 1;
    setBoundSessionId(sessionId);
    messagesRef.current = initialMessages;
    setMessages(initialMessages);
    setStreamingMessageId(undefined);
    serverMessageIdRef.current = undefined;
    streamSessionIdRef.current = sessionId;
    lastInitialMessagesSignatureRef.current = initialMessagesSignature;
  }

  const commitMessages = useCallback(
    (
      targetSessionId: string,
      updater: AiMessage[] | ((current: AiMessage[]) => AiMessage[]),
    ) => {
      const currentMessages = messagesRef.current;
      const nextMessages =
        typeof updater === 'function' ? updater(currentMessages) : updater;
      messagesRef.current = nextMessages;
      setMessages(nextMessages);
      onMessagesChange?.(nextMessages, targetSessionId);
      return nextMessages;
    },
    [onMessagesChange],
  );

  const abortLocal = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = undefined;
  }, []);

  const sendMessage = useCallback(
    async (content: string) => {
      const normalized = content.trim();
      if (!normalized || streamingMessageId) {
        return;
      }
      let resolvedSessionId = sessionId;
      if (isPlaceholderSessionId(resolvedSessionId)) {
        if (!ensureSession) {
          return;
        }
        resolvedSessionId = await ensureSession();
        messagesRef.current = [];
        setMessages([]);
      }
      streamSessionIdRef.current = resolvedSessionId;
      const userMessage = createMessage(resolvedSessionId, 'user', normalized);
      const assistant = createMessage(resolvedSessionId, 'assistant', '', 'generating');
      const streamRun = streamRunRef.current + 1;
      streamRunRef.current = streamRun;
      commitMessages(resolvedSessionId, (current) => [...current, userMessage, assistant]);
      serverMessageIdRef.current = undefined;
      setStreamingMessageId(assistant.id);
      const controller = new AbortController();
      abortRef.current = controller;
      void streamAiChat({
        sessionId: resolvedSessionId,
        content: normalized,
        modelId,
        signal: controller.signal,
        onEvent: (event) => {
          if (streamRunRef.current !== streamRun) return;
          if (event.type === 'STARTED') {
            const assistantMessageId = event.assistantMessageId;
            if (assistantMessageId) {
              serverMessageIdRef.current = assistantMessageId;
              setStreamingMessageId(assistantMessageId);
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
            commitMessages(resolvedSessionId, (current) =>
              current.map((item) =>
                item.id === (serverMessageIdRef.current ?? assistant.id)
                  ? { ...item, content: `${item.content}${event.content}` }
                  : item,
              ),
            );
          }
          if (event.type === 'DONE' || event.type === 'ERROR') {
            const tokenCount =
              (event.usage?.inputTokens ?? 0) + (event.usage?.outputTokens ?? 0);
            const next = commitMessages(resolvedSessionId, (current) =>
              current.map((item) =>
                item.id === (serverMessageIdRef.current ?? assistant.id)
                  ? {
                      ...item,
                      status: event.type === 'ERROR' ? ('failed' as const) : ('done' as const),
                      tokenCount,
                      content:
                        event.type === 'ERROR' && !item.content
                          ? event.message ?? event.code ?? '生成失败'
                          : item.content,
                    }
                  : item,
              ),
            );
            onComplete?.(next, tokenCount);
            setStreamingMessageId(undefined);
            streamRunRef.current += 1;
          }
        },
      }).catch((error: unknown) => {
        if (streamRunRef.current !== streamRun) return;
        commitMessages(resolvedSessionId, (current) =>
          current.map((item) =>
            item.id === (serverMessageIdRef.current ?? assistant.id)
              ? {
                  ...item,
                  status: 'failed',
                  content: item.content || (error instanceof Error ? error.message : '生成失败'),
                }
              : item,
          ),
        );
        setStreamingMessageId(undefined);
        streamRunRef.current += 1;
      });
    },
    [commitMessages, ensureSession, modelId, onComplete, sessionId, streamingMessageId],
  );

  const stopGenerating = useCallback(() => {
    streamRunRef.current += 1;
    const messageId = serverMessageIdRef.current ?? streamingMessageId;
    abortLocal();
    if (messageId && !messageId.startsWith('msg-')) {
      void stopAiMessage(messageId);
    }
    commitMessages(streamSessionIdRef.current ?? sessionId, (current) =>
      current.map((message) =>
        message.id === messageId || message.id === streamingMessageId
          ? { ...message, status: 'stopped' }
          : message,
      ),
    );
    setStreamingMessageId(undefined);
  }, [abortLocal, commitMessages, sessionId, streamingMessageId]);

  const regenerate = useCallback((messageId?: string) => {
    if (streamingMessageId) {
      return;
    }
    const lastAssistant = messageId
      ? messages.find((item) => item.id === messageId && item.role === 'assistant')
      : [...messages].reverse().find((item) => item.role === 'assistant');
    if (!lastAssistant || lastAssistant.id.startsWith('msg-')) {
      return;
    }
    const regenerateSessionId = lastAssistant.sessionId || streamSessionIdRef.current || sessionId;
    streamSessionIdRef.current = regenerateSessionId;
    const streamRun = streamRunRef.current + 1;
    streamRunRef.current = streamRun;
    commitMessages(regenerateSessionId, (current) =>
      current.map((item) =>
        item.id === lastAssistant.id ? { ...item, content: '', status: 'generating' } : item,
      ),
    );
    serverMessageIdRef.current = undefined;
    setStreamingMessageId(lastAssistant.id);
    const controller = new AbortController();
    abortRef.current = controller;
    void regenerateAiMessage(
      lastAssistant.id,
      (event) => {
        if (streamRunRef.current !== streamRun) return;
        if (event.type === 'STARTED') {
          const assistantMessageId = event.assistantMessageId;
          if (assistantMessageId) {
            serverMessageIdRef.current = assistantMessageId;
            setStreamingMessageId(assistantMessageId);
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
          commitMessages(regenerateSessionId, (current) =>
            current.map((item) =>
              item.id === (serverMessageIdRef.current ?? lastAssistant.id)
                ? { ...item, content: `${item.content}${event.content}` }
                : item,
            ),
          );
        }
        if (event.type === 'DONE' || event.type === 'ERROR') {
          commitMessages(regenerateSessionId, (current) =>
            current.map((item) =>
              item.id === (serverMessageIdRef.current ?? lastAssistant.id)
                ? {
                    ...item,
                    status: event.type === 'ERROR' ? 'failed' : 'done',
                    content:
                      event.type === 'ERROR' && !item.content
                        ? event.message ?? event.code ?? '生成失败'
                        : item.content,
                  }
                : item,
            ),
          );
          setStreamingMessageId(undefined);
          streamRunRef.current += 1;
        }
      },
      controller.signal,
    ).catch((error: unknown) => {
      if (streamRunRef.current !== streamRun) return;
      commitMessages(regenerateSessionId, (current) =>
        current.map((item) =>
          item.id === (serverMessageIdRef.current ?? lastAssistant.id)
            ? {
                ...item,
                status: 'failed',
                content: item.content || (error instanceof Error ? error.message : '生成失败'),
              }
            : item,
        ),
      );
      setStreamingMessageId(undefined);
      streamRunRef.current += 1;
    });
  }, [commitMessages, messages, sessionId, streamingMessageId]);

  useEffect(() => {
    return () => {
      streamRunRef.current += 1;
      abortLocal();
    };
  }, [abortLocal, sessionId]);

  useEffect(() => {
    if (streamingMessageId) {
      return;
    }
    if (boundSessionId !== sessionId) {
      return;
    }
    if (lastInitialMessagesSignatureRef.current === initialMessagesSignature) {
      return;
    }
    lastInitialMessagesSignatureRef.current = initialMessagesSignature;
    messagesRef.current = initialMessages;
    setMessages(initialMessages);
  }, [
    boundSessionId,
    initialMessages,
    initialMessagesSignature,
    sessionId,
    streamingMessageId,
  ]);

  return {
    messages,
    isGenerating: Boolean(streamingMessageId),
    sendMessage,
    stopGenerating,
    regenerate,
  };
}
