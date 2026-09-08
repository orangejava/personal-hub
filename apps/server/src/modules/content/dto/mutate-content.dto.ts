import { ContentReviewStatus, ContentType, ContentVisibility } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

/** 富文本首版只接收编辑器序列化出的 HTML，服务端负责净化和派生展示数据。 */
export class RichTextDocumentDto {
  @IsString()
  @MaxLength(1_000_000)
  html!: string;
}

export class CreateContentDto {
  @IsEnum(ContentType)
  type!: ContentType;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  summary?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  categorySlug?: string;

  @IsOptional()
  @IsEnum(ContentVisibility)
  visibility?: ContentVisibility;

  @IsOptional()
  @IsString()
  markdownSource?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => RichTextDocumentDto)
  editorDocument?: RichTextDocumentDto;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  externalUrl?: string;

  @IsOptional()
  @IsObject()
  extra?: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tagNames?: string[];

  @IsOptional()
  @IsUUID()
  coverFileId?: string;

  @IsOptional()
  @IsUUID()
  primaryFileId?: string;
}

export class PatchContentDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  summary?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  categorySlug?: string | null;

  @IsOptional()
  @IsEnum(ContentVisibility)
  visibility?: ContentVisibility;

  @IsOptional()
  @IsString()
  markdownSource?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @ValidateNested()
  @Type(() => RichTextDocumentDto)
  editorDocument?: RichTextDocumentDto | null;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  externalUrl?: string | null;

  @IsOptional()
  @IsObject()
  extra?: Record<string, unknown> | null;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tagNames?: string[];

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  coverFileId?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  primaryFileId?: string | null;
}

export class ImportLicenseDto {
  /** 先去掉首尾空白，再交给服务层用业务错误码拒绝空说明。 */
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(500)
  note!: string;
}

/** 发布可选体：OWN 用 requestedVisibility 写入审核；ALL 公开导入内容时带 copyrightNote。 */
export class PublishContentDto {
  @IsOptional()
  @IsEnum(ContentVisibility)
  requestedVisibility?: ContentVisibility;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  copyrightNote?: string;
}

export class ListContentReviewsQueryDto {
  @IsOptional()
  @IsEnum(ContentReviewStatus)
  status?: ContentReviewStatus;

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

export class ApproveContentReviewDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  copyrightNote?: string;
}

export class RejectContentReviewDto {
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  reason!: string;
}

export class UpsertReadingDto {
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  contentProgressPercent!: number;

  @IsOptional()
  @IsUUID()
  chapterId?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  chapterProgressPercent?: number | null;
}

export class CreateCategoryDto {
  @IsString()
  @MaxLength(80)
  name!: string;

  @IsString()
  @MaxLength(80)
  slug!: string;

  @IsOptional()
  @IsUUID()
  parentId?: string;

  @IsOptional()
  @Type(() => Number)
  sortOrder?: number;
}

export class PatchCategoryDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  slug?: string;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  parentId?: string | null;

  @IsOptional()
  @Type(() => Number)
  sortOrder?: number;

  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  enabled?: boolean;
}

export class CreateTagDto {
  @IsString()
  @MaxLength(80)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  slug?: string;
}

export class FeaturedDto {
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  featured!: boolean;
}

export class PurgeContentDto {
  @IsString()
  @MaxLength(500)
  reason!: string;
}

export class SortCategoriesDto {
  @IsArray()
  @IsUUID(undefined, { each: true })
  ids!: string[];
}
