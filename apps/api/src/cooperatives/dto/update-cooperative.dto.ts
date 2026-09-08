import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString, IsEmail, MaxLength } from 'class-validator';
import { CooperativeStatus } from '@prisma/client';

const nullableText = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() || null : value;

export class UpdateCooperativeDto {
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(160)
  name?: string;

  @IsOptional()
  @Transform(nullableText)
  @IsString()
  @MaxLength(1000)
  description?: string | null;

  @IsOptional()
  @Transform(nullableText)
  @IsString()
  @MaxLength(240)
  location?: string | null;

  @IsOptional()
  @Transform(nullableText)
  @IsString()
  @MaxLength(240)
  operatingArea?: string | null;

  @IsOptional()
  @Transform(nullableText)
  @IsEmail()
  @MaxLength(254)
  contactEmail?: string | null;

  @IsOptional()
  @Transform(nullableText)
  @IsString()
  @MaxLength(16)
  contactPhone?: string | null;

  @IsOptional()
  @IsEnum(CooperativeStatus)
  status?: CooperativeStatus;
}
