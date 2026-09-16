import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';

export class RevokeAllSessionsDto {
  @ApiPropertyOptional({
    description: '为 true 时保留当前会话，只踢掉其它设备。默认 true。',
    default: true,
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    if (value === undefined || value === null || value === '') {
      return true;
    }
    return value === true || value === 'true';
  })
  @IsBoolean()
  keepCurrent?: boolean;
}
