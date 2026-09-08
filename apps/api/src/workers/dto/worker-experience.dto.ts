import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDate,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

const nullableText = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() || null : value;

const skillNames = ({ value }: { value: unknown }) =>
  Array.isArray(value)
    ? [
        ...new Set(
          value.map((item) => (typeof item === 'string' ? item.trim() : item)).filter(Boolean),
        ),
      ]
    : value;

export class CreateWorkerExperienceDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  title!: string;

  @IsOptional()
  @Transform(nullableText)
  @IsString()
  @MaxLength(200)
  organization?: string | null;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  startDate?: Date | null;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  endDate?: Date | null;

  @IsOptional()
  @IsBoolean()
  isCurrent?: boolean;

  @IsOptional()
  @Transform(nullableText)
  @IsString()
  @MaxLength(1200)
  description?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(12)
  @IsString({ each: true })
  @MaxLength(120, { each: true })
  @Transform(skillNames)
  relevantSkills?: string[];
}

export class UpdateWorkerExperienceDto {
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  title?: string;

  @IsOptional()
  @Transform(nullableText)
  @IsString()
  @MaxLength(200)
  organization?: string | null;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  startDate?: Date | null;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  endDate?: Date | null;

  @IsOptional()
  @IsBoolean()
  isCurrent?: boolean;

  @IsOptional()
  @Transform(nullableText)
  @IsString()
  @MaxLength(1200)
  description?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(12)
  @IsString({ each: true })
  @MaxLength(120, { each: true })
  @Transform(skillNames)
  relevantSkills?: string[];
}
