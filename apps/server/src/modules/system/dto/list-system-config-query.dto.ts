import { IsOptional, IsString } from 'class-validator';

export class ListSystemConfigQueryDto {
  @IsOptional()
  @IsString()
  group?: string;
}
