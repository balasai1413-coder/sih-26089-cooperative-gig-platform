import { Transform } from 'class-transformer';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @Matches(/^\+[1-9]\d{7,14}$/, { message: 'mobile must be in E.164 format' })
  mobile!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;
}
