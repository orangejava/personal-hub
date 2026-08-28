import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class VerifyEmailDto {
  @ApiProperty({ description: '邮件链接中的一次性验证 Token' })
  @IsString()
  @MinLength(16)
  @MaxLength(128)
  token!: string;
}
