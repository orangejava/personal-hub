import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Put, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AiToolStatus, DataScope } from '@prisma/client';
import type { Request } from 'express';
import { CurrentAuth } from '../../common/decorators/current-auth.decorator';
import { RequireIdempotency } from '../../common/idempotency/require-idempotency.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import type { RequestAuthContext } from '../../common/types/request-id';
import { AiService } from './ai.service';
import {
  PatchBrandingDto,
  PatchModelDto,
  PatchNavigationDto,
  PatchProviderDto,
  PatchToolDto,
  PutEntitlementDto,
  SortNavigationDto,
} from './dto/ai.dto';

@ApiTags('Admin AI')
@ApiBearerAuth()
@Controller('admin/ai')
export class AdminAiController {
  constructor(private readonly ai: AiService) {}

  @Get('config')
  @RequirePermission('ai:provider:manage', DataScope.ALL)
  config() {
    return this.ai.adminConfig();
  }

  @Get('stats')
  @RequirePermission('dashboard:read', DataScope.ALL)
  stats() {
    return this.ai.adminStats();
  }

  @Get('navigation')
  @RequirePermission('ai:tool:manage', DataScope.ALL)
  navigation() {
    return this.ai.listNavigation({ includeHidden: true, remapByTool: false });
  }

  @Patch('branding')
  @RequirePermission('ai:provider:manage', DataScope.ALL)
  @RequireIdempotency()
  patchBranding(
    @Body() body: PatchBrandingDto,
    @CurrentAuth() auth: RequestAuthContext,
    @Req() request: Request,
  ) {
    return this.ai.patchBranding(body, auth.userId, request.requestId);
  }

  @Patch('navigation/sort')
  @RequirePermission('ai:tool:manage', DataScope.ALL)
  @RequireIdempotency()
  sortNavigation(@Body() body: SortNavigationDto) {
    return this.ai.sortNavigation(body.items);
  }

  @Patch('navigation/:id')
  @RequirePermission('ai:tool:manage', DataScope.ALL)
  @RequireIdempotency()
  patchNavigation(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: PatchNavigationDto,
  ) {
    return this.ai.patchNavigation(id, body);
  }

  @Patch('providers/:providerId')
  @RequirePermission('ai:provider:manage', DataScope.ALL)
  @RequireIdempotency()
  patchProvider(
    @Param('providerId', new ParseUUIDPipe()) providerId: string,
    @Body() body: PatchProviderDto,
  ) {
    return this.ai.patchProvider(providerId, body);
  }

  @Patch('models/:modelId')
  @RequirePermission('ai:model:manage', DataScope.ALL)
  @RequireIdempotency()
  patchModel(@Param('modelId', new ParseUUIDPipe()) modelId: string, @Body() body: PatchModelDto) {
    return this.ai.patchModel(modelId, body);
  }

  @Patch('tools/:toolId')
  @RequirePermission('ai:tool:manage', DataScope.ALL)
  @RequireIdempotency()
  patchTool(@Param('toolId', new ParseUUIDPipe()) toolId: string, @Body() body: PatchToolDto) {
    return this.ai.patchTool(toolId, {
      name: body.name,
      status: body.status as AiToolStatus | undefined,
      sortOrder: body.sortOrder,
      defaultModelId: body.defaultModelId,
      tokenCostLabel: body.tokenCostLabel,
      guestTrialEnabled: body.guestTrialEnabled,
    });
  }

  @Put('entitlements')
  @RequirePermission('ai:entitlement:manage', DataScope.ALL)
  @RequireIdempotency()
  putEntitlement(@Body() body: PutEntitlementDto) {
    return this.ai.putEntitlement(body.roleId, body);
  }
}
