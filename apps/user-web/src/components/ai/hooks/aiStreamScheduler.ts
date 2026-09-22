export interface AiStreamRenderScheduler<T> {
  enqueue(content: string): void;
  finish(result: T): void;
  /** 立即提交已经收到但尚未绘制的文本，停止生成时使用。 */
  flush(): void;
  /** 取消后续绘制，避免旧会话的流回写当前页面。 */
  cancel(): void;
}

interface AiStreamRenderSchedulerOptions {
  charsPerFrame?: number;
  backlogCharsPerFrame?: number;
}

const DEFAULT_CHARS_PER_FRAME = 48;
const DEFAULT_BACKLOG_CHARS_PER_FRAME = 144;

function takeCodePoints(segment: string, offset: number, limit: number) {
  let end = offset;
  let count = 0;
  while (end < segment.length && count < limit) {
    const codePoint = segment.codePointAt(end);
    end += codePoint !== undefined && codePoint > 0xffff ? 2 : 1;
    count += 1;
  }
  return { text: segment.slice(offset, end), nextOffset: end };
}

/**
 * 将网络层收到的增量转换为 UI 帧。网络 chunk 可以很大，但每次 React 状态更新只
 * 提交有限字符；终态事件排队到文本耗尽后再执行，避免出现“DONE 先到、文字还没画完”。
 */
export function createAiStreamRenderScheduler<T>(
  onText: (content: string) => void,
  onFinish: (result: T) => void,
  options: AiStreamRenderSchedulerOptions = {},
): AiStreamRenderScheduler<T> {
  const charsPerFrame = options.charsPerFrame ?? DEFAULT_CHARS_PER_FRAME;
  const backlogCharsPerFrame = options.backlogCharsPerFrame ?? DEFAULT_BACKLOG_CHARS_PER_FRAME;
  const segments: Array<{ value: string; offset: number }> = [];
  let pendingChars = 0;
  let terminal: T | undefined;
  let hasTerminal = false;
  let timer: number | ReturnType<typeof setTimeout> | undefined;
  let cancelled = false;

  const schedule = () => {
    if (cancelled || timer !== undefined) return;
    const callback = () => {
      timer = undefined;
      drawFrame();
    };
    if (typeof requestAnimationFrame === 'function') {
      timer = requestAnimationFrame(callback);
    } else {
      timer = globalThis.setTimeout(callback, 16);
    }
  };

  const clearScheduledFrame = () => {
    if (timer === undefined) return;
    if (typeof timer === 'number' && typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(timer);
    }
    globalThis.clearTimeout(timer);
    timer = undefined;
  };

  const consume = (limit: number) => {
    let remaining = limit;
    let output = '';
    while (remaining > 0 && segments.length > 0) {
      const head = segments[0];
      const chunk = takeCodePoints(head.value, head.offset, remaining);
      output += chunk.text;
      const consumed = Array.from(chunk.text).length;
      remaining -= consumed;
      pendingChars -= consumed;
      head.offset = chunk.nextOffset;
      if (head.offset >= head.value.length) {
        segments.shift();
      }
    }
    return output;
  };

  const finishIfReady = () => {
    if (!hasTerminal || pendingChars > 0 || cancelled) return;
    const result = terminal as T;
    terminal = undefined;
    hasTerminal = false;
    onFinish(result);
  };

  function drawFrame() {
    if (cancelled) return;
    const limit = pendingChars > backlogCharsPerFrame ? backlogCharsPerFrame : charsPerFrame;
    const content = consume(limit);
    if (content) {
      onText(content);
    }
    if (pendingChars > 0) {
      schedule();
      return;
    }
    finishIfReady();
  }

  return {
    enqueue(content) {
      if (cancelled || !content) return;
      segments.push({ value: content, offset: 0 });
      pendingChars += Array.from(content).length;
      schedule();
    },
    finish(result) {
      if (cancelled || hasTerminal) return;
      terminal = result;
      hasTerminal = true;
      if (pendingChars > 0) {
        schedule();
      } else {
        finishIfReady();
      }
    },
    flush() {
      if (cancelled) return;
      clearScheduledFrame();
      const content = consume(Number.MAX_SAFE_INTEGER);
      if (content) {
        onText(content);
      }
      finishIfReady();
    },
    cancel() {
      cancelled = true;
      clearScheduledFrame();
      segments.length = 0;
      pendingChars = 0;
      terminal = undefined;
      hasTerminal = false;
    },
  };
}
