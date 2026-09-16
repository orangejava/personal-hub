import { Injectable } from '@nestjs/common';
import type { AiChatProvider, ChatDelta, ChatProviderInput } from './ai-provider.types';

/**
 * 本地与测试用流式 Provider。不访问外网，可被 AbortSignal 打断。
 */
@Injectable()
export class FakeChatProvider implements AiChatProvider {
  async *stream(input: ChatProviderInput): AsyncIterable<ChatDelta> {
    const lastUser = [...input.messages].reverse().find((item) => item.role === 'user');
    const topic = lastUser?.content.trim().slice(0, 80) || '你的问题';
    const chunks = [
      `我收到了：${topic}。`,
      '下面按目标、约束和可执行步骤给出回答。',
      '\n\n1. 先确认你真正要解决的问题。',
      '\n2. 保留现有链路，不要绕过服务端额度与幂等。',
      '\n3. 用 Fake Provider 验证 SSE、停止和结算后再接真实厂商。',
    ];
    for (const content of chunks) {
      if (input.signal.aborted) {
        return;
      }
      await delay(40);
      if (input.signal.aborted) {
        return;
      }
      yield { content };
    }
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
