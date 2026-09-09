import { IsOptional, IsString, MaxLength } from 'class-validator';

export class WorkerRejectBookingDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000, { message: 'workerNotes cannot exceed 1000 characters' })
  workerNotes?: string;
}

export class WorkerCompleteBookingDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000, { message: 'workerNotes cannot exceed 1000 characters' })
  workerNotes?: string;
}

export class CustomerCancelBookingDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000, { message: 'customerNotes cannot exceed 1000 characters' })
  customerNotes?: string;
}
