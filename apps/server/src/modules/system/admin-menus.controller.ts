import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { CurrentAuth } from '../../common/decorators/current-auth.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { RequireIdempotency } from '../../common/idempotency/require-idempotency.decorator';
import type { RequestAuthContext } from '../../common/types/request-id';
import { CreateMenuDto, SortMenusDto, UpdateMenuDto } from './dto/menu.dto';
import { SystemService } from './system.service';

@ApiTags('Admin Menus')
@ApiBearerAuth()
@Controller('admin/menus')
export class AdminMenusController {
  constructor(private readonly systemService: SystemService) {}

  @Get()
  @RequirePermission('menu:manage')
  @ApiOperation({ summary: '完整菜单树（含管理字段）' })
  list() {
    return this.systemService.listAdminMenus();
  }

  @Post()
  @RequirePermission('menu:manage')
  @RequireIdempotency()
  @ApiOperation({ summary: '新增目录、内部菜单或外链' })
  create(
    @Body() body: CreateMenuDto,
    @CurrentAuth() auth: RequestAuthContext,
    @Req() request: Request,
  ) {
    return this.systemService.createMenu({
      ...body,
      actorId: auth.userId,
      requestId: request.requestId,
    });
  }

  @Patch('sort')
  @RequirePermission('menu:manage')
  @RequireIdempotency()
  @ApiOperation({ summary: '同父节点批量排序' })
  sort(
    @Body() body: SortMenusDto,
    @CurrentAuth() auth: RequestAuthContext,
    @Req() request: Request,
  ) {
    return this.systemService.sortMenus(body.items, auth.userId, request.requestId);
  }

  @Patch(':menuId')
  @RequirePermission('menu:manage')
  @RequireIdempotency()
  @ApiOperation({ summary: '更新菜单项' })
  update(
    @Param('menuId', new ParseUUIDPipe()) menuId: string,
    @Body() body: UpdateMenuDto,
    @CurrentAuth() auth: RequestAuthContext,
    @Req() request: Request,
  ) {
    return this.systemService.updateMenu(menuId, {
      ...body,
      actorId: auth.userId,
      requestId: request.requestId,
    });
  }

  @Delete(':menuId')
  @RequirePermission('menu:manage')
  @RequireIdempotency()
  @ApiOperation({ summary: '删除无子项且非核心菜单' })
  remove(
    @Param('menuId', new ParseUUIDPipe()) menuId: string,
    @CurrentAuth() auth: RequestAuthContext,
    @Req() request: Request,
  ) {
    return this.systemService.deleteMenu(menuId, auth.userId, request.requestId);
  }
}
