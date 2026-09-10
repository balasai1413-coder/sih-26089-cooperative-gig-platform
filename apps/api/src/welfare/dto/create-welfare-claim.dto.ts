import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsObject, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { WelfareClaimType } from '@prisma/client';

export class CreateWelfareClaimDto {
  @IsEnum(WelfareClaimType)
  type!: WelfareClaimType;

  @IsString()
  @MaxLength(2000)
  description!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  amountRequested?: number;

  @IsOptional()
  @IsObject()
  evidenceMeta?: Record<string, unknown>;
}
