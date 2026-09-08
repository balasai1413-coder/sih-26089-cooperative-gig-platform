import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString, IsUUID, IsUrl, MaxLength, MinLength } from 'class-validator';
import { SkillEvidenceType } from '@prisma/client';

const nullableText = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() || null : value;

export class AddSkillEvidenceDto {
  @IsEnum(SkillEvidenceType)
  type!: SkillEvidenceType;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(2)
  @MaxLength(1200)
  description!: string;

  @IsOptional()
  @Transform(nullableText)
  @IsUrl({ require_tld: false })
  @MaxLength(2048)
  referenceUrl?: string | null;

  @IsOptional()
  @IsUUID()
  experienceId?: string | null;
}

export class UpdateSkillEvidenceDto {
  @IsOptional()
  @IsEnum(SkillEvidenceType)
  type?: SkillEvidenceType;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(2)
  @MaxLength(1200)
  description?: string;

  @IsOptional()
  @Transform(nullableText)
  @IsUrl({ require_tld: false })
  @MaxLength(2048)
  referenceUrl?: string | null;

  @IsOptional()
  @IsUUID()
  experienceId?: string | null;
}
