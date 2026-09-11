export interface ChatDelta {
  content: string;
}

export interface ChatProviderInput {
  modelKey: string;
  systemPrompt?: string | null;
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
  signal: AbortSignal;
}

export interface ImageProviderInput {
  modelKey: string;
  prompt: string;
  negativePrompt?: string | null;
  count: number;
  signal: AbortSignal;
}

export const AI_CHAT_PROVIDER = Symbol('AI_CHAT_PROVIDER');
export const AI_IMAGE_PROVIDER = Symbol('AI_IMAGE_PROVIDER');
export const AI_VIDEO_PROVIDER = Symbol('AI_VIDEO_PROVIDER');

export interface AiChatProvider {
  stream(input: ChatProviderInput): AsyncIterable<ChatDelta>;
}

export interface AiImageProvider {
  generate(input: ImageProviderInput): Promise<Buffer[]>;
}

export interface AiVideoProvider {
  generate(input: ImageProviderInput): Promise<Buffer[]>;
}
