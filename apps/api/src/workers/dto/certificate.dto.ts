import { Transform, Type } from 'class-transformer';
import { IsDate, IsOptional, IsString, IsUrl, MaxLength, MinLength } from 'class-validator';

const nullableText = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() || null : value;

export class AddCertificateDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  title!: string;

  @IsOptional()
  @Transform(nullableText)
  @IsString()
  @MaxLength(200)
  issuer?: string | null;

  @IsOptional()
  @Transform(nullableText)
  @IsString()
  @MaxLength(150)
  referenceNo?: string | null;

  @IsOptional()
  @Transform(nullableText)
  @IsUrl({ require_tld: false })
  @MaxLength(2048)
  documentUrl?: string | null;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  issuedAt?: Date;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  expiresAt?: Date;
}

export class UpdateCertificateDto {
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @Transform(nullableText)
  @IsString()
  @MaxLength(200)
  issuer?: string | null;

  @IsOptional()
  @Transform(nullableText)
  @IsString()
  @MaxLength(150)
  referenceNo?: string | null;

  @IsOptional()
  @Transform(nullableText)
  @IsUrl({ require_tld: false })
  @MaxLength(2048)
  documentUrl?: string | null;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  issuedAt?: Date | null;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  expiresAt?: Date | null;
}
