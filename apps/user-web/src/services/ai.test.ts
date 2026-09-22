import { describe, expect, it } from 'vitest';
import { parseAiSseBlock } from './aiSse';

describe('AI SSE 事件解析', () => {
  it('兼容 CRLF 和多行 data', () => {
    const payload = parseAiSseBlock(
      `event: message\r\ndata: {"type":"DELTA",\r\ndata: "content":"content"}\r\n`,
    );
    expect(payload).toEqual({ type: 'DELTA', content: 'content' });
  });

  it('忽略注释和没有 data 的事件', () => {
    expect(parseAiSseBlock(': keep-alive\r\n')).toBeNull();
  });

  it('对损坏 JSON 抛出协议错误', () => {
    expect(() => parseAiSseBlock('data: {broken')).toThrow('AI_SSE_INVALID_EVENT');
  });
});
