import { Transform } from 'class-transformer';
import { IsEnum, IsIn, IsNotEmpty, IsString, MaxLength, ValidateIf } from 'class-validator';
import { SkillVerificationStatus } from '@prisma/client';

export class ReviewVerificationDto {
  @IsEnum(SkillVerificationStatus)
  @IsIn([SkillVerificationStatus.VERIFIED, SkillVerificationStatus.REJECTED])
  decision!: 'VERIFIED' | 'REJECTED';

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() || null : value))
  @ValidateIf(
    (dto: ReviewVerificationDto) =>
      dto.decision === SkillVerificationStatus.REJECTED || dto.note !== undefined,
  )
  @IsNotEmpty({ message: 'A rejection reason is required' })
  @IsString()
  @MaxLength(1000)
  note?: string | null;
}
