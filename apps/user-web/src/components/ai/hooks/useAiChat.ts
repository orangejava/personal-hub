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
  onMessagesChange?: (messages: AiMessage[]) => void;
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
  const [boundSessionId, setBoundSessionId] = useState(sessionId);
  const [streamingMessageId, setStreamingMessageId] = useState<string>();
  const abortRef = useRef<AbortController | undefined>(undefined);
  const serverMessageIdRef = useRef<string | undefined>(undefined);
  const lastInitialMessagesSignatureRef = useRef(
    messageListSignature(initialMessages),
  );

  const initialMessagesSignature = messageListSignature(initialMessages);

  // 切会话必须在渲染期清空气泡，等 effect 会闪一帧旧消息。
  if (sessionId !== boundSessionId) {
    setBoundSessionId(sessionId);
    setMessages(initialMessages);
    setStreamingMessageId(undefined);
    serverMessageIdRef.current = undefined;
    lastInitialMessagesSignatureRef.current = initialMessagesSignature;
  }

  const commitMessages = useCallback(
    (updater: AiMessage[] | ((current: AiMessage[]) => AiMessage[])) => {
      setMessages((current) => {
        const nextMessages = typeof updater === 'function' ? updater(current) : updater;
        onMessagesChange?.(nextMessages);
        return nextMessages;
      });
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
      }
      const userMessage = createMessage(resolvedSessionId, 'user', normalized);
      const assistant = createMessage(resolvedSessionId, 'assistant', '', 'generating');
      commitMessages((current) => [...current, userMessage, assistant]);
      setStreamingMessageId(assistant.id);
      const controller = new AbortController();
      abortRef.current = controller;
      void streamAiChat({
        sessionId: resolvedSessionId,
        content: normalized,
        modelId,
        signal: controller.signal,
        onEvent: (event) => {
          if (event.type === 'STARTED' && event.assistantMessageId) {
            const assistantMessageId = event.assistantMessageId;
            serverMessageIdRef.current = assistantMessageId;
            setStreamingMessageId(assistantMessageId);
            commitMessages((current) =>
              current.map((item) =>
                item.id === assistant.id
                  ? { ...item, id: assistantMessageId }
                  : item,
              ),
            );
          }
          if (event.type === 'DELTA' && event.content) {
            commitMessages((current) =>
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
            commitMessages((current) => {
              const next = current.map((item) =>
                item.id === (serverMessageIdRef.current ?? assistant.id)
                  ? {
                      ...item,
                      status: event.type === 'ERROR' ? ('failed' as const) : ('done' as const),
                      tokenCount,
                    }
                  : item,
              );
              onComplete?.(next, tokenCount);
              return next;
            });
            setStreamingMessageId(undefined);
          }
        },
      }).catch((error: unknown) => {
        commitMessages((current) =>
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
      });
    },
    [commitMessages, ensureSession, modelId, onComplete, sessionId, streamingMessageId],
  );

  const stopGenerating = useCallback(() => {
    const messageId = serverMessageIdRef.current ?? streamingMessageId;
    abortLocal();
    if (messageId && !messageId.startsWith('msg-')) {
      void stopAiMessage(messageId);
    }
    commitMessages((current) =>
      current.map((message) =>
        message.id === messageId || message.id === streamingMessageId
          ? { ...message, status: 'stopped' }
          : message,
      ),
    );
    setStreamingMessageId(undefined);
  }, [abortLocal, commitMessages, streamingMessageId]);

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
    commitMessages((current) =>
      current.map((item) =>
        item.id === lastAssistant.id ? { ...item, content: '', status: 'generating' } : item,
      ),
    );
    setStreamingMessageId(lastAssistant.id);
    const controller = new AbortController();
    abortRef.current = controller;
    void regenerateAiMessage(
      lastAssistant.id,
      (event) => {
        if (event.type === 'STARTED' && event.assistantMessageId) {
          serverMessageIdRef.current = event.assistantMessageId;
          setStreamingMessageId(event.assistantMessageId);
        }
        if (event.type === 'DELTA' && event.content) {
          commitMessages((current) =>
            current.map((item) =>
              item.id === (serverMessageIdRef.current ?? lastAssistant.id)
                ? { ...item, content: `${item.content}${event.content}` }
                : item,
            ),
          );
        }
        if (event.type === 'DONE' || event.type === 'ERROR') {
          commitMessages((current) =>
            current.map((item) =>
              item.id === (serverMessageIdRef.current ?? lastAssistant.id)
                ? { ...item, status: event.type === 'ERROR' ? 'failed' : 'done' }
                : item,
            ),
          );
          setStreamingMessageId(undefined);
        }
      },
      controller.signal,
    );
  }, [commitMessages, messages, streamingMessageId]);

  useEffect(() => () => abortLocal(), [abortLocal, sessionId]);

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
