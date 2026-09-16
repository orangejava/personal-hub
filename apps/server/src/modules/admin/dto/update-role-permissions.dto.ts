import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsInt, IsString, MaxLength, Min } from 'class-validator';

export class UpdateRolePermissionsDto {
  @IsArray()
  @ArrayMaxSize(80)
  @IsString({ each: true })
  @MaxLength(80, { each: true })
  permissions!: string[];

  /** 读取角色时返回的版本号；用于拒绝覆盖他人刚保存的权限配置。 */
  @Type(() => Number)
  @IsInt()
  @Min(1)
  version!: number;
}
