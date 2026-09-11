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
} from 'class-validator';
import { WelfareProgramStatus, WelfareProgramType } from '@prisma/client';

export class UpdateWelfareProgramDto {
  @IsOptional()
  @IsString()
  @MaxLength(180)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsEnum(WelfareProgramType)
  type?: WelfareProgramType;

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

  @IsOptional()
  @IsEnum(WelfareProgramStatus)
  status?: WelfareProgramStatus;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  cooperativeId?: string;
}
