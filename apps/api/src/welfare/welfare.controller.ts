import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Authorize } from '../auth/decorators/authorize.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { CreateWelfareClaimDto } from './dto/create-welfare-claim.dto';
import { CreateWelfareProgramDto } from './dto/create-welfare-program.dto';
import { ReviewClaimDto } from './dto/review-claim.dto';
import { ReviewEnrollmentDto } from './dto/review-enrollment.dto';
import { UpdateWelfareProgramDto } from './dto/update-welfare-program.dto';
import { WelfareService } from './welfare.service';

@Controller()
export class WelfareController {
  constructor(private readonly welfareService: WelfareService) {}

  @Get('workers/me/welfare/programs')
  @Authorize({ roles: [UserRole.WORKER] })
  listWorkerPrograms(@CurrentUser() user: AuthenticatedUser) {
    return this.welfareService.listProgramsForWorker(user);
  }

  @Get('workers/me/welfare/programs/:programId/eligibility')
  @Authorize({ roles: [UserRole.WORKER] })
  getWorkerProgramEligibility(
    @CurrentUser() user: AuthenticatedUser,
    @Param('programId') programId: string,
  ) {
    return this.welfareService.getProgramEligibilityForWorker(user, programId);
  }

  @Post('workers/me/welfare/programs/:programId/enroll')
  @Authorize({ roles: [UserRole.WORKER] })
  enrollWorkerProgram(
    @CurrentUser() user: AuthenticatedUser,
    @Param('programId') programId: string,
  ) {
    return this.welfareService.enrollInProgram(user, programId);
  }

  @Get('workers/me/welfare/enrollments')
  @Authorize({ roles: [UserRole.WORKER] })
  listWorkerEnrollments(@CurrentUser() user: AuthenticatedUser) {
    return this.welfareService.listMyEnrollments(user);
  }

  @Get('workers/me/welfare/enrollments/:enrollmentId')
  @Authorize({ roles: [UserRole.WORKER] })
  getWorkerEnrollment(@CurrentUser() user: AuthenticatedUser, @Param('enrollmentId') enrollmentId: string) {
    return this.welfareService.getMyEnrollment(user, enrollmentId);
  }

  @Post('workers/me/welfare/enrollments/:enrollmentId/cancel')
  @Authorize({ roles: [UserRole.WORKER] })
  cancelWorkerEnrollment(@CurrentUser() user: AuthenticatedUser, @Param('enrollmentId') enrollmentId: string) {
    return this.welfareService.cancelMyEnrollment(user, enrollmentId);
  }

  @Get('workers/me/welfare/claims')
  @Authorize({ roles: [UserRole.WORKER] })
  listWorkerClaims(@CurrentUser() user: AuthenticatedUser) {
    return this.welfareService.listMyClaims(user);
  }

  @Get('workers/me/welfare/claims/:claimId')
  @Authorize({ roles: [UserRole.WORKER] })
  getWorkerClaim(@CurrentUser() user: AuthenticatedUser, @Param('claimId') claimId: string) {
    return this.welfareService.getMyClaim(user, claimId);
  }

  @Post('workers/me/welfare/enrollments/:enrollmentId/claims')
  @Authorize({ roles: [UserRole.WORKER] })
  createWorkerClaim(
    @CurrentUser() user: AuthenticatedUser,
    @Param('enrollmentId') enrollmentId: string,
    @Body() dto: CreateWelfareClaimDto,
  ) {
    return this.welfareService.submitClaim(user, enrollmentId, dto);
  }

  @Get('cooperatives/me/welfare/programs')
  @Authorize({ roles: [UserRole.COOPERATIVE_ADMIN] })
  listCooperativePrograms(@CurrentUser() user: AuthenticatedUser) {
    return this.welfareService.listProgramsForCooperative(user, user.id);
  }

  @Post('cooperatives/me/welfare/programs')
  @Authorize({ roles: [UserRole.COOPERATIVE_ADMIN] })
  createCooperativeProgram(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateWelfareProgramDto,
  ) {
    return this.welfareService.createProgram(user, user.id, dto);
  }

  @Get('cooperatives/me/welfare/programs/:programId')
  @Authorize({ roles: [UserRole.COOPERATIVE_ADMIN] })
  getCooperativeProgram(@CurrentUser() user: AuthenticatedUser, @Param('programId') programId: string) {
    return this.welfareService.getProgramForCooperative(user, user.id, programId);
  }

  @Patch('cooperatives/me/welfare/programs/:programId')
  @Authorize({ roles: [UserRole.COOPERATIVE_ADMIN] })
  updateCooperativeProgram(
    @CurrentUser() user: AuthenticatedUser,
    @Param('programId') programId: string,
    @Body() dto: UpdateWelfareProgramDto,
  ) {
    return this.welfareService.updateProgram(user, user.id, programId, dto);
  }

