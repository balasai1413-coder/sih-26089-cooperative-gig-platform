import { Transform } from 'class-transformer';
import { IsDateString, IsOptional, IsString, MaxLength } from 'class-validator';

const nullableText = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() || null : value;

export class UpdateServiceRequestDto {
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @Transform(nullableText)
  @IsString()
  @MaxLength(2000)
  description?: string | null;

  @IsOptional()
  @Transform(nullableText)
  @IsString()
  @MaxLength(300)
  location?: string | null;

  @IsOptional()
  @IsDateString()
  preferredDateTime?: string | null;
}
