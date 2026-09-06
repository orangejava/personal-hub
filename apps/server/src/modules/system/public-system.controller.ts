import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { SystemService } from './system.service';

/** 匿名可读；组装结果已去掉密钥类字段，见 assemblePublicSiteConfig。 */
@ApiTags('Public System')
@Controller('public')
export class PublicSystemController {
  constructor(private readonly systemService: SystemService) {}

  @Public()
  @Get('site-config')
  @ApiOperation({ summary: '公开站点配置（白名单组装）' })
  @ApiOkResponse({ description: '站点、主题、首页、About 占位与 AI 开关' })
  getSiteConfig() {
    return this.systemService.getPublicSiteConfig();
  }

  @Public()
  @Get('navigation')
  @ApiOperation({ summary: '匿名可见的公开/AI 导航' })
  getNavigation() {
    return this.systemService.getPublicNavigation();
  }
}
