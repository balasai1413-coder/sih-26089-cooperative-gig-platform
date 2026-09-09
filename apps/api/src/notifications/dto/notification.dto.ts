import { IsInt, IsOptional, Max, Min, ValidateIf } from 'class-validator';

export class ListNotificationsQueryDto {
  @IsOptional()
  @IsInt({ message: 'page must be an integer' })
  @Min(1, { message: 'page must be at least 1' })
  page?: number;

  @IsOptional()
  @IsInt({ message: 'limit must be an integer' })
  @Min(1, { message: 'limit must be at least 1' })
  @Max(100, { message: 'limit must not exceed 100' })
  limit?: number;

  @IsOptional()
  @ValidateIf((o) => o.unreadOnly !== undefined)
  unreadOnly?: boolean;
}

export class MarkAsReadDto {}

export class MarkAllAsReadDto {}
