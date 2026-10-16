import { Transform, Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
  ValidateIf,
} from 'class-validator';
import { AiFeedback, AiModality, AiNavStatus, AiToolCode } from '@prisma/client';

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
  @MaxLength(4000)
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

  @IsOptional()
  @IsString()
  @MaxLength(20)
  quality?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  resolution?: string;
}

export class VideoGenerateDto {
  @IsString()
  @MaxLength(4000)
  prompt!: string;

  @IsOptional()
  @IsUUID()
  modelId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  size?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  style?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(30)
  durationSeconds?: number;
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

  @IsOptional()
  @IsUUID()
  modelId?: string;
}

export class JobListQueryDto extends PageQueryDto {
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @IsEnum(AiToolCode)
  toolType?: AiToolCode;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  status?: string;
}

export class UsageQueryDto extends PageQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(40)
  from?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  to?: string;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @IsEnum(AiToolCode)
  toolType?: AiToolCode;
}

export class EncryptedCredentialDto {
  @IsString()
  @MaxLength(80)
  keyId!: string;

  @IsString()
  @MaxLength(120)
  ephemeralPublicKey!: string;

  @IsString()
  @MaxLength(64)
  salt!: string;

  @IsString()
  @MaxLength(24)
  iv!: string;

  @IsString()
  @MaxLength(4096)
  ciphertext!: string;
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

  /** 只写密文信封；不传表示不轮换。明文 apiKey 会被全局白名单校验拒绝。 */
  @IsOptional()
  @ValidateNested()
  @Type(() => EncryptedCredentialDto)
  encryptedApiKey?: EncryptedCredentialDto;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  remark?: string;

  @IsOptional()
  @IsBoolean()
  sourceFiled?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  filingNote?: string;
}

export class CreateProviderDto {
  @IsString()
  @Matches(/^[a-z][a-z0-9_-]{1,39}$/)
  code!: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/\S/)
  @MaxLength(80)
  label!: string;

  @IsString()
  @Matches(/^openai-compatible$/)
  providerType!: 'openai-compatible';

  @IsString()
  @IsNotEmpty()
  @IsUrl({ require_tld: false, require_protocol: true, protocols: ['http', 'https'] })
  @MaxLength(500)
  baseUrl!: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @ValidateNested()
  @Type(() => EncryptedCredentialDto)
  encryptedApiKey?: EncryptedCredentialDto;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  remark?: string;

  @IsOptional()
  @IsBoolean()
  sourceFiled?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  filingNote?: string;
}

/** 连接测试。modelId 是模型行 ID，不是厂商的 modelKey。 */
export class TestProviderDto {
  @IsOptional()
  @IsUUID()
  modelId?: string;
}

export class CreateModelDto {
  @IsOptional()
  @IsArray()
  @Transform(({ value }) =>
    Array.isArray(value)
      ? value.map((item) => (typeof item === 'string' ? item.toUpperCase() : item))
      : value,
  )
  @IsEnum(AiToolCode, { each: true })
  defaultToolTypes?: AiToolCode[];

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  modelId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  providerCode!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  displayName!: string;

  @IsArray()
  @ArrayMinSize(1)
  @Transform(({ value }) =>
    Array.isArray(value)
      ? value.map((item) => (typeof item === 'string' ? item.trim().toUpperCase() : item))
      : value,
  )
  @IsEnum(AiToolCode, { each: true })
  toolTypes!: AiToolCode[];

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @IsEnum(AiModality)
  modality?: AiModality;

  @IsBoolean()
  enabled!: boolean;

  @IsBoolean()
  visibleToUser!: boolean;

  @IsBoolean()
  isDefault!: boolean;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  contextTokens!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  maxOutputTokens?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  fixedPlatformCost?: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  inputPricePer1k!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  outputPricePer1k!: number;
}

export class PatchModelDto {
  @ValidateIf((_, value) => value !== undefined)
  @IsArray()
  @Transform(({ value }) =>
    Array.isArray(value)
      ? value.map((item) => (typeof item === 'string' ? item.toUpperCase() : item))
      : value,
  )
  @IsEnum(AiToolCode, { each: true })
  defaultToolTypes?: AiToolCode[];

  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @MaxLength(120)
  displayName?: string;

  @ValidateIf((_, value) => value !== undefined)
  @IsBoolean()
  enabled?: boolean;

  @ValidateIf((_, value) => value !== undefined)
  @IsBoolean()
  userVisible?: boolean;

  @ValidateIf((_, value) => value !== undefined)
  @IsBoolean()
  visibleToUser?: boolean;

  @ValidateIf((_, value) => value !== undefined)
  @IsBoolean()
  isDefault?: boolean;

  @ValidateIf((_, value) => value !== undefined)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  contextTokens?: number;

  @ValidateIf((_, value) => value !== undefined)
  @Type(() => Number)
  @IsInt()
  @Min(0)
  inputPricePer1k?: number;

  @ValidateIf((_, value) => value !== undefined)
  @Type(() => Number)
  @IsInt()
  @Min(0)
  outputPricePer1k?: number;

  /** 厂商侧模型名。与路径上的模型行 ID 不是同一个字段。 */
  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @MaxLength(120)
  modelId?: string;

  @ValidateIf((_, value) => value !== undefined)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @IsEnum(AiModality)
  modality?: AiModality;

  @ValidateIf((_, value) => value !== undefined)
  @IsArray()
  @ArrayMinSize(1)
  @Transform(({ value }) =>
    Array.isArray(value)
      ? value.map((item) => (typeof item === 'string' ? item.trim().toUpperCase() : item))
      : value,
  )
  @IsEnum(AiToolCode, { each: true })
  toolTypes?: AiToolCode[];

  @ValidateIf((_, value) => value !== undefined)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  maxOutputTokens?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  fixedPlatformCost?: number | null;
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

  @IsOptional()
  @IsUUID()
  defaultModelId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  tokenCostLabel?: string;

  @IsOptional()
  @IsBoolean()
  guestTrialEnabled?: boolean;
}

export class PatchBrandingDto {
  @IsOptional()
  @IsString()
  @MaxLength(40)
  brandName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(12)
  logoText?: string;

  @IsOptional()
  @IsBoolean()
  aiEnabled?: boolean;
}

export class PatchNavigationDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  label?: string;

  @IsOptional()
  @IsBoolean()
  visible?: boolean;

  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value !== 'string') return value;
    const normalized = value.trim();
    if (normalized === 'comingSoon') return 'COMING_SOON';
    return normalized.toUpperCase();
  })
  @IsEnum(AiNavStatus)
  status?: AiNavStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  requiresLogin?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  description?: string;

  @Type(() => Number)
  @IsInt()
  version!: number;
}

export class NavigationSortItemDto {
  @IsUUID()
  id!: string;

  @Type(() => Number)
  @IsInt()
  sortOrder!: number;
}

export class SortNavigationDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => NavigationSortItemDto)
  items!: NavigationSortItemDto[];
}

export class PutEntitlementDto {
  @IsUUID()
  roleId!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  maxConcurrent?: number;

  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  allowedModelIds?: string[];
}
