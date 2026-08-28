import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'owner@example.com' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @MaxLength(320)
  email!: string;

  @ApiProperty({ example: 'OneTimePassword!1' })
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  password!: string;

  @ApiPropertyOptional({ description: '连续失败后必填的验证码挑战 ID' })
  @IsOptional()
  @IsUUID()
  challengeId?: string;

  @ApiPropertyOptional({ description: '验证码答案' })
  @IsOptional()
  @IsString()
  @MaxLength(16)
  captchaAnswer?: string;
}
