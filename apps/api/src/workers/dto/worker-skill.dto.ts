import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  IsUrl,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { SkillProficiency } from '@prisma/client';

const nullableText = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() || null : value;

export class AddWorkerSkillDto {
  @IsUUID()
  skillId!: string;

  @IsEnum(SkillProficiency)
  proficiency!: SkillProficiency;

  @IsInt()
  @Min(0)
  @Max(80)
  experienceYears!: number;

  @IsOptional()
  @Transform(nullableText)
  @IsString()
  @MaxLength(1000)
  experienceSummary?: string | null;

  @IsOptional()
  @Transform(nullableText)
  @IsUrl({ require_tld: false })
  @MaxLength(2048)
  evidenceReference?: string | null;
}

export class UpdateWorkerSkillDto {
  @IsOptional()
  @IsEnum(SkillProficiency)
  proficiency?: SkillProficiency;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(80)
  experienceYears?: number;

  @IsOptional()
  @Transform(nullableText)
  @IsString()
  @MaxLength(1000)
  experienceSummary?: string | null;

  @IsOptional()
  @Transform(nullableText)
  @IsUrl({ require_tld: false })
  @MaxLength(2048)
  evidenceReference?: string | null;
}
