import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { CurrentAuth } from '../../common/decorators/current-auth.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import type { RequestAuthContext } from '../../common/types/request-id';
import { AuthService } from '../auth/auth.service';
import { AdminUserQueryDto } from './dto/admin-user-query.dto';

/** 约束刀：只读用户与踢会话。禁用/改角色仍走 mock，避免 Nest UUID 打到旧接口。 */
@ApiTags('Admin Users')
@ApiBearerAuth()
@Controller('admin/users')
export class AdminUsersController {
  constructor(private readonly authService: AuthService) {}

  @Get()
  @RequirePermission('user:read')
  @ApiOperation({ summary: '后台用户列表（只读）' })
  async list(@Query() query: AdminUserQueryDto) {
    return this.authService.listAdminUsers({
      page: query.page,
      pageSize: query.pageSize,
      email: query.email,
    });
  }

  @Get(':userId/sessions')
  @RequirePermission('user:session:read')
  @ApiOperation({ summary: '查看指定用户活跃会话' })
  async listSessions(
    @Param('userId', new ParseUUIDPipe()) userId: string,
    @CurrentAuth() auth: RequestAuthContext,
  ) {
    const target = await this.authService.getAdminUserOrThrow(userId);
    return this.authService.listSessions(target.id, auth.sessionId);
  }

  @Post(':userId/sessions/revoke-all')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('user:session:revoke')
  @ApiOperation({ summary: '踢指定用户全部设备' })
  async revokeAll(
    @Param('userId', new ParseUUIDPipe()) userId: string,
    @CurrentAuth() auth: RequestAuthContext,
    @Req() request: Request,
  ) {
    return this.authService.revokeAllSessionsAsAdmin({
      actorId: auth.userId,
      targetUserId: userId,
      ip: request.ip ?? request.socket.remoteAddress ?? '0.0.0.0',
      requestId: request.requestId,
    });
  }
}
