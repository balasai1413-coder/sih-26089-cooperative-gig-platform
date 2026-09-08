import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Authorize, RequireOwnership } from '../auth/decorators/authorize.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { RequestVerificationDto } from './dto/request-verification.dto';
import { ReviewVerificationDto } from './dto/review-verification.dto';
import { SkillVerificationService } from './skill-verification.service';

@Controller()
export class SkillVerificationController {
  constructor(private readonly verificationService: SkillVerificationService) {}

  @Post('workers/me/skills/:workerSkillId/verification-requests')
  @Authorize({ roles: [UserRole.WORKER] })
  @RequireOwnership({ resource: 'workerSkill', param: 'workerSkillId' })
  requestVerification(
    @CurrentUser() user: AuthenticatedUser,
    @Param('workerSkillId') workerSkillId: string,
    @Body() dto: RequestVerificationDto,
  ) {
    return this.verificationService.requestVerification(user, workerSkillId, dto);
  }

  @Get('workers/me/verification-requests')
  @Authorize({ roles: [UserRole.WORKER] })
  listMyRequests(@CurrentUser() user: AuthenticatedUser) {
    return this.verificationService.listMyRequests(user);
  }

  // GET /cooperatives/me moved to the Step 5 CooperativesModule; the
  // verification-specific cooperative routes remain here.
  @Get('cooperatives/:cooperativeId/verification-requests')
  @Authorize({
    roles: [UserRole.COOPERATIVE_ADMIN],
    cooperativeScope: { scope: 'admin', param: 'cooperativeId' },
  })
  listForCooperative(@Param('cooperativeId') cooperativeId: string) {
    return this.verificationService.listForCooperative(cooperativeId);
  }

  @Patch('cooperatives/:cooperativeId/verification-requests/:verificationId')
  @Authorize({
    roles: [UserRole.COOPERATIVE_ADMIN],
    cooperativeScope: { scope: 'admin', param: 'cooperativeId' },
    cooperativeResourceScope: {
      resource: 'skillVerification',
      resourceParam: 'verificationId',
      cooperativeParam: 'cooperativeId',
    },
  })
  reviewVerification(
    @CurrentUser() user: AuthenticatedUser,
    @Param('cooperativeId') cooperativeId: string,
    @Param('verificationId') verificationId: string,
    @Body() dto: ReviewVerificationDto,
  ) {
    return this.verificationService.reviewVerification(user, cooperativeId, verificationId, dto);
  }
}
