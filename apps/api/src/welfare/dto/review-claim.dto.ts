import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { WelfareClaimStatus } from '@prisma/client';

export class ReviewClaimDto {
  @IsEnum(WelfareClaimStatus)
  status!: WelfareClaimStatus;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  decisionReason?: string;
}
