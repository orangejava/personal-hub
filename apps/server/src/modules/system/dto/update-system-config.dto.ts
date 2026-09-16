import { Type } from 'class-transformer';
import { IsInt, IsObject, Min } from 'class-validator';

export class UpdateSystemConfigDto {
  @Type(() => Number)
  @IsInt()
  @Min(0)
  version!: number;

  @IsObject()
  value!: Record<string, unknown>;
}
