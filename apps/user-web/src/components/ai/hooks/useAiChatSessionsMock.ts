import type {
  AiConversation,
  AiConversationSettings,
  AiMessage,
} from '@personal-hub/shared-types';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { createAiSession, deleteAiSession, updateAiSession } from '@/services/ai';

const defaultSessionSettings = {
  modelId: 'qwen-turbo',
  systemPrompt:
    '你是 Personal Hub AI，回答时先理解用户目标，再给出结构清晰、可执行的建议。',
  contextLimit: 20,
  enableKnowledgeReference: true,
};

interface UseAiChatSessionsMockOptions {
  initialSessions: AiConversation[];
  initialMessages: AiMessage[];
  initialSessionId?: string;
}

/**
 * Chat 会话管理 mock。
 *
 * 阶段 5 先把“新建、切换、重命名、删除”完整跑通在前端本地状态中；
 * 后续接真实接口时，页面层仍可沿用这些动作语义，只替换 hook 内部的数据来源。
 */
export function useAiChatSessionsMock({
  initialSessions,
  initialMessages,
  initialSessionId,
}: UseAiChatSessionsMockOptions) {
  const [sessions, setSessions] = useState<AiConversation[]>(initialSessions);
  const [activeSessionId, setActiveSessionId] = useState<string>();
  const [messagesBySession, setMessagesBySession] = useState<
    Record<string, AiMessage[]>
  >({});

  useEffect(() => {
    setSessions(initialSessions);
  }, [initialSessions]);

  useEffect(() => {
    if (
      !initialSessionId ||
      !initialSessions.some((session) => session.id === initialSessionId)
    ) {
      return;
    }
    setActiveSessionId(initialSessionId);
  }, [initialSessionId, initialSessions]);

  useEffect(() => {
    setMessagesBySession((current) => {
      const next = { ...current };
      for (const message of initialMessages) {
        if (!next[message.sessionId]) {
          next[message.sessionId] = [];
        }
        if (!next[message.sessionId].some((item) => item.id === message.id)) {
          next[message.sessionId] = [...next[message.sessionId], message];
        }
      }
      return next;
    });
  }, [initialMessages]);

  const currentSessionId = activeSessionId ?? sessions[0]?.id;

  useEffect(() => {
    if (!currentSessionId && sessions.length > 0) {
      setActiveSessionId(sessions[0].id);
      return;
    }
    if (
      currentSessionId &&
      sessions.length > 0 &&
      !sessions.some((session) => session.id === currentSessionId)
    ) {
      setActiveSessionId(sessions[0]?.id);
    }
  }, [currentSessionId, sessions]);

  const currentMessages = useMemo(
    () => {
      if (!currentSessionId) return [];
      return messagesBySession[currentSessionId] ?? [];
    },
    [currentSessionId, messagesBySession],
  );

  const createNewSession = useCallback(async () => {
    const res = await createAiSession({
      title: '新对话',
      settings: defaultSessionSettings,
    });
    const session = res;
    setSessions((current) => [session, ...current.filter((item) => item.id !== session.id)]);
    setMessagesBySession((current) => ({ ...current, [session.id]: [] }));
    setActiveSessionId(session.id);
    return session.id;
  }, []);

  const renameSession = useCallback((sessionId: string, title: string) => {
    const normalizedTitle = title.trim();
    if (!normalizedTitle) return;
    setSessions((current) =>
      current.map((session) =>
        session.id === sessionId ? { ...session, title: normalizedTitle } : session,
      ),
    );
    updateAiSession(sessionId, { title: normalizedTitle }).then((res) => {
      if (!res) return;
      setSessions((current) =>
        current.map((session) => (session.id === sessionId ? res : session)),
      );
    });
  }, []);

  const updateSessionSettings = useCallback(
    (sessionId: string, settings: AiConversationSettings) => {
      setSessions((current) =>
        current.map((session) =>
          session.id === sessionId ? { ...session, ...settings } : session,
        ),
      );
      updateAiSession(sessionId, { settings }).then((res) => {
        if (!res) return;
        setSessions((current) =>
          current.map((session) => (session.id === sessionId ? res : session)),
        );
      });
    },
    [],
  );

  const deleteSession = useCallback((sessionId: string) => {
    setSessions((current) => current.filter((session) => session.id !== sessionId));
    setMessagesBySession((current) => {
      const next = { ...current };
      delete next[sessionId];
      return next;
    });
    setActiveSessionId((current) => (current === sessionId ? undefined : current));
    deleteAiSession(sessionId);
  }, []);

  const updateCurrentMessages = useCallback(
    (messages: AiMessage[] | ((current: AiMessage[]) => AiMessage[])) => {
      if (!currentSessionId) return;
      setMessagesBySession((current) => {
        const currentMessages = current[currentSessionId] ?? [];
        const nextMessages =
          typeof messages === 'function' ? messages(currentMessages) : messages;
        if (nextMessages === currentMessages) {
          return current;
        }
        return { ...current, [currentSessionId]: nextMessages };
      });
    },
    [currentSessionId],
  );

  const setSessionMessages = useCallback((sessionId: string, messages: AiMessage[]) => {
    setMessagesBySession((current) => ({ ...current, [sessionId]: messages }));
  }, []);

  const syncSessionAfterMessagesChange = useCallback(
    (messages: AiMessage[]) => {
      if (!currentSessionId) return;
      const lastMessage = messages.at(-1);
      const totalTokens = messages.reduce(
        (sum, message) =>
          sum +
          (message.tokenCount ?? Math.max(20, Math.ceil(message.content.length / 2))),
        0,
      );
      const firstUserMessage = messages.find((message) => message.role === 'user');
      setSessions((current) =>
        current.map((session) =>
          session.id === currentSessionId
            ? {
                ...session,
                title:
                  session.messageCount === 0 && firstUserMessage
                    ? firstUserMessage.content.slice(0, 20)
                    : session.title,
                messageCount: messages.length,
                totalTokens,
                lastMessageAt: lastMessage?.createdAt ?? session.lastMessageAt,
              }
            : session,
        ),
      );
    },
    [currentSessionId],
  );

  return {
    sessions,
    currentSessionId,
    currentMessages,
    setActiveSessionId,
    createNewSession,
    renameSession,
    updateSessionSettings,
    deleteSession,
    updateCurrentMessages,
    setSessionMessages,
    syncSessionAfterMessagesChange,
  };
}
