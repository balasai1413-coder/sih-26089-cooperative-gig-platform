import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, SkillVerificationStatus } from '@prisma/client';
import { AuthorizationService } from '../auth/authorization/authorization.service';
import { AuthenticatedUser } from '../auth/auth.types';
import { PrismaService } from '../database/prisma.service';
import { RequestVerificationDto } from './dto/request-verification.dto';
import { ReviewVerificationDto } from './dto/review-verification.dto';

const verificationInclude = {
  workerSkill: {
    include: {
      skill: { select: { id: true, name: true } },
      worker: { select: { id: true, fullName: true, userId: true } },
      certificates: {
        select: { id: true, title: true, issuer: true, referenceNo: true, status: true },
        orderBy: { submittedAt: 'desc' },
      },
      evidence: {
        select: {
          id: true,
          type: true,
          description: true,
          referenceUrl: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      },
    },
  },
  requestedByWorker: { select: { id: true } },
  verifiedBy: { select: { id: true } },
} satisfies Prisma.SkillVerificationInclude;

@Injectable()
export class SkillVerificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authorization: AuthorizationService,
  ) {}

  async requestVerification(
    actor: AuthenticatedUser,
    workerSkillId: string,
    dto: RequestVerificationDto,
  ) {
    const worker = await this.prisma.worker.findUnique({
      where: { userId: actor.id },
      select: { id: true },
    });
    if (!worker) throw new NotFoundException('Worker profile is not available');
    const workerSkill = await this.prisma.workerSkill.findFirst({
      where: { id: workerSkillId, workerId: worker.id },
      select: { id: true, verificationStatus: true },
    });
    if (!workerSkill) throw new NotFoundException('Skill is not available');
    if (workerSkill.verificationStatus === SkillVerificationStatus.VERIFIED) {
      throw new ConflictException('This skill is already verified');
    }

    const outstanding = await this.prisma.skillVerification.findFirst({
      where: {
        workerSkillId,
        status: {
          in: [SkillVerificationStatus.PENDING, SkillVerificationStatus.ASSESSMENT_PENDING],
        },
      },
      select: { id: true },
    });
    if (outstanding) throw new ConflictException('A verification request is already under review');

    // The review queue always begins pending. The method records how the
    // competency can be assessed; it never verifies the skill by itself.
    const status = SkillVerificationStatus.PENDING;
    const now = new Date();
    const verification = await this.prisma.$transaction(async (transaction) => {
      const created = await transaction.skillVerification.create({
        data: {
          workerSkillId,
          requestedByWorkerId: worker.id,
          method: dto.method,
          status,
          notes: dto.note,
          evidenceReference: dto.evidenceReference,
          assessmentReference: dto.assessmentReference,
          requestedAt: now,
        },
        include: verificationInclude,
      });
      await transaction.workerSkill.update({
        where: { id: workerSkillId },
        data: { verificationStatus: status, verificationRequestedAt: now },
      });
      return created;
    });
    return this.toVerification(verification);
  }

  async listForCooperative(cooperativeId: string) {
    const requests = await this.prisma.skillVerification.findMany({
      where: {
        status: {
          in: [SkillVerificationStatus.PENDING, SkillVerificationStatus.ASSESSMENT_PENDING],
        },
        workerSkill: {
          worker: { memberships: { some: { cooperativeId, leftAt: null } } },
        },
      },
      include: verificationInclude,
      orderBy: { requestedAt: 'asc' },
    });
    return requests.map((request) => this.toVerification(request));
  }

  async listMyRequests(actor: AuthenticatedUser) {
    const worker = await this.prisma.worker.findUnique({
      where: { userId: actor.id },
      select: { id: true },
    });
    if (!worker) throw new NotFoundException('Worker profile is not available');
    const requests = await this.prisma.skillVerification.findMany({
      where: { requestedByWorkerId: worker.id },
      include: verificationInclude,
      orderBy: { requestedAt: 'desc' },
    });
    return requests.map((request) => this.toVerification(request));
  }

  async reviewVerification(
    actor: AuthenticatedUser,
    cooperativeId: string,
    verificationId: string,
    dto: ReviewVerificationDto,
  ) {
    // The route guard performs the same check before this point. Rechecking in
    // the service keeps policy intact if this method is reused by another flow.
    await this.authorization.assertCooperativeResourceScope(
      'skillVerification',
      verificationId,
      cooperativeId,
    );
    const existing = await this.prisma.skillVerification.findUnique({
      where: { id: verificationId },
      select: { id: true, workerSkillId: true, status: true },
    });
    if (!existing) throw new NotFoundException('Verification request is not available');
    if (
      existing.status !== SkillVerificationStatus.PENDING &&
      existing.status !== SkillVerificationStatus.ASSESSMENT_PENDING
    ) {
      throw new ConflictException('This verification request has already been reviewed');
    }
    if (dto.decision === SkillVerificationStatus.REJECTED && !dto.note) {
      throw new BadRequestException('A rejection reason is required');
    }

    const now = new Date();
    const reviewed = await this.prisma.$transaction(async (transaction) => {
      const verification = await transaction.skillVerification.update({
        where: { id: verificationId },
        data: {
          status: dto.decision,
          notes: dto.note,
          reviewedAt: now,
          verifiedById: actor.id,
        },
        include: verificationInclude,
      });
      await transaction.workerSkill.update({
        where: { id: existing.workerSkillId },
        data:
          dto.decision === SkillVerificationStatus.VERIFIED
            ? {
                verificationStatus: SkillVerificationStatus.VERIFIED,
                verifiedAt: now,
                verifiedByUserId: actor.id,
              }
            : {
                verificationStatus: SkillVerificationStatus.REJECTED,
                verifiedAt: null,
                verifiedByUserId: null,
              },
      });
      return verification;
    });
    return this.toVerification(reviewed);
  }

  private toVerification(
    verification: Prisma.SkillVerificationGetPayload<{ include: typeof verificationInclude }>,
  ) {
    return {
      id: verification.id,
      status: verification.status,
      method: verification.method,
      note: verification.notes,
      evidenceReference: verification.evidenceReference,
      assessmentReference: verification.assessmentReference,
      requestedAt: verification.requestedAt,
      reviewedAt: verification.reviewedAt,
      worker: {
        id: verification.workerSkill.worker.id,
        fullName: verification.workerSkill.worker.fullName,
      },
      skill: {
        id: verification.workerSkill.skill.id,
        name: verification.workerSkill.skill.name,
        proficiency: verification.workerSkill.proficiency,
        experienceYears: verification.workerSkill.experienceYears,
        experienceSummary: verification.workerSkill.experienceSummary,
        evidenceReference: verification.workerSkill.evidenceReference,
      },
      certificates: verification.workerSkill.certificates,
      evidence: verification.workerSkill.evidence,
      reviewedByUserId: verification.verifiedBy?.id ?? null,
    };
  }
}