  @Post('cooperatives/me/welfare/programs/:programId/activate')
  @Authorize({ roles: [UserRole.COOPERATIVE_ADMIN] })
  activateCooperativeProgram(@CurrentUser() user: AuthenticatedUser, @Param('programId') programId: string) {
    return this.welfareService.activateProgram(user, user.id, programId);
  }

  @Post('cooperatives/me/welfare/programs/:programId/deactivate')
  @Authorize({ roles: [UserRole.COOPERATIVE_ADMIN] })
  deactivateCooperativeProgram(@CurrentUser() user: AuthenticatedUser, @Param('programId') programId: string) {
    return this.welfareService.deactivateProgram(user, user.id, programId);
  }

  @Get('cooperatives/me/welfare/enrollments')
  @Authorize({ roles: [UserRole.COOPERATIVE_ADMIN] })
  listCooperativeEnrollments(@CurrentUser() user: AuthenticatedUser) {
    return this.welfareService.listEnrollmentsForCooperative(user, user.id);
  }

  @Get('cooperatives/me/welfare/enrollments/:enrollmentId')
  @Authorize({ roles: [UserRole.COOPERATIVE_ADMIN] })
  getCooperativeEnrollment(@CurrentUser() user: AuthenticatedUser, @Param('enrollmentId') enrollmentId: string) {
    return this.welfareService.getEnrollmentForCooperative(user, user.id, enrollmentId);
  }

  @Post('cooperatives/me/welfare/enrollments/:enrollmentId/approve')
  @Authorize({ roles: [UserRole.COOPERATIVE_ADMIN] })
  approveCooperativeEnrollment(@CurrentUser() user: AuthenticatedUser, @Param('enrollmentId') enrollmentId: string) {
    return this.welfareService.reviewEnrollment(user, user.id, enrollmentId, { status: 'ACTIVE' });
  }

  @Post('cooperatives/me/welfare/enrollments/:enrollmentId/reject')
  @Authorize({ roles: [UserRole.COOPERATIVE_ADMIN] })
  rejectCooperativeEnrollment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('enrollmentId') enrollmentId: string,
    @Body() dto: ReviewEnrollmentDto,
  ) {
    return this.welfareService.reviewEnrollment(user, user.id, enrollmentId, { ...dto, status: 'REJECTED' });
  }

  @Get('cooperatives/me/welfare/claims')
  @Authorize({ roles: [UserRole.COOPERATIVE_ADMIN] })
  listCooperativeClaims(@CurrentUser() user: AuthenticatedUser) {
    return this.welfareService.listClaimsForCooperative(user, user.id);
  }

  @Get('cooperatives/me/welfare/claims/:claimId')
  @Authorize({ roles: [UserRole.COOPERATIVE_ADMIN] })
  getCooperativeClaim(@CurrentUser() user: AuthenticatedUser, @Param('claimId') claimId: string) {
    return this.welfareService.getClaimForCooperative(user, user.id, claimId);
  }

  @Post('cooperatives/me/welfare/claims/:claimId/approve')
  @Authorize({ roles: [UserRole.COOPERATIVE_ADMIN] })
  approveCooperativeClaim(@CurrentUser() user: AuthenticatedUser, @Param('claimId') claimId: string) {
    return this.welfareService.reviewClaim(user, user.id, claimId, { status: 'APPROVED' });
  }

  @Post('cooperatives/me/welfare/claims/:claimId/reject')
  @Authorize({ roles: [UserRole.COOPERATIVE_ADMIN] })
  rejectCooperativeClaim(
    @CurrentUser() user: AuthenticatedUser,
    @Param('claimId') claimId: string,
    @Body() dto: ReviewClaimDto,
  ) {
    return this.welfareService.reviewClaim(user, user.id, claimId, { ...dto, status: 'REJECTED' });
  }

  @Post('cooperatives/me/welfare/claims/:claimId/mark-paid')
  @Authorize({ roles: [UserRole.COOPERATIVE_ADMIN] })
  markCooperativeClaimPaid(@CurrentUser() user: AuthenticatedUser, @Param('claimId') claimId: string) {
    return this.welfareService.reviewClaim(user, user.id, claimId, { status: 'PAID' });
  }

  @Get('cooperatives/me/welfare/stats')
  @Authorize({ roles: [UserRole.COOPERATIVE_ADMIN] })
  getCooperativeStats(@CurrentUser() user: AuthenticatedUser) {
    return this.welfareService.getCooperativeWelfareStats(user, user.id);
  }
}
