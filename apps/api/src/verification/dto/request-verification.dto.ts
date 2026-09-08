import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';
import { VerificationMethod } from '@prisma/client';

const nullableText = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() || null : value;

export class RequestVerificationDto {
  @IsEnum(VerificationMethod)
  method!: VerificationMethod;

  @IsOptional()
  @Transform(nullableText)
  @IsUrl({ require_tld: false })
  @MaxLength(2048)
  evidenceReference?: string | null;

  @IsOptional()
  @Transform(nullableText)
  @IsUrl({ require_tld: false })
  @MaxLength(2048)
  assessmentReference?: string | null;

  @IsOptional()
  @Transform(nullableText)
  @IsString()
  @MaxLength(1000)
  note?: string | null;
}
