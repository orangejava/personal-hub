import { Module } from '@nestjs/common';
import { OutboxService } from '../../infrastructure/queue/outbox.service';
import { AuthModule } from '../auth/auth.module';
import { SystemModule } from '../system/system.module';
import { AdminAiController } from './admin-ai.controller';
import { AppAiController, AppUsageController } from './app-ai.controller';
import { AiAnonymousGuard } from './ai-anonymous.guard';
import { AiCredentialService } from './ai-credential.service';
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
} from './providers/ai-provider.types';

@Module({
  imports: [AuthModule, SystemModule],
  controllers: [AppAiController, AppUsageController, PublicAiController, AdminAiController],
  providers: [
    AiAnonymousGuard,
    AiService,
    AiCredentialService,
    AiQuotaService,
    AiRuntimeService,
    OutboxService,
    FakeChatProvider,
    FakeImageProvider,
    MockVideoProvider,
    OpenAiCompatibleTextProvider,
    // 按每次请求的厂商分流，避免全局演示开关把已配置的真实模型替换成 Fake。
    { provide: AI_CHAT_PROVIDER, useExisting: OpenAiCompatibleTextProvider },
    { provide: AI_IMAGE_PROVIDER, useExisting: FakeImageProvider },
    { provide: AI_VIDEO_PROVIDER, useExisting: MockVideoProvider },
  ],
  exports: [AiService, AiQuotaService],
})
export class AiModule {}
