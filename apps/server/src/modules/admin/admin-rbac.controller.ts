import { Body, Controller, Get, Param, ParseEnumPipe, Put, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RoleCode } from '@prisma/client';
import type { Request } from 'express';
import { CurrentAuth } from '../../common/decorators/current-auth.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { RequireIdempotency } from '../../common/idempotency/require-idempotency.decorator';
import type { RequestAuthContext } from '../../common/types/request-id';
import { AuthService } from '../auth/auth.service';
import { UpdateRolePermissionsDto } from './dto/update-role-permissions.dto';

/** 角色与权限目录。创建自定义角色、按权限配 OWN/ALL 仍后置。 */
@ApiTags('Admin RBAC')
@ApiBearerAuth()
@Controller('admin')
export class AdminRbacController {
  constructor(private readonly authService: AuthService) {}

  @Get('roles')
  @RequirePermission('role:read')
  @ApiOperation({ summary: '后台角色列表' })
  async listRoles() {
    return this.authService.listAdminRoles();
  }

  @Get('permissions')
  @RequirePermission('role:read')
  @ApiOperation({ summary: '受控权限目录' })
  listPermissions() {
    return this.authService.listAdminPermissions();
  }

  @Put('roles/:roleCode/permissions')
  @RequirePermission('role:permission:manage')
  @RequireIdempotency({ highRisk: true })
  @ApiOperation({ summary: '替换非受保护角色的权限' })
  async replacePermissions(
    @Param('roleCode', new ParseEnumPipe(RoleCode)) roleCode: RoleCode,
    @Body() dto: UpdateRolePermissionsDto,
    @CurrentAuth() auth: RequestAuthContext,
    @Req() request: Request,
  ) {
    return this.authService.replaceRolePermissions({
      actorId: auth.userId,
      roleCode,
      permissions: dto.permissions,
      version: dto.version,
      requestId: request.requestId,
      ip: request.ip ?? request.socket.remoteAddress ?? '0.0.0.0',
    });
  }
}
