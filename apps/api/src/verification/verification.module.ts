import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SkillVerificationController } from './skill-verification.controller';
import { SkillVerificationService } from './skill-verification.service';

@Module({
  imports: [AuthModule],
  controllers: [SkillVerificationController],
  providers: [SkillVerificationService],
})
export class VerificationModule {}
