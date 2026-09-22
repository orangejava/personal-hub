import { describe, expect, it } from 'vitest';
import { parseOpenAiSseBlock } from '../src/modules/ai/providers/openai-compatible-text.provider';

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
