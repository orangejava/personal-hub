import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { PASSWORD_POLICY } from '../password';

export class ChangePasswordDto {
  @ApiProperty({ example: 'OneTimePassword!1' })
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  currentPassword!: string;

  @ApiProperty({ example: 'HubDev!234' })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  @Matches(PASSWORD_POLICY, {
    message: '密码至少 8 位，且必须包含大写、小写、数字和特殊字符',
  })
  newPassword!: string;
}
