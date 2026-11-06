import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { DataScope } from '@prisma/client';
import { IsBoolean, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';
import { CurrentAuth } from '../../common/decorators/current-auth.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { RequireIdempotency } from '../../common/idempotency/require-idempotency.decorator';
import type { RequestAuthContext } from '../../common/types/request-id';
import { AiRewardService, shanghaiDate } from './ai-reward.service';

class MonthQuery {
  @IsOptional() @Matches(/^\d{4}-(0[1-9]|1[0-2])$/) month?: string;
}

class PatchRewardRuleDto {
  @IsOptional() @IsInt() @Min(0) @Max(1000000000) amount?: number;
  @IsOptional() @IsInt() @Min(0) @Max(365) bonusEvery?: number;
  @IsOptional() @IsInt() @Min(0) @Max(1000000000) bonusAmount?: number;
  @IsOptional() @IsString() @MaxLength(120) label?: string;
  @IsOptional() @IsBoolean() enabled?: boolean;
}

@ApiTags('App AI Rewards')
@ApiBearerAuth()
@Controller('app/ai')
export class AppAiRewardController {
  constructor(private readonly rewards: AiRewardService) {}

  @Get('checkin')
  @RequirePermission('ai:use')
  calendar(@CurrentAuth() auth: RequestAuthContext, @Query() query: MonthQuery) {
    return this.rewards.calendar(auth.userId, query.month ?? shanghaiDate().slice(0, 7));
  }

  @Post('checkin')
  @RequirePermission('ai:use')
  @RequireIdempotency()
  checkin(@CurrentAuth() auth: RequestAuthContext) {
    return this.rewards.checkin(auth.userId);
  }
}

@ApiTags('Admin AI Rewards')
@ApiBearerAuth()
@Controller('admin/ai/reward-rules')
export class AdminAiRewardController {
  constructor(private readonly rewards: AiRewardService) {}

  @Get()
  @RequirePermission('ai:provider:manage', DataScope.ALL)
  rules() { return this.rewards.rules(); }

  @Patch(':code')
  @RequirePermission('ai:provider:manage', DataScope.ALL)
  @RequireIdempotency()
  patch(@Param('code') code: string, @Body() body: PatchRewardRuleDto, @CurrentAuth() auth: RequestAuthContext) {
    return this.rewards.patchRule(code, body, auth.userId);
  }
}
