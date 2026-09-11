import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { DataScope } from '@prisma/client';
import { RequireIdempotency } from '../../common/idempotency/require-idempotency.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { AiService } from './ai.service';
import { PatchModelDto, PatchProviderDto, PatchToolDto, PutEntitlementDto } from './dto/ai.dto';
import { AiToolStatus } from '@prisma/client';

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
    });
  }

  @Put('entitlements')
  @RequirePermission('ai:entitlement:manage', DataScope.ALL)
  @RequireIdempotency()
  putEntitlement(@Body() body: PutEntitlementDto) {
    return this.ai.putEntitlement(body.roleId, body);
  }
}
