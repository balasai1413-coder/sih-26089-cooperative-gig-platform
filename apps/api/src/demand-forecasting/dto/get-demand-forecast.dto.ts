import { Transform } from 'class-transformer';
import { IsDateString, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

const optionalText = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() || undefined : value;

export class GetDemandForecastDto {
  @IsOptional()
  @IsDateString()
  forecastStart?: string;

  @IsOptional()
  @IsDateString()
  forecastEnd?: string;

  @IsOptional()
  @IsUUID()
  skillId?: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @Transform(optionalText)
  @IsString()
  @MaxLength(300)
  location?: string;
}
