import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Authorize, RequireOwnership } from '../auth/decorators/authorize.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { AddCertificateDto, UpdateCertificateDto } from './dto/certificate.dto';
import { CreateWorkerExperienceDto, UpdateWorkerExperienceDto } from './dto/worker-experience.dto';
import { AddSkillEvidenceDto, UpdateSkillEvidenceDto } from './dto/skill-evidence.dto';
import { UpdateWorkerProfileDto } from './dto/update-worker-profile.dto';
import { AddWorkerSkillDto, UpdateWorkerSkillDto } from './dto/worker-skill.dto';
import { WorkersService } from './workers.service';

@Controller('workers/me')
@Authorize({ roles: [UserRole.WORKER] })
export class WorkersController {
  constructor(private readonly workersService: WorkersService) {}

  @Get()
  getMyProfile(@CurrentUser() user: AuthenticatedUser) {
    return this.workersService.getMyProfile(user);
  }

  @Patch()
  updateMyProfile(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateWorkerProfileDto) {
    return this.workersService.updateMyProfile(user, dto);
  }

  @Get('experiences')
  listMyExperiences(@CurrentUser() user: AuthenticatedUser) {
    return this.workersService.listMyExperiences(user);
  }

  @Post('experiences')
  addMyExperience(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateWorkerExperienceDto) {
    return this.workersService.addMyExperience(user, dto);
  }

  @Patch('experiences/:experienceId')
  @RequireOwnership({ resource: 'workerExperience', param: 'experienceId' })
  updateMyExperience(
    @CurrentUser() user: AuthenticatedUser,
    @Param('experienceId') experienceId: string,
    @Body() dto: UpdateWorkerExperienceDto,
  ) {
    return this.workersService.updateMyExperience(user, experienceId, dto);
  }

  @Delete('experiences/:experienceId')
  @RequireOwnership({ resource: 'workerExperience', param: 'experienceId' })
  removeMyExperience(@Param('experienceId') experienceId: string) {
    return this.workersService.removeMyExperience(experienceId);
  }

  @Get('skill-catalog')
  listSkillCatalog() {
    return this.workersService.listSkillCatalog();
  }

  @Get('skills')
  listMySkills(@CurrentUser() user: AuthenticatedUser) {
    return this.workersService.listMySkills(user);
  }

  @Post('skills')
  addMySkill(@CurrentUser() user: AuthenticatedUser, @Body() dto: AddWorkerSkillDto) {
    return this.workersService.addMySkill(user, dto);
  }

  @Patch('skills/:workerSkillId')
  @RequireOwnership({ resource: 'workerSkill', param: 'workerSkillId' })
  updateMySkill(@Param('workerSkillId') workerSkillId: string, @Body() dto: UpdateWorkerSkillDto) {
    return this.workersService.updateMySkill(workerSkillId, dto);
  }

  @Delete('skills/:workerSkillId')
  @RequireOwnership({ resource: 'workerSkill', param: 'workerSkillId' })
  removeMySkill(@Param('workerSkillId') workerSkillId: string) {
    return this.workersService.removeMySkill(workerSkillId);
  }

  @Get('evidence')
  listMyEvidence(@CurrentUser() user: AuthenticatedUser) {
    return this.workersService.listMyEvidence(user);
  }

  @Post('skills/:workerSkillId/evidence')
  @RequireOwnership({ resource: 'workerSkill', param: 'workerSkillId' })
  addMyEvidence(
    @CurrentUser() user: AuthenticatedUser,
    @Param('workerSkillId') workerSkillId: string,
    @Body() dto: AddSkillEvidenceDto,
  ) {
    return this.workersService.addMyEvidence(user, workerSkillId, dto);
  }

  @Patch('evidence/:evidenceId')
  @RequireOwnership({ resource: 'skillEvidence', param: 'evidenceId' })
  updateMyEvidence(
    @CurrentUser() user: AuthenticatedUser,
    @Param('evidenceId') evidenceId: string,
    @Body() dto: UpdateSkillEvidenceDto,
  ) {
    return this.workersService.updateMyEvidence(user, evidenceId, dto);
  }

  @Delete('evidence/:evidenceId')
  @RequireOwnership({ resource: 'skillEvidence', param: 'evidenceId' })
  removeMyEvidence(@Param('evidenceId') evidenceId: string) {
    return this.workersService.removeMyEvidence(evidenceId);
  }

  @Get('certificates')
  listMyCertificates(@CurrentUser() user: AuthenticatedUser) {
    return this.workersService.listMyCertificates(user);
  }

  @Post('skills/:workerSkillId/certificates')
  @RequireOwnership({ resource: 'workerSkill', param: 'workerSkillId' })
  addMyCertificate(@Param('workerSkillId') workerSkillId: string, @Body() dto: AddCertificateDto) {
    return this.workersService.addMyCertificate(workerSkillId, dto);
  }

  @Patch('certificates/:certificateId')
  @RequireOwnership({ resource: 'certificate', param: 'certificateId' })
  updateMyCertificate(
    @Param('certificateId') certificateId: string,
    @Body() dto: UpdateCertificateDto,
  ) {
    return this.workersService.updateMyCertificate(certificateId, dto);
  }

  @Delete('certificates/:certificateId')
  @RequireOwnership({ resource: 'certificate', param: 'certificateId' })
  removeMyCertificate(@Param('certificateId') certificateId: string) {
    return this.workersService.removeMyCertificate(certificateId);
  }
}
