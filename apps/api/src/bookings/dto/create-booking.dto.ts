import { IsDateString, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateBookingDto {
  @IsUUID('4', { message: 'workerId must be a valid UUID' })
  workerId!: string;

  @IsOptional()
  @IsDateString({}, { message: 'scheduledAt must be a valid ISO-8601 date string' })
  scheduledAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000, { message: 'customerNotes cannot exceed 1000 characters' })
  customerNotes?: string;
}
