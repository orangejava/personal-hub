import { MenuScope, MenuType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class CreateMenuDto {
  @IsEnum(MenuScope)
  scope!: MenuScope;

  @IsEnum(MenuType)
  type!: MenuType;

  @IsString()
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  localeKey?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  icon?: string;

  @IsOptional()
  @IsUUID()
  parentId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  routeKey?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  externalUrl?: string;

  @IsOptional()
  @IsBoolean()
  openInNewTab?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  visible?: boolean;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  remark?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  permissionCodes?: string[];
}

export class UpdateMenuDto {
  @IsOptional()
  @IsEnum(MenuScope)
  scope?: MenuScope;

  @IsOptional()
  @IsEnum(MenuType)
  type?: MenuType;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  localeKey?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  icon?: string | null;

  @IsOptional()
  @IsUUID()
  parentId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  routeKey?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  externalUrl?: string | null;

  @IsOptional()
  @IsBoolean()
  openInNewTab?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  visible?: boolean;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  remark?: string | null;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  permissionCodes?: string[];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  version?: number;
}

export class SortMenuItemDto {
  @IsUUID()
  id!: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder!: number;
}

export class SortMenusDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SortMenuItemDto)
  items!: SortMenuItemDto[];
}
