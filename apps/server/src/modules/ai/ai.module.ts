import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OutboxService } from '../../infrastructure/queue/outbox.service';
import type { Env } from '../../config/env.schema';
import { AuthModule } from '../auth/auth.module';
import { SystemModule } from '../system/system.module';
import { AdminAiController } from './admin-ai.controller';
import { AppAiController, AppUsageController } from './app-ai.controller';
import { AiAnonymousGuard } from './ai-anonymous.guard';
import { AiQuotaService } from './ai-quota.service';
import { AiRuntimeService } from './ai-runtime.service';
import { AiService } from './ai.service';
import { PublicAiController } from './public-ai.controller';
import { FakeChatProvider } from './providers/fake-chat.provider';
import { FakeImageProvider, MockVideoProvider } from './providers/fake-image.provider';
import { OpenAiCompatibleTextProvider } from './providers/openai-compatible-text.provider';
import {
  AI_CHAT_PROVIDER,
  AI_IMAGE_PROVIDER,
  AI_VIDEO_PROVIDER,
  type AiChatProvider,
} from './providers/ai-provider.types';

@Module({
  imports: [AuthModule, SystemModule],
  controllers: [AppAiController, AppUsageController, PublicAiController, AdminAiController],
  providers: [
    AiAnonymousGuard,
    AiService,
    AiQuotaService,
    AiRuntimeService,
    OutboxService,
    FakeChatProvider,
    FakeImageProvider,
    MockVideoProvider,
    OpenAiCompatibleTextProvider,
    {
      provide: AI_CHAT_PROVIDER,
      inject: [ConfigService, FakeChatProvider, OpenAiCompatibleTextProvider],
      useFactory: (
        config: ConfigService<Env, true>,
        fake: FakeChatProvider,
        openai: OpenAiCompatibleTextProvider,
      ): AiChatProvider => {
        const mode = config.get('AI_TEXT_PROVIDER', { infer: true });
        const key = config.get('AI_OPENAI_API_KEY', { infer: true });
        // 没有 Key 时保持 Fake，避免本地开发被真实协议卡住。
        if (mode === 'openai_compatible' && key) {
          return openai;
        }
        return fake;
      },
    },
    { provide: AI_IMAGE_PROVIDER, useExisting: FakeImageProvider },
    { provide: AI_VIDEO_PROVIDER, useExisting: MockVideoProvider },
  ],
  exports: [AiService, AiQuotaService],
})
export class AiModule {}
