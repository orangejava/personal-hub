import type {
  AiConversationSettings,
  AiMessage,
  AiMessagePart,
} from '@personal-hub/shared-types';
import { useCallback, useEffect, useRef, useState } from 'react';
import { persistAiChatMessages } from '@/services/ai';

interface UseAiChatMockOptions {
  initialMessages: AiMessage[];
  sessionId?: string;
  modelId?: string;
  systemPrompt?: string;
  settings?: AiConversationSettings;
  onMessagesChange?: (messages: AiMessage[]) => void;
  onComplete?: (messages: AiMessage[], tokenCount: number) => void;
}

const mockAnswerParts: AiMessagePart[] = [
  {
    id: 'part-reasoning',
    type: 'reasoning',
    title: '思考过程',
    status: 'processing',
    content: '我会先判断用户目标，再把它拆成约束、方案和可验证步骤。',
  },
  {
    id: 'part-thought-1',
    type: 'thought_chain',
    title: '理解目标',
    status: 'success',
    content: '确认输入里真正要解决的问题，以及哪些内容不能被破坏。',
  },
  {
    id: 'part-thought-2',
    type: 'thought_chain',
    title: '组织方案',
    status: 'success',
    content: '优先沿用现有 service、mock、layout 和本地封装层。',
  },
  {
    id: 'part-content-1',
    type: 'content',
    content: '我先按你的输入拆成三个部分：目标、约束和可执行步骤。',
  },
  {
    id: 'part-content-2',
    type: 'content',
    content: '\n\n1. 目标：把问题收敛成可以直接执行的任务。',
  },
  {
    id: 'part-content-3',
    type: 'content',
    content: '\n2. 约束：保留现有功能，不绕过项目既有 service / mock / layout 约定。',
  },
  {
    id: 'part-content-4',
    type: 'content',
    content: '\n3. 下一步：先生成一个可验证的草稿，再根据反馈继续细化。',
  },
  {
    id: 'part-source',
    type: 'source',
    title: '当前会话上下文',
    content: 'mock-source-current-chat',
  },
  {
    id: 'part-done',
    type: 'done',
    content: '',
  },
];

