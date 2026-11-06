import { Module } from '@nestjs/common';
import { AiRewardService } from './ai-reward.service';
import { AdminAiRewardController, AppAiRewardController } from './ai-reward.controller';

@Module({ controllers: [AppAiRewardController, AdminAiRewardController], providers: [AiRewardService], exports: [AiRewardService] })
export class AiRewardModule {}
