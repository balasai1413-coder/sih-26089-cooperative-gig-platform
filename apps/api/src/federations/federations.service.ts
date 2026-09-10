import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  BookingStatus,
  FederationMembershipStatus,
  FederationStatus,
  Prisma,
  ServiceRequestStatus,
  SkillVerificationStatus,
  WelfareClaimStatus,
  WelfareEnrollmentStatus,
  WelfareProgramStatus,
} from '@prisma/client';
import { AuthenticatedUser } from '../auth/auth.types';
import { PrismaService } from '../database/prisma.service';
import { DemandForecastingService } from '../demand-forecasting/demand-forecasting.service';
import { CreateFederationDto } from './dto/create-federation.dto';
import { UpdateFederationDto } from './dto/update-federation.dto';

const activeMembershipWhere = { status: FederationMembershipStatus.ACTIVE } as const;
const cancelledStatuses = [BookingStatus.CANCELLED, BookingStatus.REJECTED] as const;
const isCancelled = (status: BookingStatus) =>
  status === BookingStatus.CANCELLED || status === BookingStatus.REJECTED;

@Injectable()
export class FederationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly demandForecasting: DemandForecastingService,
  ) {}

  async create(actor: AuthenticatedUser, dto: CreateFederationDto) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const federation = await tx.federation.create({
          data: {
            name: dto.name,
            code: dto.code,
            description: dto.description ?? null,
            administrators: { create: { userId: actor.id } },
          },
        });
        return this.toFederation(federation);
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('A federation with this code already exists');
      }
      throw error;
    }
  }

  async listMine(actor: AuthenticatedUser) {
    const federations = await this.prisma.federation.findMany({
      where: { administrators: { some: { userId: actor.id } } },
      include: { _count: { select: { memberships: { where: activeMembershipWhere } } } },
      orderBy: { createdAt: 'asc' },
    });
    return federations.map((federation) => ({
      ...this.toFederation(federation),
      activeCooperativeCount: federation._count.memberships,
    }));
  }

  async get(actor: AuthenticatedUser, federationId: string) {
    await this.assertAdministrator(actor, federationId);
    const federation = await this.prisma.federation.findUnique({ where: { id: federationId } });
    if (!federation) throw new NotFoundException('Federation is not available');
    return { ...this.toFederation(federation), ...(await this.getOverview(federationId)) };
  }

  async update(actor: AuthenticatedUser, federationId: string, dto: UpdateFederationDto) {
    await this.assertAdministrator(actor, federationId);
    try {
      const federation = await this.prisma.federation.update({
        where: { id: federationId },
        data: {
          ...(dto.name !== undefined ? { name: dto.name } : {}),
          ...(dto.description !== undefined ? { description: dto.description } : {}),
          ...(dto.status !== undefined ? { status: dto.status } : {}),
        },
      });
      return this.toFederation(federation);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new NotFoundException('Federation is not available');
      }
      throw error;
    }
  }

  async listCooperatives(actor: AuthenticatedUser, federationId: string) {
    await this.assertAdministrator(actor, federationId);
    const memberships = await this.prisma.federationMembership.findMany({
      where: { federationId, status: { not: FederationMembershipStatus.LEFT } },
      include: {
        cooperative: {
          select: { id: true, name: true, registrationNo: true, location: true, status: true },
        },
      },
      orderBy: { cooperative: { name: 'asc' } },
    });
    return Promise.all(
      memberships.map(async (membership) => ({
        id: membership.cooperative.id,
        name: membership.cooperative.name,
        registrationNo: membership.cooperative.registrationNo,
        location: membership.cooperative.location,
        cooperativeStatus: membership.cooperative.status,
        membershipStatus: membership.status,
        joinedAt: membership.joinedAt,
        ...(await this.cooperativeMetrics(membership.cooperative.id)),
      })),
    );
  }

  async addCooperative(actor: AuthenticatedUser, federationId: string, cooperativeId: string) {
    await this.assertAdministrator(actor, federationId);
    const cooperative = await this.prisma.cooperative.findUnique({
      where: { id: cooperativeId },
      select: { id: true },
    });
    if (!cooperative) throw new NotFoundException('Cooperative is not available');
    try {
      return await this.prisma.federationMembership.create({
        data: { federationId, cooperativeId, status: FederationMembershipStatus.PENDING },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Cooperative already belongs to a federation');
      }
      throw error;
    }
  }

  async updateMembership(
    actor: AuthenticatedUser,
    federationId: string,
    cooperativeId: string,
    status: FederationMembershipStatus,
  ) {
    await this.assertAdministrator(actor, federationId);
    const membership = await this.prisma.federationMembership.findFirst({
      where: { federationId, cooperativeId },
    });
    if (!membership) throw new NotFoundException('Federation membership is not available');
    return this.prisma.federationMembership.update({
      where: { id: membership.id },
      data: {
        status,
        joinedAt:
          status === FederationMembershipStatus.ACTIVE
            ? (membership.joinedAt ?? new Date())
            : membership.joinedAt,
        leftAt: status === FederationMembershipStatus.LEFT ? new Date() : null,
      },
    });
  }

  async workforce(actor: AuthenticatedUser, federationId: string) {
    await this.assertAdministrator(actor, federationId);
    const cooperativeIds = await this.activeCooperativeIds(federationId);
    const memberships = await this.prisma.cooperativeMembership.findMany({
      where: { cooperativeId: { in: cooperativeIds }, leftAt: null },
      select: {
        workerId: true,
        worker: {
          select: {
            availability: true,
            user: { select: { isActive: true } },
            skills: {
              where: { verificationStatus: SkillVerificationStatus.VERIFIED },
              select: {
                skill: { select: { id: true, name: true, category: { select: { name: true } } } },
              },
            },
          },
        },
      },
    });
    const uniqueWorkers = new Map(
      memberships.map((membership) => [membership.workerId, membership]),
    );
    const skills = new Map<
      string,
      { id: string; name: string; category: string | null; workers: Set<string> }
    >();
    for (const membership of memberships)
      for (const workerSkill of membership.worker.skills) {
        const skill = workerSkill.skill;
        const current = skills.get(skill.id) ?? {
          id: skill.id,
          name: skill.name,
          category: skill.category?.name ?? null,
          workers: new Set<string>(),
        };
        current.workers.add(membership.workerId);
        skills.set(skill.id, current);
      }
    return {
      totalActiveWorkers: uniqueWorkers.size,
      totalVerifiedWorkers: [...uniqueWorkers.values()].filter(
        (membership) => membership.worker.skills.length > 0,
      ).length,
      availableWorkers: [...uniqueWorkers.values()].filter(
        (membership) =>
          membership.worker.availability === 'AVAILABLE' && membership.worker.user.isActive,
      ).length,
      priorityCapacity: [...uniqueWorkers.values()].filter(
        (membership) =>
          membership.worker.availability !== 'UNAVAILABLE' && membership.worker.user.isActive,
      ).length,
      bySkill: [...skills.values()]
        .map((skill) => ({
          id: skill.id,
          name: skill.name,
          category: skill.category,
          verifiedWorkers: skill.workers.size,
        }))
        .sort((a, b) => b.verifiedWorkers - a.verifiedWorkers),
    };
  }

  async demand(actor: AuthenticatedUser, federationId: string) {
    await this.assertAdministrator(actor, federationId);
    const cooperativeIds = await this.activeCooperativeIds(federationId);
    const bookings = await this.prisma.booking.findMany({
      where: { cooperativeId: { in: cooperativeIds } },
      select: {
        status: true,
        serviceRequest: { select: { status: true, skill: { select: { id: true, name: true } } } },
      },
    });
    const bySkill = new Map<
      string,
      { id: string; name: string; currentDemand: number; openDemand: number }
    >();
    for (const booking of bookings) {
      if (!booking.serviceRequest.skill || isCancelled(booking.status)) continue;
      const skill = booking.serviceRequest.skill;
      const current = bySkill.get(skill.id) ?? {
        id: skill.id,
        name: skill.name,
        currentDemand: 0,
        openDemand: 0,
      };
      current.currentDemand += 1;
      if (booking.serviceRequest.status === ServiceRequestStatus.OPEN) current.openDemand += 1;
      bySkill.set(skill.id, current);
    }
    const forecasts = await Promise.all(
      cooperativeIds.map((cooperativeId) => this.demandForecasting.getForecast(cooperativeId, {})),
    );
    return {
      currentDemand: bookings.filter((booking) => !isCancelled(booking.status)).length,
      openDemand: bookings.filter(
        (booking) =>
          booking.serviceRequest.status === ServiceRequestStatus.OPEN &&
          !isCancelled(booking.status),
      ).length,
      forecastDemand: forecasts.reduce(
        (total, forecast) => total + (forecast.overview.predictedDemand ?? 0),
        0,
      ),
      forecastsByCooperative: forecasts,
      bySkill: [...bySkill.values()].sort((a, b) => b.currentDemand - a.currentDemand),
    };
  }

  async welfare(actor: AuthenticatedUser, federationId: string) {
    await this.assertAdministrator(actor, federationId);
    const cooperativeIds = await this.activeCooperativeIds(federationId);
    const memberships = await this.prisma.cooperativeMembership.findMany({
      where: { cooperativeId: { in: cooperativeIds }, leftAt: null },
      select: { workerId: true },
    });
    const workerIds = [...new Set(memberships.map((membership) => membership.workerId))];
    const [
      eligibleWorkers,
      enrolledWorkers,
      activeBenefits,
      pendingEnrollments,
      submittedClaims,
      approvedClaims,
      rejectedClaims,
    ] = await Promise.all([
      this.prisma.worker.count({
        where: {
          id: { in: workerIds },
          welfareEnrollments: {
            some: { welfareProgram: { cooperativeId: { in: cooperativeIds } } },
          },
        },
      }),
      this.prisma.workerBenefitEnrollment.count({
        where: { workerId: { in: workerIds }, status: WelfareEnrollmentStatus.ACTIVE },
      }),
      this.prisma.welfareProgram.count({
        where: { cooperativeId: { in: cooperativeIds }, status: WelfareProgramStatus.ACTIVE },
      }),
      this.prisma.workerBenefitEnrollment.count({
        where: { workerId: { in: workerIds }, status: WelfareEnrollmentStatus.PENDING },
      }),
      this.prisma.welfareClaim.count({
        where: {
          workerId: { in: workerIds },
          status: { in: [WelfareClaimStatus.SUBMITTED, WelfareClaimStatus.UNDER_REVIEW] },
        },
      }),
      this.prisma.welfareClaim.count({
        where: {
          workerId: { in: workerIds },
          status: { in: [WelfareClaimStatus.APPROVED, WelfareClaimStatus.PAID] },
        },
      }),
      this.prisma.welfareClaim.count({
        where: { workerId: { in: workerIds }, status: WelfareClaimStatus.REJECTED },
      }),
    ]);
    return {
      eligibleWorkers,
      enrolledWorkers,
      activeBenefits,
      pendingEnrollments,
      submittedClaims,
      approvedClaims,
      rejectedClaims,
      participationRate: eligibleWorkers
        ? Number(((enrolledWorkers / eligibleWorkers) * 100).toFixed(1))
        : 0,
    };
  }

  async performance(actor: AuthenticatedUser, federationId: string) {
    await this.assertAdministrator(actor, federationId);
    return Promise.all(
      (await this.activeCooperativeIds(federationId)).map(async (cooperativeId) => ({
        cooperativeId,
        ...(await this.cooperativeMetrics(cooperativeId)),
      })),
    );
  }

  private async getOverview(federationId: string) {
    const activeCooperatives = await this.prisma.federationMembership.count({
      where: { federationId, ...activeMembershipWhere },
    });
    const [workforce, demand, welfare] = await Promise.all([
      this.workforceSummary(federationId),
      this.demandSummary(federationId),
      this.welfareSummary(federationId),
    ]);
    return {
      activeCooperatives,
      ...workforce,
      ...demand,
      welfareParticipation: welfare.participationRate,
    };
  }

  private async cooperativeMetrics(cooperativeId: string) {
    const [
      activeWorkers,
      verifiedWorkers,
      activeBookings,
      completedBookings,
      cancelledBookings,
      serviceRequests,
      ratings,
      welfareEnrolledWorkers,
    ] = await Promise.all([
      this.prisma.cooperativeMembership.count({ where: { cooperativeId, leftAt: null } }),
      this.prisma.cooperativeMembership.count({
        where: {
          cooperativeId,
          leftAt: null,
          worker: { skills: { some: { verificationStatus: SkillVerificationStatus.VERIFIED } } },
        },
      }),
      this.prisma.booking.count({
        where: {
          cooperativeId,
          status: { notIn: [...cancelledStatuses, BookingStatus.COMPLETED] },
        },
      }),
      this.prisma.booking.count({ where: { cooperativeId, status: BookingStatus.COMPLETED } }),
      this.prisma.booking.count({
        where: { cooperativeId, status: { in: [...cancelledStatuses] } },
      }),
      this.prisma.booking.count({ where: { cooperativeId } }),
      this.prisma.review.aggregate({
        where: { booking: { cooperativeId } },
        _avg: { rating: true },
      }),
      this.prisma.workerBenefitEnrollment.count({
        where: { welfareProgram: { cooperativeId }, status: WelfareEnrollmentStatus.ACTIVE },
      }),
    ]);
    return {
      activeWorkers,
      verifiedWorkers,
      activeBookings,
      completedBookings,
      cancelledBookings,
      serviceRequests,
      averageRating: ratings._avg.rating ?? null,
      welfareEnrolledWorkers,
    };
  }

  private async activeCooperativeIds(federationId: string) {
    const rows = await this.prisma.federationMembership.findMany({
      where: { federationId, ...activeMembershipWhere },
      select: { cooperativeId: true },
    });
    return rows.map((row) => row.cooperativeId);
  }

  private async workforceSummary(federationId: string) {
    const ids = await this.activeCooperativeIds(federationId);
    const rows = await this.prisma.cooperativeMembership.findMany({
      where: { cooperativeId: { in: ids }, leftAt: null },
      select: {
        workerId: true,
        worker: {
          select: {
            skills: {
              where: { verificationStatus: SkillVerificationStatus.VERIFIED },
              select: { id: true },
            },
          },
        },
      },
    });
    const unique = new Map(rows.map((row) => [row.workerId, row]));
    return {
      activeWorkers: unique.size,
      verifiedWorkers: [...unique.values()].filter((row) => row.worker.skills.length > 0).length,
    };
  }

  private async demandSummary(federationId: string) {
    const ids = await this.activeCooperativeIds(federationId);
    const openDemand = await this.prisma.booking.count({
      where: {
        cooperativeId: { in: ids },
        status: { notIn: [...cancelledStatuses, BookingStatus.COMPLETED] },
        serviceRequest: { status: ServiceRequestStatus.OPEN },
      },
    });
    return { openDemand };
  }

  private async welfareSummary(federationId: string) {
    const ids = await this.activeCooperativeIds(federationId);
    const [eligibleWorkers, enrolledWorkers] = await Promise.all([
      this.prisma.cooperativeMembership.count({
        where: { cooperativeId: { in: ids }, leftAt: null },
      }),
      this.prisma.workerBenefitEnrollment.count({
        where: {
          welfareProgram: { cooperativeId: { in: ids } },
          status: WelfareEnrollmentStatus.ACTIVE,
        },
      }),
    ]);
    return {
      participationRate: eligibleWorkers
        ? Number(((enrolledWorkers / eligibleWorkers) * 100).toFixed(1))
        : 0,
    };
  }

  private async assertAdministrator(actor: AuthenticatedUser, federationId: string) {
    const administrator = await this.prisma.federationAdministrator.findFirst({
      where: { federationId, userId: actor.id },
      select: { id: true },
    });
    if (!administrator)
      throw new ForbiddenException('You do not have permission to access this federation');
  }

  private toFederation(federation: {
    id: string;
    name: string;
    code: string;
    description: string | null;
    status: FederationStatus;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: federation.id,
      name: federation.name,
      code: federation.code,
      description: federation.description,
      status: federation.status,
      createdAt: federation.createdAt,
      updatedAt: federation.updatedAt,
    };
  }
}
