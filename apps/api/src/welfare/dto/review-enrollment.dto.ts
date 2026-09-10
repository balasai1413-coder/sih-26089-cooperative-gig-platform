import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { WelfareEnrollmentStatus } from '@prisma/client';

export class ReviewEnrollmentDto {
  @IsEnum(WelfareEnrollmentStatus)
  status!: WelfareEnrollmentStatus;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  rejectionReason?: string;
}
