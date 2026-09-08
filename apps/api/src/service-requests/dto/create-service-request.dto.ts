import { Transform } from 'class-transformer';
import { IsDateString, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

const nullableText = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() || null : value;

export class CreateServiceRequestDto {
  @IsUUID()
  skillId!: string;

  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  title!: string;

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
