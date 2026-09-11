import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  NotificationType,
  Prisma,
  UserRole,
  WelfareClaimStatus,
  WelfareClaimType,
  WelfareEnrollmentStatus,
  WelfareProgramStatus,
  WelfareProgramType,
} from '@prisma/client';
import { AuthorizationService } from '../auth/authorization/authorization.service';
import { AuthenticatedUser } from '../auth/auth.types';
import { PrismaService } from '../database/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateWelfareClaimDto } from './dto/create-welfare-claim.dto';
import { CreateWelfareProgramDto } from './dto/create-welfare-program.dto';
import { ReviewClaimDto } from './dto/review-claim.dto';
import { ReviewEnrollmentDto } from './dto/review-enrollment.dto';
import { UpdateWelfareProgramDto } from './dto/update-welfare-program.dto';

const welfareProgramSelect = {
  id: true,
  cooperativeId: true,
  name: true,
  description: true,
  type: true,
  providerName: true,
  coverageAmount: true,
  premiumAmount: true,
  eligibilityConfig: true,
  status: true,
  startDate: true,
  endDate: true,
  createdAt: true,
  updatedAt: true,
  cooperative: {
    select: {
      id: true,
      name: true,
    },
  },
} satisfies Prisma.WelfareProgramSelect;

const enrollmentSelect = {
  id: true,
  welfareProgramId: true,
  workerId: true,
  status: true,
  enrolledAt: true,
  approvedAt: true,
  rejectedAt: true,
  rejectionReason: true,
  cancellationReason: true,
  createdAt: true,
  updatedAt: true,
  welfareProgram: { select: welfareProgramSelect },
  worker: {
    select: {
      id: true,
      fullName: true,
      userId: true,
      memberships: {
        where: { leftAt: null },
        select: { cooperativeId: true },
      },
    },
  },
} satisfies Prisma.WorkerBenefitEnrollmentSelect;

const claimSelect = {
  id: true,
  enrollmentId: true,
  workerId: true,
  type: true,
  description: true,
  amountRequested: true,
  status: true,
  submittedAt: true,
  reviewedAt: true,
  decisionReason: true,
  evidenceMeta: true,
  paidAt: true,
  createdAt: true,
  updatedAt: true,
  enrollment: { select: enrollmentSelect },
  worker: { select: { id: true, fullName: true, userId: true } },
} satisfies Prisma.WelfareClaimSelect;

@Injectable()
export class WelfareService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authorization: AuthorizationService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async listProgramsForWorker(actor: AuthenticatedUser) {
    const worker = await this.prisma.worker.findUnique({
      where: { userId: actor.id },
      select: { id: true, memberships: { where: { leftAt: null }, select: { cooperativeId: true } } },
    });
    if (!worker) throw new NotFoundException('Worker profile is not available');
    const cooperativeIds = worker.memberships.map((membership) => membership.cooperativeId);
    if (!cooperativeIds.length) return [] as const;

