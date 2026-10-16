import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  OpenAiCompatibleTextProvider,
  parseOpenAiSseBlock,
} from '../src/modules/ai/providers/openai-compatible-text.provider';

describe('OpenAI 兼容 SSE 解析', () => {
  it('解析增量文本', () => {
    const parsed = parseOpenAiSseBlock(
      `data: ${JSON.stringify({ choices: [{ delta: { content: '你好' } }] })}`,
    );
    expect(parsed).toEqual({ content: '你好', usage: undefined });
  });

  it('解析 DONE', () => {
    expect(parseOpenAiSseBlock('data: [DONE]')).toBe('done');
  });

  it('没有空行的收尾 data 仍能解析', () => {
    const parsed = parseOpenAiSseBlock(
      `data: ${JSON.stringify({ choices: [{ delta: { content: '尾' } }] })}`,
    );
    expect(parsed).toEqual({ content: '尾', usage: undefined });
  });

  it('解析 usage 且无文本', () => {
    const parsed = parseOpenAiSseBlock(
      `data: ${JSON.stringify({
        choices: [{ delta: {}, finish_reason: 'stop' }],
        usage: { prompt_tokens: 3, completion_tokens: 5 },
      })}`,
    );
    expect(parsed).toEqual({
      content: '',
      usage: { inputTokens: 3, outputTokens: 5 },
    });
  });

  it('兼容 CRLF 和多行 data', () => {
    const parsed = parseOpenAiSseBlock(
      'event: message\r\ndata: {"choices":[{"delta":{"content":"你好"}}]}\r\n',
    );
    expect(parsed).toEqual({ content: '你好', usage: undefined });
  });

  it('上游返回损坏 JSON 时显式失败，不静默丢帧', () => {
    expect(() => parseOpenAiSseBlock('data: {broken')).toThrow('AI_UPSTREAM_INVALID_SSE');
  });

  it('上游错误帧映射为稳定错误', () => {
    expect(() => parseOpenAiSseBlock('data: {"error":{"message":"rate limited"}}')).toThrow(
      'AI_UPSTREAM_ERROR',
    );
  });
});

describe('OpenAI 兼容流终态', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('上游 EOF 缺少 DONE 时不会把半条回复当成功', async () => {
    const encoder = new TextEncoder();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          new ReadableStream({
            start(controller) {
              controller.enqueue(
                encoder.encode('data: {"choices":[{"delta":{"content":"半条回复"}}]}\n\n'),
              );
              controller.close();
            },
          }),
        ),
      ),
    );
    const config = {
      get: (key: string) =>
        key === 'AI_OPENAI_TIMEOUT_MS'
          ? 1000
          : key === 'AI_OPENAI_API_KEY'
            ? 'test-key'
            : undefined,
    };
    const credentials = {
      resolveSystemSecret: vi.fn().mockResolvedValue({
        apiKey: 'test-key',
        baseUrl: 'https://example.com/v1',
        timeoutMs: 1000,
      }),
    };
    const provider = new OpenAiCompatibleTextProvider(
      config as never,
      credentials as never,
      {} as never,
    );
    const received: string[] = [];
    const consume = async () => {
      for await (const chunk of provider.stream({
        providerId: 'provider',
        providerCode: 'openai-compatible',
        modelKey: 'test',
        messages: [{ role: 'user', content: 'test' }],
        signal: new AbortController().signal,
      }))
        received.push(chunk.content);
    };
    await expect(consume()).rejects.toThrow('AI_UPSTREAM_STREAM_INTERRUPTED');
    expect(received).toEqual(['半条回复']);
  });
});
