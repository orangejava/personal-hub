export interface SsePayload {
  type: string;
  content?: string;
  requestId?: string;
  sessionId?: string;
  userMessageId?: string;
  assistantMessageId?: string;
  code?: string;
  message?: string;
  usage?: { inputTokens?: number; outputTokens?: number; platformCost?: number };
}

/**
 * 解析一个完整的 SSE 事件。网络 chunk 可能包含半个事件或多个事件，不能直接按
 * chunk 解析；SSE 的 data 行需要先按协议拼接，再解析为 JSON。
 */
export function parseAiSseBlock(block: string): SsePayload | null {
  const data = block
    .split(/\r?\n/)
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).trimStart())
    .join('\n')
    .trim();
  if (!data) {
    return null;
  }
  try {
    return JSON.parse(data) as SsePayload;
  } catch {
    throw new Error('AI_SSE_INVALID_EVENT');
  }
}

export function takeAiSseBlock(buffer: string): { block?: string; rest: string } {
  const match = /\r?\n\r?\n/.exec(buffer);
  if (!match || match.index === undefined) {
    return { rest: buffer };
  }
  return {
    block: buffer.slice(0, match.index),
    rest: buffer.slice(match.index + match[0].length),
  };
}
