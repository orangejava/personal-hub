import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../../config/env.schema';
import type { AiChatProvider, ChatDelta, ChatProviderInput } from './ai-provider.types';

function takeSseBlock(buffer: string): { block?: string; rest: string } {
  const match = /\r?\n\r?\n/.exec(buffer);
  if (!match || match.index === undefined) {
    return { rest: buffer };
  }
  return {
    block: buffer.slice(0, match.index),
    rest: buffer.slice(match.index + match[0].length),
  };
}

/**
 * 把 OpenAI Chat Completions SSE 拆成增量文本。
 * 独立导出方便单测覆盖 DONE / usage / 半包，不依赖真实外网。
 */
export function parseOpenAiSseBlock(block: string): ChatDelta | 'done' | null {
  const data = block
    .split(/\r?\n/)
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).trimStart())
    .join('\n')
    .trim();
  if (!data) {
    return null;
  }
  if (data === '[DONE]') {
    return 'done';
  }
  let parsed: {
    choices?: Array<{ delta?: { content?: string }; finish_reason?: string | null }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
    error?: { message?: string; code?: string };
  };
  try {
    parsed = JSON.parse(data) as typeof parsed;
  } catch {
    throw new Error('AI_UPSTREAM_INVALID_SSE');
  }
  if (parsed.error) {
    throw new Error('AI_UPSTREAM_ERROR');
  }
  try {
    const content = parsed.choices?.[0]?.delta?.content ?? '';
    const usage = parsed.usage
      ? {
          inputTokens: parsed.usage.prompt_tokens ?? 0,
          outputTokens: parsed.usage.completion_tokens ?? 0,
        }
      : undefined;
    if (!content && !usage) {
      return null;
    }
    return { content, usage };
  } catch {
    throw new Error('AI_UPSTREAM_INVALID_SSE');
  }
}

/**
 * OpenAI Chat Completions 兼容协议。Key 只从环境变量读取，前端永远碰不到。
 * 未配置 Key 时模块工厂会回落 Fake，本类不会被选中。
 */
@Injectable()
export class OpenAiCompatibleTextProvider implements AiChatProvider {
  private readonly logger = new Logger(OpenAiCompatibleTextProvider.name);

  constructor(private readonly config: ConfigService<Env, true>) {}

  async *stream(input: ChatProviderInput): AsyncIterable<ChatDelta> {
    const baseUrl = (
      this.config.get('AI_OPENAI_BASE_URL', { infer: true }) ?? 'https://api.openai.com/v1'
    ).replace(/\/$/, '');
    const apiKey = this.config.get('AI_OPENAI_API_KEY', { infer: true });
    const model = this.config.get('AI_OPENAI_MODEL', { infer: true }) ?? input.modelKey;
    const timeoutMs = this.config.get('AI_OPENAI_TIMEOUT_MS', { infer: true });
    if (!apiKey) {
      throw new Error('未配置 AI_OPENAI_API_KEY');
    }

    const timeout = AbortSignal.timeout(timeoutMs);
    const signal = AbortSignal.any([input.signal, timeout]);
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        stream: true,
        stream_options: { include_usage: true },
        messages: [
          ...(input.systemPrompt ? [{ role: 'system' as const, content: input.systemPrompt }] : []),
          ...input.messages,
        ],
      }),
      signal,
    });
    if (!response.ok || !response.body) {
      const text = await response.text().catch(() => '');
      this.logger.warn(`上游 ${response.status}: ${text.slice(0, 200)}`);
      throw new Error(`OPENAI_COMPATIBLE_${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    try {
      while (true) {
        if (input.signal.aborted) {
          return;
        }
        const { done, value } = await reader.read();
        if (done) {
          buffer += decoder.decode();
          break;
        }
        buffer += decoder.decode(value, { stream: true });
        while (true) {
          const next = takeSseBlock(buffer);
          if (next.block === undefined) {
            buffer = next.rest;
            break;
          }
          buffer = next.rest;
          const block = next.block;
          const parsed = parseOpenAiSseBlock(block);
          if (parsed === 'done') {
            return;
          }
          if (parsed) {
            yield parsed;
          }
        }
      }
      // 上游最后一帧常常不带空行，循环结束后还要把尾巴解析掉。
      if (buffer.trim()) {
        const parsed = parseOpenAiSseBlock(buffer);
        if (parsed && parsed !== 'done') {
          yield parsed;
        }
      }
    } catch (error) {
      await reader.cancel().catch(() => undefined);
      throw error;
    } finally {
      reader.releaseLock();
    }
  }
}