    const programs = await this.prisma.welfareProgram.findMany({
      where: {
        cooperativeId: { in: cooperativeIds },
        status: WelfareProgramStatus.ACTIVE,
        startDate: { lte: new Date() },
        OR: [{ endDate: null }, { endDate: { gte: new Date() } }],
      },
      include: {
        cooperative: { select: { id: true, name: true } },
        enrollments: {
          where: { workerId: worker.id },
          select: { id: true, status: true, enrolledAt: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const eligibility = await Promise.all(
      programs.map((program) => this.evaluateEligibility(worker.id, program)),
    );

    return programs.map((program, index) => ({
      ...this.toProgram(program),
      eligible: eligibility[index].eligible,
      reasons: eligibility[index].reasons,
      enrollmentStatus: program.enrollments[0]?.status ?? null,
      enrollmentId: program.enrollments[0]?.id ?? null,
    }));
  }

  async getProgramEligibilityForWorker(actor: AuthenticatedUser, programId: string) {
    const worker = await this.prisma.worker.findUnique({
      where: { userId: actor.id },
      select: {
        id: true,
        fullName: true,
        memberships: { where: { leftAt: null }, select: { cooperativeId: true } },
      },
    });
    if (!worker) throw new NotFoundException('Worker profile is not available');
    const program = await this.prisma.welfareProgram.findUnique({
      where: { id: programId },
      include: {
        cooperative: { select: { id: true, name: true, adminUserId: true } },
        enrollments: { where: { workerId: worker.id }, select: { id: true, status: true } },
      },
    });
    if (!program) throw new NotFoundException('Welfare program is not available');
    if (!worker.memberships.some((membership) => membership.cooperativeId === program.cooperativeId)) {
      throw new NotFoundException('Welfare program is not available to this worker');
    }

    const evaluation = await this.evaluateEligibility(worker.id, program);
    return {
      programId: program.id,
      programName: program.name,
      cooperativeId: program.cooperativeId,
      ...evaluation,
    };
  }

  async enrollInProgram(actor: AuthenticatedUser, programId: string) {
    const worker = await this.prisma.worker.findUnique({
      where: { userId: actor.id },
      select: {
        id: true,
        fullName: true,
        memberships: { where: { leftAt: null }, select: { cooperativeId: true } },
      },
    });
    if (!worker) throw new NotFoundException('Worker profile is not available');

    const program = await this.prisma.welfareProgram.findUnique({
      where: { id: programId },
      include: { cooperative: { select: { id: true, name: true, adminUserId: true } } },
    });
    if (!program) throw new NotFoundException('Welfare program is not available');
    if (!worker.memberships.some((membership) => membership.cooperativeId === program.cooperativeId)) {
      throw new ConflictException('This program is not available to your cooperative');
    }

    const evaluation = await this.evaluateEligibility(worker.id, program);
    if (!evaluation.eligible) {
      throw new ConflictException(`You are not eligible for this benefit: ${evaluation.reasons.join(', ')}`);
    }

    const existing = await this.prisma.workerBenefitEnrollment.findFirst({
      where: {
        welfareProgramId: programId,
        workerId: worker.id,
        status: { in: [WelfareEnrollmentStatus.PENDING, WelfareEnrollmentStatus.ACTIVE] },
      },
      select: { id: true, status: true },
    });
    if (existing) {
      throw new ConflictException('You already have an active or pending enrollment for this program');
    }

    const enrollment = await this.prisma.$transaction(async (tx) => {
      const created = await tx.workerBenefitEnrollment.create({
        data: {
          welfareProgramId: programId,
          workerId: worker.id,
          status: WelfareEnrollmentStatus.PENDING,
        },
        include: { welfareProgram: { select: welfareProgramSelect }, worker: { select: { id: true, fullName: true, userId: true } } },
      });
      await tx.notification.create({
        data: {
          recipientUserId: actor.id,
          type: NotificationType.WELFARE_ENROLLMENT_SUBMITTED,
          title: 'Welfare enrollment submitted',
          message: `Your request for ${program.name} has been received and is under review.`,
          eventKey: `welfare:enrollment:submitted:${created.id}`,
          metadata: { programId: program.id, enrollmentId: created.id },
        },
      });
      return created;
    });

    await this.notificationsService.createNotification({
      recipientUserId: program.cooperative.adminUserId ?? actor.id,
      type: NotificationType.WELFARE_ENROLLMENT_SUBMITTED,
      title: 'Welfare enrollment requires review',
      message: `${worker.fullName ?? 'A worker'} has requested enrollment in ${program.name}.`,
      eventKey: `cooperative:welfare:enrollment:${enrollment.id}`,
      metadata: { programId: program.id, enrollmentId: enrollment.id, workerId: worker.id },
    });

    return this.toEnrollment(enrollment);
  }

  async listMyEnrollments(actor: AuthenticatedUser) {
    const worker = await this.prisma.worker.findUnique({
      where: { userId: actor.id },
      select: { id: true },
    });
    if (!worker) throw new NotFoundException('Worker profile is not available');
    const enrollments = await this.prisma.workerBenefitEnrollment.findMany({
      where: { workerId: worker.id },
      include: { welfareProgram: { select: welfareProgramSelect }, worker: { select: { id: true, fullName: true, userId: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return enrollments.map((enrollment) => this.toEnrollment(enrollment));
  }

  async getMyEnrollment(actor: AuthenticatedUser, enrollmentId: string) {
    const worker = await this.prisma.worker.findUnique({
      where: { userId: actor.id },
      select: { id: true },
    });
    if (!worker) throw new NotFoundException('Worker profile is not available');
    const enrollment = await this.prisma.workerBenefitEnrollment.findFirst({
      where: { id: enrollmentId, workerId: worker.id },
      include: { welfareProgram: { select: welfareProgramSelect }, worker: { select: { id: true, fullName: true, userId: true } }, claims: true },
    });
    if (!enrollment) throw new NotFoundException('Welfare enrollment is not available');
    return this.toEnrollment(enrollment);
  }

  async cancelMyEnrollment(actor: AuthenticatedUser, enrollmentId: string) {
    const worker = await this.prisma.worker.findUnique({
      where: { userId: actor.id },
      select: { id: true },
    });
    if (!worker) throw new NotFoundException('Worker profile is not available');
    const enrollment = await this.prisma.workerBenefitEnrollment.findFirst({
      where: { id: enrollmentId, workerId: worker.id },
      select: { id: true, status: true },
    });
    if (!enrollment) throw new NotFoundException('Welfare enrollment is not available');
    if (enrollment.status !== WelfareEnrollmentStatus.PENDING && enrollment.status !== WelfareEnrollmentStatus.ACTIVE) {
      throw new ConflictException('Only pending or active enrollments can be cancelled');
    }
    const updated = await this.prisma.workerBenefitEnrollment.update({
      where: { id: enrollmentId },
      data: { status: WelfareEnrollmentStatus.CANCELLED, cancellationReason: 'Cancelled by worker' },
      include: { welfareProgram: { select: welfareProgramSelect }, worker: { select: { id: true, fullName: true, userId: true } } },
    });
    return this.toEnrollment(updated);
  }

  async listMyClaims(actor: AuthenticatedUser) {
    const worker = await this.prisma.worker.findUnique({
      where: { userId: actor.id },
      select: { id: true },
    });
    if (!worker) throw new NotFoundException('Worker profile is not available');
    const claims = await this.prisma.welfareClaim.findMany({
      where: { workerId: worker.id },
      include: { enrollment: { select: { id: true, welfareProgram: { select: welfareProgramSelect }, worker: { select: { id: true, fullName: true, userId: true } } } }, worker: { select: { id: true, fullName: true, userId: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return claims.map((claim) => this.toClaim(claim));
  }

  async getMyClaim(actor: AuthenticatedUser, claimId: string) {
    const worker = await this.prisma.worker.findUnique({
      where: { userId: actor.id },
      select: { id: true, fullName: true },
    });
    if (!worker) throw new NotFoundException('Worker profile is not available');
    const claim = await this.prisma.welfareClaim.findFirst({
      where: { id: claimId, workerId: worker.id },
      include: { enrollment: { select: { id: true, welfareProgram: { select: welfareProgramSelect }, worker: { select: { id: true, fullName: true, userId: true } } } }, worker: { select: { id: true, fullName: true, userId: true } } },
    });
    if (!claim) throw new NotFoundException('Welfare claim is not available');
    return this.toClaim(claim);
  }

  async submitClaim(actor: AuthenticatedUser, enrollmentId: string, dto: CreateWelfareClaimDto) {
    const worker = await this.prisma.worker.findUnique({
      where: { userId: actor.id },
      select: { id: true, fullName: true },
    });
    if (!worker) throw new NotFoundException('Worker profile is not available');
    const enrollment = await this.prisma.workerBenefitEnrollment.findFirst({
      where: { id: enrollmentId, workerId: worker.id },
      include: { welfareProgram: { select: welfareProgramSelect } },
    });
    if (!enrollment) throw new NotFoundException('Welfare enrollment is not available');
    if (enrollment.status !== WelfareEnrollmentStatus.ACTIVE) {
      throw new ConflictException('Claims can only be submitted for active enrollments');
    }
    const existingClaim = await this.prisma.welfareClaim.findFirst({
      where: { enrollmentId, status: { in: [WelfareClaimStatus.SUBMITTED, WelfareClaimStatus.UNDER_REVIEW, WelfareClaimStatus.APPROVED, WelfareClaimStatus.PAID] } },
      select: { id: true },
    });
    if (existingClaim) {
      throw new ConflictException('There is already an active claim for this enrollment');
    }

    const claim = await this.prisma.$transaction(async (tx) => {
      const created = await tx.welfareClaim.create({
        data: {
          enrollmentId,
          workerId: worker.id,
          type: dto.type,
          description: dto.description,
          amountRequested: dto.amountRequested ?? null,
          status: WelfareClaimStatus.SUBMITTED,
          evidenceMeta: dto.evidenceMeta ?? (null as any),
        },
        include: { enrollment: { select: { id: true, welfareProgram: { select: welfareProgramSelect }, worker: { select: { id: true, fullName: true, userId: true } } } }, worker: { select: { id: true, fullName: true, userId: true } } },
      });
      await tx.notification.create({
        data: {
          recipientUserId: actor.id,
          type: NotificationType.WELFARE_CLAIM_SUBMITTED,
          title: 'Claim submitted',
          message: 'Your welfare claim has been submitted and will be reviewed by the cooperative.',
          eventKey: `welfare:claim:submitted:${created.id}`,
          metadata: { claimId: created.id, enrollmentId },
        },
      });
      return created;
    });

    const adminUserId = await this.getCooperativeAdminUserId(enrollment.welfareProgram.cooperativeId);
    await this.notificationsService.createNotification({
      recipientUserId: adminUserId,
      type: NotificationType.WELFARE_CLAIM_SUBMITTED,
      title: 'Welfare claim requires review',
      message: `${worker.fullName ?? 'A worker'} submitted a ${dto.type.toLowerCase()} claim for ${enrollment.welfareProgram.name}.`,
      eventKey: `cooperative:welfare:claim:${claim.id}`,
      metadata: { claimId: claim.id, enrollmentId, workerId: worker.id },
    });

    return this.toClaim(claim);
  }

  async listProgramsForCooperative(actor: AuthenticatedUser, cooperativeId: string) {
    await this.authorization.assertCooperativeScope(actor, cooperativeId, 'admin');
    const programs = await this.prisma.welfareProgram.findMany({
      where: { cooperativeId },
      include: { enrollments: { include: { worker: { select: { id: true, fullName: true, userId: true } } } }, _count: { select: { enrollments: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return programs.map((program) => ({
      ...this.toProgram(program),
      enrollmentCount: program._count.enrollments,
      activeEnrollments: program.enrollments.filter((item) => item.status === WelfareEnrollmentStatus.ACTIVE).length,
      pendingEnrollments: program.enrollments.filter((item) => item.status === WelfareEnrollmentStatus.PENDING).length,
    }));
  }

  async getProgramForCooperative(actor: AuthenticatedUser, cooperativeId: string, programId: string) {
    await this.authorization.assertCooperativeScope(actor, cooperativeId, 'admin');
    const program = await this.prisma.welfareProgram.findFirst({
      where: { id: programId, cooperativeId },
      include: { enrollments: { include: { worker: { select: { id: true, fullName: true, userId: true } } } } },
    });
    if (!program) throw new NotFoundException('Welfare program is not available');
    return this.toProgram(program);
  }

  async createProgram(actor: AuthenticatedUser, cooperativeId: string, dto: CreateWelfareProgramDto) {
    await this.authorization.assertCooperativeScope(actor, cooperativeId, 'admin');
    const program = await this.prisma.welfareProgram.create({
      data: {
        cooperativeId,
        name: dto.name,
        description: dto.description,
        type: dto.type,
        providerName: dto.providerName,
        coverageAmount: dto.coverageAmount ?? null,
        premiumAmount: dto.premiumAmount ?? null,
        eligibilityConfig: (dto.eligibilityConfig ?? { minimumMembership: true }) as Prisma.InputJsonValue,
        status: WelfareProgramStatus.ACTIVE,
        startDate: new Date(dto.startDate),
        endDate: dto.endDate ? new Date(dto.endDate) : null,
      },
      include: { cooperative: { select: { id: true, name: true } } },
    });
    return this.toProgram(program);
  }

  async updateProgram(actor: AuthenticatedUser, cooperativeId: string, programId: string, dto: UpdateWelfareProgramDto) {
    await this.authorization.assertCooperativeScope(actor, cooperativeId, 'admin');
    const existing = await this.prisma.welfareProgram.findFirst({
      where: { id: programId, cooperativeId },
      select: { id: true, status: true },
    });
    if (!existing) throw new NotFoundException('Welfare program is not available');
    const program = await this.prisma.welfareProgram.update({
      where: { id: programId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.type !== undefined ? { type: dto.type } : {}),
        ...(dto.providerName !== undefined ? { providerName: dto.providerName } : {}),
        ...(dto.coverageAmount !== undefined ? { coverageAmount: dto.coverageAmount } : {}),
        ...(dto.premiumAmount !== undefined ? { premiumAmount: dto.premiumAmount } : {}),
        ...(dto.eligibilityConfig !== undefined ? { eligibilityConfig: dto.eligibilityConfig as Prisma.InputJsonValue } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.startDate !== undefined ? { startDate: new Date(dto.startDate) } : {}),
        ...(dto.endDate !== undefined ? { endDate: new Date(dto.endDate) } : {}),
      },
      include: { cooperative: { select: { id: true, name: true } } },
    });
    return this.toProgram(program);
  }

  async activateProgram(actor: AuthenticatedUser, cooperativeId: string, programId: string) {
    await this.authorization.assertCooperativeScope(actor, cooperativeId, 'admin');
    const program = await this.prisma.welfareProgram.findFirst({
      where: { id: programId, cooperativeId },
      select: { id: true, status: true, startDate: true, endDate: true },
    });
    if (!program) throw new NotFoundException('Welfare program is not available');
    if (program.status === WelfareProgramStatus.ACTIVE) throw new ConflictException('Program is already active');
    if (program.endDate && program.endDate < new Date()) throw new BadRequestException('This program has expired');
    const updated = await this.prisma.welfareProgram.update({
      where: { id: programId },
      data: { status: WelfareProgramStatus.ACTIVE },
      include: { cooperative: { select: { id: true, name: true } } },
    });
    return this.toProgram(updated);
  }

  async deactivateProgram(actor: AuthenticatedUser, cooperativeId: string, programId: string) {
    await this.authorization.assertCooperativeScope(actor, cooperativeId, 'admin');
    const program = await this.prisma.welfareProgram.findFirst({
      where: { id: programId, cooperativeId },
      select: { id: true, status: true },
    });
    if (!program) throw new NotFoundException('Welfare program is not available');
    if (program.status !== WelfareProgramStatus.ACTIVE) throw new ConflictException('Only active programs can be deactivated');
    const updated = await this.prisma.welfareProgram.update({
      where: { id: programId },
      data: { status: WelfareProgramStatus.INACTIVE },
      include: { cooperative: { select: { id: true, name: true } } },
    });
    return this.toProgram(updated);
  }

  async listEnrollmentsForCooperative(actor: AuthenticatedUser, cooperativeId: string) {
    await this.authorization.assertCooperativeScope(actor, cooperativeId, 'admin');
    const enrollments = await this.prisma.workerBenefitEnrollment.findMany({
      where: { welfareProgram: { cooperativeId } },
      include: { welfareProgram: { select: welfareProgramSelect }, worker: { select: { id: true, fullName: true, userId: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return enrollments.map((enrollment) => this.toEnrollment(enrollment));
  }

  async getEnrollmentForCooperative(actor: AuthenticatedUser, cooperativeId: string, enrollmentId: string) {
    await this.authorization.assertCooperativeScope(actor, cooperativeId, 'admin');
    const enrollment = await this.prisma.workerBenefitEnrollment.findFirst({
      where: { id: enrollmentId, welfareProgram: { cooperativeId } },
      include: { welfareProgram: { select: welfareProgramSelect }, worker: { select: { id: true, fullName: true, userId: true } } },
    });
    if (!enrollment) throw new NotFoundException('Welfare enrollment is not available');
    return this.toEnrollment(enrollment);
  }

  async reviewEnrollment(actor: AuthenticatedUser, cooperativeId: string, enrollmentId: string, dto: ReviewEnrollmentDto) {
    await this.authorization.assertCooperativeScope(actor, cooperativeId, 'admin');
    const enrollment = await this.prisma.workerBenefitEnrollment.findFirst({
      where: { id: enrollmentId, welfareProgram: { cooperativeId } },
      include: { welfareProgram: { select: welfareProgramSelect }, worker: { select: { id: true, fullName: true, userId: true } } },
    });
    if (!enrollment) throw new NotFoundException('Welfare enrollment is not available');
    if (enrollment.status === WelfareEnrollmentStatus.REJECTED || enrollment.status === WelfareEnrollmentStatus.CANCELLED || enrollment.status === WelfareEnrollmentStatus.EXPIRED) {
      throw new ConflictException('This enrollment cannot be updated');
    }
    if (dto.status === WelfareEnrollmentStatus.REJECTED && !dto.rejectionReason) {
      throw new BadRequestException('A rejection reason is required');
    }
    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.workerBenefitEnrollment.update({
        where: { id: enrollmentId },
        data: {
          status: dto.status,
          approvedAt: dto.status === WelfareEnrollmentStatus.ACTIVE ? new Date() : null,
          rejectedAt: dto.status === WelfareEnrollmentStatus.REJECTED ? new Date() : null,
          rejectionReason: dto.status === WelfareEnrollmentStatus.REJECTED ? dto.rejectionReason ?? null : null,
        },
        include: { welfareProgram: { select: welfareProgramSelect }, worker: { select: { id: true, fullName: true, userId: true } } },
      });
      await tx.notification.create({
        data: {
          recipientUserId: result.worker.userId,
          type: dto.status === WelfareEnrollmentStatus.ACTIVE ? 'WELFARE_ENROLLMENT_APPROVED' : 'WELFARE_ENROLLMENT_REJECTED',
          title: dto.status === WelfareEnrollmentStatus.ACTIVE ? 'Enrollment approved' : 'Enrollment update',
          message: dto.status === WelfareEnrollmentStatus.ACTIVE
            ? `Your enrollment in ${result.welfareProgram.name} has been approved.`
            : `Your enrollment in ${result.welfareProgram.name} was not approved. ${dto.rejectionReason ?? ''}`.trim(),
          eventKey: `welfare:enrollment:${dto.status.toLowerCase()}:${result.id}`,
          metadata: { enrollmentId: result.id, programId: result.welfareProgramId },
        },
      });
      return result;
    });
    return this.toEnrollment(updated);
  }

  async listClaimsForCooperative(actor: AuthenticatedUser, cooperativeId: string) {
    await this.authorization.assertCooperativeScope(actor, cooperativeId, 'admin');
    const claims = await this.prisma.welfareClaim.findMany({
      where: { enrollment: { welfareProgram: { cooperativeId } } },
      include: { enrollment: { select: { id: true, welfareProgram: { select: welfareProgramSelect }, worker: { select: { id: true, fullName: true, userId: true } } } }, worker: { select: { id: true, fullName: true, userId: true } } },
      orderBy: { submittedAt: 'desc' },
    });
    return claims.map((claim) => this.toClaim(claim));
  }

  async getClaimForCooperative(actor: AuthenticatedUser, cooperativeId: string, claimId: string) {
    await this.authorization.assertCooperativeScope(actor, cooperativeId, 'admin');
    const claim = await this.prisma.welfareClaim.findFirst({
      where: { id: claimId, enrollment: { welfareProgram: { cooperativeId } } },
      include: { enrollment: { select: { id: true, welfareProgram: { select: welfareProgramSelect }, worker: { select: { id: true, fullName: true, userId: true } } } }, worker: { select: { id: true, fullName: true, userId: true } } },
    });
    if (!claim) throw new NotFoundException('Welfare claim is not available');
    return this.toClaim(claim);
  }

  async reviewClaim(actor: AuthenticatedUser, cooperativeId: string, claimId: string, dto: ReviewClaimDto) {
    await this.authorization.assertCooperativeScope(actor, cooperativeId, 'admin');
    const claim = await this.prisma.welfareClaim.findFirst({
      where: { id: claimId, enrollment: { welfareProgram: { cooperativeId } } },
      include: { enrollment: { include: { welfareProgram: { select: welfareProgramSelect }, worker: { select: { id: true, fullName: true, userId: true } } } }, worker: { select: { id: true, fullName: true, userId: true } } },
    });
    if (!claim) throw new NotFoundException('Welfare claim is not available');
    if (claim.status === WelfareClaimStatus.APPROVED || claim.status === WelfareClaimStatus.REJECTED || claim.status === WelfareClaimStatus.PAID || claim.status === WelfareClaimStatus.CANCELLED) {
      throw new ConflictException('This claim has already been resolved');
    }
    if (dto.status === WelfareClaimStatus.REJECTED && !dto.decisionReason) {
      throw new BadRequestException('A rejection reason is required');
    }
    if (dto.status === WelfareClaimStatus.APPROVED || dto.status === WelfareClaimStatus.REJECTED) {
      const updated = await this.prisma.$transaction(async (tx) => {
        const result = await tx.welfareClaim.update({
          where: { id: claimId },
          data: {
            status: dto.status,
            reviewedAt: new Date(),
            decisionReason: dto.decisionReason ?? null,
          },
          include: { enrollment: { include: { welfareProgram: { select: welfareProgramSelect }, worker: { select: { id: true, fullName: true, userId: true } } } }, worker: { select: { id: true, fullName: true, userId: true } } },
        });
        await tx.notification.create({
          data: {
            recipientUserId: result.worker.userId,
            type: dto.status === WelfareClaimStatus.APPROVED ? NotificationType.WELFARE_CLAIM_APPROVED : NotificationType.WELFARE_CLAIM_REJECTED,
            title: dto.status === WelfareClaimStatus.APPROVED ? 'Claim approved' : 'Claim rejected',
            message: dto.status === WelfareClaimStatus.APPROVED
              ? `Your claim for ${result.enrollment.welfareProgram.name} has been approved.`
              : `Your claim for ${result.enrollment.welfareProgram.name} was rejected. ${dto.decisionReason ?? ''}`.trim(),
            eventKey: `welfare:claim:${dto.status.toLowerCase()}:${result.id}`,
            metadata: { claimId: result.id, enrollmentId: result.enrollmentId },
          },
        });
        return result;
      });
      return this.toClaim(updated);
    }

    if (dto.status === WelfareClaimStatus.PAID) {
      const updated = await this.prisma.$transaction(async (tx) => {
        const existing = await tx.welfareClaim.findUnique({ where: { id: claimId }, select: { status: true, workerId: true, enrollmentId: true } });
        if (!existing || existing.status !== WelfareClaimStatus.APPROVED) {
          throw new ConflictException('Claims can only be marked as paid after approval');
        }
        const result = await tx.welfareClaim.update({
          where: { id: claimId },
          data: {
            status: WelfareClaimStatus.PAID,
            paidAt: new Date(),
          },
          include: { enrollment: { include: { welfareProgram: { select: welfareProgramSelect }, worker: { select: { id: true, fullName: true, userId: true } } } }, worker: { select: { id: true, fullName: true, userId: true } } },
        });
        await tx.notification.create({
          data: {
            recipientUserId: result.worker.userId,
            type: NotificationType.WELFARE_CLAIM_PAID,
            title: 'Claim paid',
            message: `A payment for your ${result.enrollment.welfareProgram.name} claim has been processed.`,
            eventKey: `welfare:claim:paid:${result.id}`,
            metadata: { claimId: result.id, enrollmentId: result.enrollmentId },
          },
        });
        return result;
      });
      return this.toClaim(updated);
    }

    if (dto.status === WelfareClaimStatus.UNDER_REVIEW) {
      const updated = await this.prisma.welfareClaim.update({
        where: { id: claimId },
        data: { status: WelfareClaimStatus.UNDER_REVIEW, reviewedAt: new Date() },
        include: { enrollment: { include: { welfareProgram: { select: welfareProgramSelect }, worker: { select: { id: true, fullName: true, userId: true } } } }, worker: { select: { id: true, fullName: true, userId: true } } },
      });
      await this.notificationsService.createNotification({
        recipientUserId: updated.worker.userId,
        type: 'WELFARE_CLAIM_IN_REVIEW',
        title: 'Claim under review',
        message: `Your claim for ${updated.enrollment.welfareProgram.name} is now being reviewed.`,
        eventKey: `welfare:claim:review:${updated.id}`,
        metadata: { claimId: updated.id, enrollmentId: updated.enrollmentId },
      });
      return this.toClaim(updated);
    }

    throw new BadRequestException('Unsupported claim status transition');
  }

  async getCooperativeWelfareStats(actor: AuthenticatedUser, cooperativeId: string) {
    await this.authorization.assertCooperativeScope(actor, cooperativeId, 'admin');
    const [programCount, activePrograms, enrolledWorkers, pendingEnrollments, openClaims] = await Promise.all([
      this.prisma.welfareProgram.count({ where: { cooperativeId } }),
      this.prisma.welfareProgram.count({ where: { cooperativeId, status: WelfareProgramStatus.ACTIVE } }),
      this.prisma.workerBenefitEnrollment.count({ where: { welfareProgram: { cooperativeId }, status: WelfareEnrollmentStatus.ACTIVE } }),
      this.prisma.workerBenefitEnrollment.count({ where: { welfareProgram: { cooperativeId }, status: WelfareEnrollmentStatus.PENDING } }),
      this.prisma.welfareClaim.count({ where: { enrollment: { welfareProgram: { cooperativeId } }, status: { in: [WelfareClaimStatus.SUBMITTED, WelfareClaimStatus.UNDER_REVIEW] } } }),
    ]);
    return {
      programCount,
      activePrograms,
      enrolledWorkers,
      pendingEnrollments,
      openClaims,
    };
  }

  private async evaluateEligibility(
    workerId: string,
    program: {
      id: string;
      cooperativeId: string;
      status: WelfareProgramStatus;
      startDate: Date;
      endDate?: Date | null;
      eligibilityConfig?: Prisma.JsonValue | null;
    },
  ) {
    const reasons: string[] = [];
    const membership = await this.prisma.cooperativeMembership.findFirst({
      where: { workerId, cooperativeId: program.cooperativeId, leftAt: null },
      select: { id: true },
    });
    if (!membership) {
      reasons.push('Worker does not have an active cooperative membership');
      return { eligible: false, reasons };
    }
    reasons.push('Active cooperative membership');

    const worker = await this.prisma.worker.findUnique({
      where: { id: workerId },
      select: { availability: true, yearsExperience: true, user: { select: { isActive: true } } },
    });
    if (!worker?.user.isActive) {
      reasons.push('Worker account is inactive');
      return { eligible: false, reasons };
    }
    reasons.push('Worker account is active');

    if (program.status !== WelfareProgramStatus.ACTIVE) {
      reasons.push('Program is not active');
      return { eligible: false, reasons };
    }
    reasons.push('Program is currently available');

    if (program.startDate > new Date()) {
      reasons.push('Program start date is in the future');
      return { eligible: false, reasons };
    }
    if (program.endDate && program.endDate < new Date()) {
      reasons.push('Program is expired');
      return { eligible: false, reasons };
    }

    const config = (program.eligibilityConfig ?? {}) as Record<string, unknown>;
    if (config.minimumYearsExperience && Number(config.minimumYearsExperience) > (worker.yearsExperience ?? 0)) {
      reasons.push(`Worker has less than ${config.minimumYearsExperience} years of experience`);
      return { eligible: false, reasons };
    }
    if (config.requireActiveMembership === false) {
      reasons.push('Program requires active cooperative membership');
      return { eligible: false, reasons };
    }

    const existing = await this.prisma.workerBenefitEnrollment.findFirst({
      where: {
        workerId,
        welfareProgramId: program.id,
        status: { in: [WelfareEnrollmentStatus.PENDING, WelfareEnrollmentStatus.ACTIVE] },
      },
      select: { id: true, status: true },
    });
    if (existing) {
      reasons.push(existing.status === WelfareEnrollmentStatus.ACTIVE ? 'Worker is already enrolled in this benefit' : 'Worker already has a pending enrollment for this benefit');
      return { eligible: false, reasons };
    }

    return { eligible: true, reasons };
  }

  private async getCooperativeAdminUserId(cooperativeId: string) {
    const cooperative = await this.prisma.cooperative.findUnique({
      where: { id: cooperativeId },
      select: { adminUserId: true },
    });
    if (!cooperative?.adminUserId) {
      throw new NotFoundException('Cooperative administrator is not available');
    }
    return cooperative.adminUserId;
  }

  private toProgram(program: any) {
    return {
      id: program.id,
      cooperativeId: program.cooperativeId,
      cooperative: program.cooperative ? { id: program.cooperative.id, name: program.cooperative.name } : null,
      name: program.name,
      description: program.description,
      type: program.type,
      providerName: program.providerName,
      coverageAmount: program.coverageAmount,
      premiumAmount: program.premiumAmount,
      eligibilityConfig: program.eligibilityConfig,
      status: program.status,
      startDate: program.startDate,
      endDate: program.endDate,
      createdAt: program.createdAt,
      updatedAt: program.updatedAt,
    };
  }

  private toEnrollment(enrollment: any) {
    return {
      id: enrollment.id,
      welfareProgramId: enrollment.welfareProgramId,
      workerId: enrollment.workerId,
      status: enrollment.status,
      enrolledAt: enrollment.enrolledAt,
      approvedAt: enrollment.approvedAt,
      rejectedAt: enrollment.rejectedAt,
      rejectionReason: enrollment.rejectionReason,
      cancellationReason: enrollment.cancellationReason,
      createdAt: enrollment.createdAt,
      updatedAt: enrollment.updatedAt,
      welfareProgram: enrollment.welfareProgram ? this.toProgram(enrollment.welfareProgram) : null,
      worker: enrollment.worker ? { id: enrollment.worker.id, fullName: enrollment.worker.fullName, userId: enrollment.worker.userId } : null,
      claims: Array.isArray(enrollment.claims) ? enrollment.claims.map((claim: any) => this.toClaim(claim)) : undefined,
    };
  }

  private toClaim(claim: any) {
    return {
      id: claim.id,
      enrollmentId: claim.enrollmentId,
      workerId: claim.workerId,
      type: claim.type,
      description: claim.description,
      amountRequested: claim.amountRequested,
      status: claim.status,
      submittedAt: claim.submittedAt,
      reviewedAt: claim.reviewedAt,
      decisionReason: claim.decisionReason,
      evidenceMeta: claim.evidenceMeta,
      paidAt: claim.paidAt,
      createdAt: claim.createdAt,
      updatedAt: claim.updatedAt,
      enrollment: claim.enrollment ? this.toEnrollment(claim.enrollment) : null,
      worker: claim.worker ? { id: claim.worker.id, fullName: claim.worker.fullName, userId: claim.worker.userId } : null,
    };
  }
}
