import { Module } from '@nestjs/common';
import { OutboxService } from '../../infrastructure/queue/outbox.service';
import { AuthModule } from '../auth/auth.module';
import { AdminAiController } from './admin-ai.controller';
import { AppAiController, AppUsageController } from './app-ai.controller';
import { AiAnonymousGuard } from './ai-anonymous.guard';
import { AiQuotaService } from './ai-quota.service';
import { AiRuntimeService } from './ai-runtime.service';
import { AiService } from './ai.service';
import { PublicAiController } from './public-ai.controller';
import { FakeChatProvider } from './providers/fake-chat.provider';
import { FakeImageProvider, MockVideoProvider } from './providers/fake-image.provider';
import { AI_CHAT_PROVIDER, AI_IMAGE_PROVIDER, AI_VIDEO_PROVIDER } from './providers/ai-provider.types';

@Module({
  imports: [AuthModule],
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
    { provide: AI_CHAT_PROVIDER, useExisting: FakeChatProvider },
    { provide: AI_IMAGE_PROVIDER, useExisting: FakeImageProvider },
    { provide: AI_VIDEO_PROVIDER, useExisting: MockVideoProvider },
  ],
  exports: [AiService, AiQuotaService],
})
export class AiModule {}
