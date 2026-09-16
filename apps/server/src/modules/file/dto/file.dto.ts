import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { FilePurpose } from '@prisma/client';

export class CreateUploadDto {
  @IsEnum(FilePurpose)
  purpose!: FilePurpose;

  @IsString()
  @MaxLength(255)
  originalName!: string;

  @IsString()
  @MaxLength(127)
  mimeType!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500 * 1024 * 1024)
  size!: number;
}

export class CompletedPartDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  partNumber!: number;

  @IsString()
  @MaxLength(200)
  etag!: string;
}

export class CompleteUploadDto {
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CompletedPartDto)
  parts?: CompletedPartDto[];
}

export class AdminFileQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  mimeGroup?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  keyword?: string;

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

export class BatchDeleteFilesDto {
  @IsArray()
  @IsUUID(undefined, { each: true })
  ids!: string[];
}

export class CreateBookletImportDto {
  @IsUUID()
  sourceFileId!: string;
}

export class AppFileQueryDto {
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

  /** 可选；上传任务页默认不传，在前端按类型筛。 */
  @IsOptional()
  @IsIn(['pdf', 'word', 'zip'])
  mimeKind?: 'pdf' | 'word' | 'zip';
}

/**
 * 统一上传任务只按时间分页；可用 taskKind 在服务端过滤，禁止 mimeKind。
 */
export class AppUploadTaskQueryDto {
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

  @IsOptional()
  @IsIn(['booklet', 'pdf', 'word', 'zip'])
  taskKind?: 'booklet' | 'pdf' | 'word' | 'zip';
}

export class ListBookletImportQueryDto {
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

export class ImportLicenseDto {
  @IsString()
  @MaxLength(500)
  note!: string;
}
