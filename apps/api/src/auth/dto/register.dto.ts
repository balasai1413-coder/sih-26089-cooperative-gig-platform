import { Transform } from 'class-transformer';
import { IsEmail, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class RegisterDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @Matches(/^\+[1-9]\d{7,14}$/, {
    message: 'mobile must be in E.164 format, for example +919876543210',
  })
  mobile!: string;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail()
  @MaxLength(254)
  email?: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;
}
