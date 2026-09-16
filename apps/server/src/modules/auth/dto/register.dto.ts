import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { PASSWORD_POLICY } from '../password';

export class RegisterDto {
  @ApiProperty({ example: 'user@example.com' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @MaxLength(320)
  email!: string;

  @ApiProperty({ example: 'HubDev!234' })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  @Matches(PASSWORD_POLICY, {
    message: '密码至少 8 位，且必须包含大写、小写、数字和特殊字符',
  })
  password!: string;

  @ApiPropertyOptional({ example: '昵称' })
  @Transform(({ value }: { value: unknown }) => {
    if (typeof value !== 'string') {
      return undefined;
    }
    const nickname = value.trim();
    return nickname.length === 0 ? undefined : nickname;
  })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  nickname?: string;
}
