import { describe, expect, it, vi } from 'vitest';
import { createAiStreamRenderScheduler } from './aiStreamScheduler';

describe('AI 流式渲染调度器', () => {
  it('把大段文本分帧提交，并在文本排空后结束', () => {
    vi.useFakeTimers();
    const rendered: string[] = [];
    const finished: string[] = [];
    const scheduler = createAiStreamRenderScheduler(
      (content) => rendered.push(content),
      (result: string) => finished.push(result),
      { charsPerFrame: 2, backlogCharsPerFrame: 2 },
    );

    scheduler.enqueue('abcdef');
    scheduler.finish('done');

    expect(rendered).toEqual([]);
    expect(finished).toEqual([]);
    vi.runAllTimers();
    expect(rendered.join('')).toBe('abcdef');
    expect(rendered.every((chunk) => chunk.length <= 2)).toBe(true);
    expect(finished).toEqual(['done']);
    vi.useRealTimers();
  });

  it('flush 会保留已经收到的文本，cancel 会停止后续绘制', () => {
    vi.useFakeTimers();
    const rendered: string[] = [];
    const scheduler = createAiStreamRenderScheduler(
      (content) => rendered.push(content),
      () => undefined,
      { charsPerFrame: 1 },
    );

    scheduler.enqueue('你好世界');
    scheduler.flush();
    scheduler.cancel();
    vi.runAllTimers();

    expect(rendered.join('')).toBe('你好世界');
    vi.useRealTimers();
  });
});
