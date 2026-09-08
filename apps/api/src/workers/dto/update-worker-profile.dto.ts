import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { WorkerAvailability } from '@prisma/client';

const nullableText = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() || null : value;

export class UpdateWorkerProfileDto {
  @IsOptional()
  @Transform(nullableText)
  @IsString()
  @MaxLength(160)
  fullName?: string | null;

  @IsOptional()
  @Transform(nullableText)
  @IsUrl({ require_tld: false })
  @MaxLength(2048)
  profilePhotoUrl?: string | null;

  @IsOptional()
  @Transform(nullableText)
  @IsString()
  @MaxLength(1200)
  bio?: string | null;

  @IsOptional()
  @Transform(nullableText)
  @IsString()
  @MaxLength(240)
  location?: string | null;

  @IsOptional()
  @Transform(nullableText)
  @IsString()
  @MaxLength(200)
  educationQualification?: string | null;

  @IsOptional()
  @Transform(nullableText)
  @IsString()
  @MaxLength(240)
  educationInstitution?: string | null;

  @IsOptional()
  @IsInt()
  @Min(1900)
  @Max(2100)
  educationYear?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(80)
  yearsExperience?: number | null;

  @IsOptional()
  @IsEnum(WorkerAvailability)
  availability?: WorkerAvailability | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(12)
  @IsString({ each: true })
  @MaxLength(80, { each: true })
  @Transform(({ value }) =>
    Array.isArray(value)
      ? [
          ...new Set(
            value.map((item) => (typeof item === 'string' ? item.trim() : item)).filter(Boolean),
          ),
        ]
      : value,
  )
  languages?: string[];
}
