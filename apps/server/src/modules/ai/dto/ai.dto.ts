import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { AiFeedback, AiToolCode } from '@prisma/client';

export class PageQueryDto {
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

export class CreateSessionDto {
  @IsOptional()
  @IsString()
  @MaxLength(160)
  title?: string;

  @IsOptional()
  @IsUUID()
  modelId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  systemPrompt?: string;
}

export class PatchSessionDto {
  @IsOptional()
  @IsString()
  @MaxLength(160)
  title?: string;

  @IsOptional()
  @IsUUID()
  modelId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  systemPrompt?: string;
}

export class SendMessageDto {
  @IsString()
  @MaxLength(8000)
  content!: string;

  @IsOptional()
  @IsUUID()
  modelId?: string;

  @IsOptional()
  @IsUUID()
  contentId?: string;
}

export class FeedbackDto {
  @IsOptional()
  @IsEnum(AiFeedback)
  feedback?: AiFeedback | null;
}

export class TextGenerateDto {
  @IsString()
  @MaxLength(40)
  scenario!: string;

  @IsString()
  @MaxLength(8000)
  input!: string;

  @IsOptional()
  @IsUUID()
  modelId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  tone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  length?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  targetLanguage?: string;
}

export class ImageGenerateDto {
  @IsString()
  @MaxLength(1000)
  prompt!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  negativePrompt?: string;

  @IsOptional()
  @IsUUID()
  modelId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(4)
  count?: number;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  size?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  style?: string;
}

export class CreateTemplateDto {
  @IsEnum(AiToolCode)
  toolType!: AiToolCode;

  @IsString()
  @MaxLength(120)
  title!: string;

  @IsString()
  prompt!: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  description?: string;
}

export class PatchTemplateDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  title?: string;

  @IsOptional()
  @IsString()
  prompt?: string;
}

export class CreateAssetDto {
  @IsString()
  @MaxLength(160)
  title!: string;

  @IsOptional()
  @IsString()
  type?: 'TEXT' | 'IMAGE' | 'VIDEO';

  @IsOptional()
  @IsString()
  prompt?: string;

  @IsOptional()
  @IsUUID()
  folderId?: string;
}

export class PatchAssetDto {
  @IsOptional()
  @IsUUID()
  folderId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  status?: 'SAVED' | 'TRASHED';

  @IsOptional()
  @IsBoolean()
  favorite?: boolean;
}

export class CreateFolderDto {
  @IsString()
  @MaxLength(80)
  name!: string;
}

export class PublicChatDto {
  @IsString()
  @MaxLength(2000)
  content!: string;

  @IsOptional()
  @IsUUID()
  sessionId?: string;
}

export class PatchProviderDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  label?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  baseUrl?: string;
}

export class PatchModelDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  displayName?: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsBoolean()
  userVisible?: boolean;

  @IsOptional()
  @IsBoolean()
  visibleToUser?: boolean;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class PatchToolDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @IsString()
  status?: 'ENABLED' | 'DISABLED' | 'COMING_SOON';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sortOrder?: number;
}

export class PutEntitlementDto {
  @IsUUID()
  roleId!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  maxConcurrent?: number;

  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  allowedModelIds?: string[];
}
