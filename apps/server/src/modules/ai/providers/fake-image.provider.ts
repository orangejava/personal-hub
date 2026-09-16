import { Injectable } from '@nestjs/common';
import type { AiImageProvider, AiVideoProvider, ImageProviderInput } from './ai-provider.types';

/** 1x1 PNG，避免测试依赖真实绘图模型。 */
const PIXEL = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

@Injectable()
export class FakeImageProvider implements AiImageProvider {
  async generate(input: ImageProviderInput): Promise<Buffer[]> {
    if (input.signal.aborted) {
      return [];
    }
    const count = Math.min(Math.max(input.count, 1), 4);
    return Array.from({ length: count }, () => PIXEL);
  }
}

@Injectable()
export class MockVideoProvider implements AiVideoProvider {
  async generate(input: ImageProviderInput): Promise<Buffer[]> {
    if (input.signal.aborted) {
      return [];
    }
    return [PIXEL];
  }
}
