import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { WelfareProgramType } from '@prisma/client';

export class CreateWelfareProgramDto {
  @IsString()
  @MinLength(3)
  @MaxLength(180)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsEnum(WelfareProgramType)
  type!: WelfareProgramType;

  @IsOptional()
  @IsString()
  @MaxLength(180)
  providerName?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  coverageAmount?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  premiumAmount?: number;

  @IsOptional()
  @IsObject()
  eligibilityConfig?: Record<string, unknown>;

  @IsDateString()
  startDate!: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  cooperativeId?: string;
}