function mergeContentFromParts(parts: AiMessagePart[]) {
  return parts
    .filter((part) => part.type === 'content')
    .map((part) => part.content)
    .join('');
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

/**
 * Chat mock 状态流。
 *
 * 这里不直接写真实请求，先模拟“发送 → 流式输出 → 停止 / 重新生成”，
 * 让页面交互与后续 SSE 接入的状态边界保持一致。
 */
export function useAiChatMock({
  initialMessages,
  sessionId = 'mock-session',
  modelId,
  systemPrompt,
  settings,
  onMessagesChange,
  onComplete,
}: UseAiChatMockOptions) {
  const [messages, setMessages] = useState<AiMessage[]>(initialMessages);
  const [streamingMessageId, setStreamingMessageId] = useState<string>();
  const timerRef = useRef<number | undefined>(undefined);
  const partsRef = useRef<AiMessagePart[]>([]);
  const lastSessionIdRef = useRef<string | undefined>(undefined);
  const lastInitialMessagesSignatureRef = useRef<string>('');

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = undefined;
    }
  }, []);

  const commitMessages = useCallback(
    (updater: AiMessage[] | ((current: AiMessage[]) => AiMessage[])) => {
      setMessages((current) => {
        const nextMessages =
          typeof updater === 'function' ? updater(current) : updater;
        onMessagesChange?.(nextMessages);
        return nextMessages;
      });
    },
    [onMessagesChange],
  );

  const startAssistantStream = useCallback(
    (
      baseContent = '',
      options: {
        userMessage?: AiMessage;
        replaceLastAssistant?: boolean;
      } = {},
    ) => {
      const { userMessage, replaceLastAssistant } = options;
      clearTimer();
      const promptPreview = systemPrompt?.trim()
        ? `\n\n> 当前 System Prompt：${systemPrompt.trim().slice(0, 80)}${systemPrompt.trim().length > 80 ? '...' : ''}`
        : '';
      const modelPreview = modelId ? `（模型：${modelId}）\n\n` : '';
      const assistant = createMessage(
        sessionId,
        'assistant',
        `${baseContent}${modelPreview}${promptPreview}`,
        'generating',
      );
      let assistantDraft = assistant;
      partsRef.current = [...mockAnswerParts];
      setStreamingMessageId(assistant.id);
      commitMessages((current) => [...current, assistant]);

      const tick = () => {
        const nextPart = partsRef.current.shift();
        if (!nextPart) {
          const finalAssistant = {
            ...assistantDraft,
            status: 'done' as const,
            tokenCount: Math.max(80, Math.ceil(assistantDraft.content.length / 2)),
          };
          const userTokenCount = userMessage
            ? Math.max(20, Math.ceil(userMessage.content.length / 2))
            : 0;
          const completedTokenCount = userTokenCount + finalAssistant.tokenCount;
          commitMessages((current) => {
            const nextMessages = current.map((message) =>
              message.id === assistant.id ? finalAssistant : message,
            );
            return nextMessages;
          });
          setStreamingMessageId(undefined);
          const persistInputMessages = userMessage
            ? [
                { ...userMessage, tokenCount: userTokenCount },
                finalAssistant,
              ]
            : [finalAssistant];
          persistAiChatMessages(sessionId, {
            settings: {
              ...settings,
              modelId,
              systemPrompt,
            },
            title: userMessage?.content.slice(0, 20),
            replaceLastAssistant,
            messages: persistInputMessages.map(
              ({ role, content, status, createdAt, tokenCount, parts }) => ({
                role,
                content,
                status,
                createdAt,
                tokenCount,
                parts,
              }),
            ),
          })
            .then((res) => {
              onMessagesChange?.(res.messages);
              setMessages(res.messages);
            })
            .finally(() => {
              onComplete?.(persistInputMessages, completedTokenCount);
            });
          return;
        }
        const nextParts = [...(assistantDraft.parts ?? []), nextPart].map((part) =>
          part.type === 'reasoning' ? { ...part, status: 'success' as const } : part,
        );
        assistantDraft = {
          ...assistantDraft,
          parts: nextParts,
          content: `${assistant.content}${mergeContentFromParts(nextParts)}`,
        };
        commitMessages((current) =>
          current.map((message) =>
            message.id === assistant.id
              ? {
                  ...message,
                  content: assistantDraft.content,
                  parts: assistantDraft.parts,
                }
              : message,
          ),
        );
        timerRef.current = window.setTimeout(tick, 360);
      };

      timerRef.current = window.setTimeout(tick, 260);
    },
    [clearTimer, commitMessages, modelId, onComplete, onMessagesChange, sessionId, systemPrompt],
  );

  const sendMessage = useCallback(
    (content: string) => {
      const normalized = content.trim();
      if (!normalized || streamingMessageId) return;
      const userMessage = createMessage(sessionId, 'user', normalized);
      commitMessages((current) => [...current, userMessage]);
      startAssistantStream('', { userMessage });
    },
    [commitMessages, sessionId, startAssistantStream, streamingMessageId],
  );

  const stopGenerating = useCallback(() => {
    if (!streamingMessageId) return;
    clearTimer();
    commitMessages((current) =>
      current.map((message) =>
        message.id === streamingMessageId
          ? { ...message, status: 'stopped', content: `${message.content}\n\n（已停止生成）` }
          : message,
      ),
    );
    setStreamingMessageId(undefined);
  }, [clearTimer, commitMessages, streamingMessageId]);

  const regenerate = useCallback(() => {
    if (streamingMessageId) return;
    commitMessages((current) => {
      const lastAssistantIndex = current.findLastIndex(
        (message) => message.role === 'assistant',
      );
      if (lastAssistantIndex < 0) return current;
      return current.slice(0, lastAssistantIndex);
    });
    startAssistantStream('我重新生成一个版本：', { replaceLastAssistant: true });
  }, [commitMessages, startAssistantStream, streamingMessageId]);

  useEffect(() => {
    const initialMessagesSignature = initialMessages
      .map(
        (message) =>
          `${message.id}:${message.status}:${message.createdAt}:${message.feedback ?? ''}:${message.feedbackAt ?? ''}`,
      )
      .join('|');
    if (lastSessionIdRef.current === sessionId) return;
    lastSessionIdRef.current = sessionId;
    lastInitialMessagesSignatureRef.current = initialMessagesSignature;
    setMessages(initialMessages);
    clearTimer();
    setStreamingMessageId(undefined);
  }, [clearTimer, initialMessages, sessionId]);

  useEffect(() => {
    if (streamingMessageId) return;
    const initialMessagesSignature = initialMessages
      .map(
        (message) =>
          `${message.id}:${message.status}:${message.createdAt}:${message.feedback ?? ''}:${message.feedbackAt ?? ''}`,
      )
      .join('|');
    if (lastInitialMessagesSignatureRef.current === initialMessagesSignature) return;
    lastInitialMessagesSignatureRef.current = initialMessagesSignature;
    setMessages(initialMessages);
  }, [initialMessages, streamingMessageId]);

  useEffect(() => () => clearTimer(), [clearTimer]);

  return {
    messages,
    isGenerating: Boolean(streamingMessageId),
    sendMessage,
    stopGenerating,
    regenerate,
  };
}
