import { IsInt, IsOptional, IsString, Max, Min, MaxLength } from 'class-validator';

export class CreateReviewDto {
  @IsInt()
  @Min(1, { message: 'rating must be at least 1' })
  @Max(5, { message: 'rating must be at most 5' })
  rating!: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000, { message: 'comment cannot exceed 1000 characters' })
  comment?: string;
}
