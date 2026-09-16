import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export enum PublicContentSort {
  LATEST = 'LATEST',
  POPULAR = 'POPULAR',
}

export class ListPublicContentQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  categorySlug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(400)
  tagSlugs?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  types?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  keyword?: string;

  @IsOptional()
  @IsEnum(PublicContentSort)
  sort?: PublicContentSort;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;
}
