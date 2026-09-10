import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, SkillVerificationStatus } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { AuthenticatedUser } from '../auth/auth.types';
import { DemandForecastingService } from '../demand-forecasting/demand-forecasting.service';
import { HistoricalDemandService } from '../demand-forecasting/historical-demand.service';
import { UpdateCooperativeDto } from './dto/update-cooperative.dto';

const cooperativeInclude = {
  admin: { select: { id: true, email: true } },
  _count: { select: { memberships: { where: { leftAt: null } } } },
} satisfies Prisma.CooperativeInclude;

const memberInclude = {
  worker: {
    select: {
      id: true,
      fullName: true,
      location: true,
      yearsExperience: true,
      availability: true,
      userId: true,
      skills: {
        select: {
          id: true,
          proficiency: true,
          experienceYears: true,
          experienceSummary: true,
          verificationStatus: true,
          skill: { select: { id: true, name: true, category: { select: { name: true } } } },
        },
      },
      memberships: {
        select: { cooperativeId: true, role: true, joinedAt: true, leftAt: true },
      },
      user: { select: { id: true, email: true, isActive: true } },
    },
  },
} satisfies Prisma.CooperativeMembershipInclude;

/**
 * Cooperative admin surface. Every query resolves the cooperative through the
 * persisted `adminUserId` relationship; a cooperativeId supplied by a client is
 * never trusted. Membership state follows the existing `leftAt` semantics:
 * an open membership (leftAt null) is active, a closed one is historical.
 */
const DAY_MS = 24 * 60 * 60 * 1000;

function startOfUtcDay(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

function addUtcDays(value: Date, days: number): Date {
  return new Date(value.getTime() + days * DAY_MS);
}

@Injectable()
export class CooperativesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly historicalDemand: HistoricalDemandService,
    private readonly demandForecasting: DemandForecastingService,
  ) {}

  /** All cooperatives administered by this user, with counts and stats. */
  async listMine(actor: AuthenticatedUser) {
    const cooperatives = await this.prisma.cooperative.findMany({
      where: { adminUserId: actor.id },
      include: {
        ...cooperativeInclude,
        memberships: {
          where: { leftAt: null },
          select: {
            worker: {
              select: {
                skills: { select: { verificationStatus: true } },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
    return cooperatives.map((cooperative) => this.toSummary(cooperative));
  }

  async getMine(actor: AuthenticatedUser, cooperativeId: string) {
    const cooperative = await this.prisma.cooperative.findFirst({
      where: { id: cooperativeId, adminUserId: actor.id },
      include: cooperativeInclude,
    });
    if (!cooperative) throw new NotFoundException('Cooperative is not available');
    return this.toDetail(cooperative);
  }

  async updateMine(actor: AuthenticatedUser, cooperativeId: string, dto: UpdateCooperativeDto) {
    const existing = await this.prisma.cooperative.findFirst({
      where: { id: cooperativeId, adminUserId: actor.id },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException('Cooperative is not available');
    const cooperative = await this.prisma.cooperative.update({
      where: { id: cooperativeId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.location !== undefined ? { location: dto.location } : {}),
        ...(dto.operatingArea !== undefined ? { operatingArea: dto.operatingArea } : {}),
        ...(dto.contactEmail !== undefined ? { contactEmail: dto.contactEmail } : {}),
        ...(dto.contactPhone !== undefined ? { contactPhone: dto.contactPhone } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
      },
      include: cooperativeInclude,
    });
    return this.toDetail(cooperative);
  }

  async listMembers(
    actor: AuthenticatedUser,
    cooperativeId: string,
    query: { search?: string; status?: 'active' | 'former' },
  ) {
    await this.assertAdminOf(actor, cooperativeId);
    const memberships = await this.prisma.cooperativeMembership.findMany({
      where: {
        cooperativeId,
        ...(query.status === 'former' ? { leftAt: { not: null } } : { leftAt: null }),
      },
      include: memberInclude,
      orderBy: { joinedAt: 'desc' },
    });
    const search = query.search?.trim().toLowerCase();
    const rows = memberships
      .map((membership) => this.toMember(membership))
      .filter((member) => {
        if (!search) return true;
        const haystack = [member.fullName, member.location, member.email]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return haystack.includes(search);
      });
    return rows;
  }

  async getMember(actor: AuthenticatedUser, cooperativeId: string, workerId: string) {
    await this.assertAdminOf(actor, cooperativeId);
    const membership = await this.prisma.cooperativeMembership.findFirst({
      where: { cooperativeId, workerId },
      include: memberInclude,
      orderBy: { joinedAt: 'desc' },
    });
    // A missing membership means the worker is not part of this cooperative.
    // Return 403 rather than 404 so cross-cooperative probing is not rewarded
    // with existence information.
    if (!membership)
      throw new ForbiddenException('You do not have permission to access this resource');
    return this.toMember(membership, { detailed: true });
  }

  async getMyDemandOverview(actor: AuthenticatedUser, days = 30) {
    const cooperativeId = await this.getMyCooperativeId(actor);
    return this.getDemandOverview(actor, cooperativeId, days);
  }

  async getMyDemandBySkill(actor: AuthenticatedUser, days = 30) {
    const cooperativeId = await this.getMyCooperativeId(actor);
    return this.getDemandBySkill(actor, cooperativeId, days);
  }

  async getMyDemandTrends(actor: AuthenticatedUser, days = 30) {
    const cooperativeId = await this.getMyCooperativeId(actor);
    return this.getDemandTrends(actor, cooperativeId, days);
  }

  async getMyDemandForecast(actor: AuthenticatedUser, days = 30) {
    const cooperativeId = await this.getMyCooperativeId(actor);
    return this.getDemandForecast(actor, cooperativeId, days);
  }

  async getMyDemandCapacity(actor: AuthenticatedUser, days = 30) {
    const cooperativeId = await this.getMyCooperativeId(actor);
    return this.getDemandCapacity(actor, cooperativeId, days);
  }

  async getMyDemandRecommendations(actor: AuthenticatedUser, days = 30) {
    const cooperativeId = await this.getMyCooperativeId(actor);
    return this.getDemandRecommendations(actor, cooperativeId, days);
  }

  async getDemandOverview(actor: AuthenticatedUser, cooperativeId: string, days = 30) {
    await this.assertAdminOf(actor, cooperativeId);
    const snapshot = await this.buildDemandSnapshot(cooperativeId, days);
    return {
      cooperativeId,
      periodDays: days,
      generatedAt: new Date().toISOString(),
      status: snapshot.forecast.status,
      dataStatus: snapshot.forecast.overview.status,
      totalHistoricalDemand: snapshot.records.length,
      forecastDemand: snapshot.forecast.overview.predictedDemand ?? 0,
      averageDailyDemand: snapshot.records.length / Math.max(1, days),
      trend: snapshot.forecast.overview.trend ?? 'STABLE',
      highDemandSkills: snapshot.forecast.highDemandSkills.slice(0, 5).map((skill) => ({
        skillId: skill.dimensions.skill?.id ?? '',
        skillName: skill.dimensions.skill?.name ?? 'Unknown',
        predictedDemand: skill.predictedDemand ?? 0,
        historicalDemand: this.countRecordsBySkill(snapshot.records, skill.dimensions.skill?.id ?? ''),
        trend: skill.trend ?? 'STABLE',
        availableQualifiedWorkers:
          snapshot.capacity.bySkill.find((item) => item.skillId === skill.dimensions.skill?.id)?.verifiedWorkers ?? 0,
      })),
      availableQualifiedWorkers: snapshot.capacity.totalVerifiedWorkers,
      capacityStatus: snapshot.capacity.totalVerifiedWorkers > 0 ? 'SUFFICIENT' : 'INSUFFICIENT',
    };
  }

  async getDemandBySkill(actor: AuthenticatedUser, cooperativeId: string, days = 30) {
    await this.assertAdminOf(actor, cooperativeId);
    const snapshot = await this.buildDemandSnapshot(cooperativeId, days);
    const groups = new Map<string, { skillId: string; skillName: string; historicalDemand: number; forecastDemand: number; trend: string; availableQualifiedWorkers: number; capacityStatus: 'SHORTAGE' | 'SUFFICIENT' }>();

    for (const record of snapshot.records) {
      if (!record.skill) continue;
      const existing = groups.get(record.skill.id) ?? {
        skillId: record.skill.id,
        skillName: record.skill.name,
        historicalDemand: 0,
        forecastDemand: 0,
        trend: 'STABLE',
        availableQualifiedWorkers: 0,
        capacityStatus: 'SUFFICIENT' as const,
      };
      existing.historicalDemand += 1;
      groups.set(record.skill.id, existing);
    }

    for (const skill of snapshot.forecast.highDemandSkills) {
      if (!skill.dimensions.skill) continue;
      const existing = groups.get(skill.dimensions.skill.id) ?? {
        skillId: skill.dimensions.skill.id,
        skillName: skill.dimensions.skill.name,
        historicalDemand: 0,
        forecastDemand: 0,
        trend: 'STABLE',
        availableQualifiedWorkers: 0,
        capacityStatus: 'SUFFICIENT' as const,
      };
      existing.forecastDemand = skill.predictedDemand ?? 0;
      existing.trend = skill.trend ?? 'STABLE';
      groups.set(skill.dimensions.skill.id, existing);
    }

    for (const capacity of snapshot.capacity.bySkill) {
      const existing = groups.get(capacity.skillId) ?? {
        skillId: capacity.skillId,
        skillName: capacity.skillName,
        historicalDemand: 0,
        forecastDemand: 0,
        trend: 'STABLE',
        availableQualifiedWorkers: 0,
        capacityStatus: 'SUFFICIENT' as const,
      };
      existing.availableQualifiedWorkers = capacity.verifiedWorkers;
      existing.capacityStatus = capacity.verifiedWorkers > 0 ? 'SUFFICIENT' : 'SHORTAGE';
      groups.set(capacity.skillId, existing);
    }

    return Array.from(groups.values()).map((row) => ({
      ...row,
      capacityStatus: row.availableQualifiedWorkers > 0 ? 'SUFFICIENT' : 'SHORTAGE',
    }));
  }

  async getDemandTrends(actor: AuthenticatedUser, cooperativeId: string, days = 30) {
    await this.assertAdminOf(actor, cooperativeId);
    const snapshot = await this.buildDemandSnapshot(cooperativeId, days);
    const trendMap = new Map<string, number>();
    const start = startOfUtcDay(new Date());
    for (let index = 0; index < days; index += 1) {
      const day = addUtcDays(start, -(days - 1) + index);
      trendMap.set(day.toISOString().slice(0, 10), 0);
    }
    for (const record of snapshot.records) {
      const key = startOfUtcDay(record.occurredAt).toISOString().slice(0, 10);
      trendMap.set(key, (trendMap.get(key) ?? 0) + 1);
    }
    return {
      cooperativeId,
      periodDays: days,
      generatedAt: new Date().toISOString(),
      dataPoints: Array.from(trendMap.entries()).map(([date, demand]) => ({
        date,
        demand,
      })),
    };
  }

  async getDemandForecast(actor: AuthenticatedUser, cooperativeId: string, days = 30) {
    await this.assertAdminOf(actor, cooperativeId);
    const forecastStart = startOfUtcDay(addUtcDays(new Date(), 1));
    const forecastEnd = startOfUtcDay(addUtcDays(forecastStart, Math.max(6, days - 1)));
    return this.demandForecasting.getForecast(cooperativeId, {
      forecastStart: forecastStart.toISOString().slice(0, 10),
      forecastEnd: forecastEnd.toISOString().slice(0, 10),
    });
  }

  async getDemandCapacity(actor: AuthenticatedUser, cooperativeId: string, days = 30) {
    await this.assertAdminOf(actor, cooperativeId);
    const snapshot = await this.buildDemandSnapshot(cooperativeId, days);
    return {
      cooperativeId,
      periodDays: days,
      generatedAt: new Date().toISOString(),
      totalVerifiedWorkers: snapshot.capacity.totalVerifiedWorkers,
      forecastDemand: snapshot.forecast.overview.predictedDemand ?? 0,
      bySkill: snapshot.capacity.bySkill.map((item) => ({
        skillId: item.skillId,
        skillName: item.skillName,
        verifiedWorkers: item.verifiedWorkers,
        forecastDemand: snapshot.forecast.highDemandSkills.find(
          (entry) => entry.dimensions.skill?.id === item.skillId,
        )?.predictedDemand ?? 0,
        capacityStatus: item.verifiedWorkers > 0 ? 'SUFFICIENT' : 'SHORTAGE',
      })),
    };
  }

  async getDemandRecommendations(actor: AuthenticatedUser, cooperativeId: string, days = 30) {
    await this.assertAdminOf(actor, cooperativeId);
    const snapshot = await this.buildDemandSnapshot(cooperativeId, days);
    const recommendations = snapshot.forecast.highDemandSkills
      .filter((skill) => (skill.predictedDemand ?? 0) > 0)
      .map((skill) => {
        const skillId = skill.dimensions.skill?.id ?? '';
        const capacity = snapshot.capacity.bySkill.find((entry) => entry.skillId === skillId);
        const availableWorkers = capacity?.verifiedWorkers ?? 0;
        const predictedDemand = skill.predictedDemand ?? 0;
        return {
          skillId,
          skillName: skill.dimensions.skill?.name ?? 'Unknown',
          predictedDemand,
          availableWorkers,
          recommendedWorkers: Math.max(1, predictedDemand - availableWorkers),
          severity: predictedDemand > availableWorkers ? 'SHORTAGE' : 'SUFFICIENT',
          reason: predictedDemand > availableWorkers ? 'Demand exceeds current qualified capacity.' : 'Current capacity is sufficient for the current forecast.',
        };
      })
      .slice(0, 5);

    return {
      cooperativeId,
      periodDays: days,
      generatedAt: new Date().toISOString(),
      recommendations,
    };
  }

  private async buildDemandSnapshot(cooperativeId: string, days: number) {
    const normalizedDays = Math.max(7, Number.isFinite(days) ? days : 30);
    const today = startOfUtcDay(new Date());
    const historyStart = addUtcDays(today, -(normalizedDays - 1));
    const historyEnd = addUtcDays(today, 1);
    const forecastStart = addUtcDays(today, 1);
    const forecastEnd = addUtcDays(today, Math.max(6, normalizedDays - 1));
    const records = await this.historicalDemand.getDemandRecords({
      cooperativeId,
      startDate: historyStart,
      endDate: historyEnd,
    });
    const forecast = await this.demandForecasting.getForecast(cooperativeId, {
      forecastStart: forecastStart.toISOString().slice(0, 10),
      forecastEnd: forecastEnd.toISOString().slice(0, 10),
    });
    const capacity = await this.getCurrentCapacitySnapshot(cooperativeId);
    return { records, forecast, capacity, historyStart, historyEnd, forecastStart, forecastEnd };
  }

  private async getCurrentCapacitySnapshot(cooperativeId: string) {
    const memberships = await this.prisma.cooperativeMembership.findMany({
      where: { cooperativeId, leftAt: null },
      select: {
        worker: {
          select: {
            id: true,
            skills: {
              where: { verificationStatus: SkillVerificationStatus.VERIFIED },
              select: { skillId: true, skill: { select: { id: true, name: true } } },
            },
          },
        },
      },
    });

    const bySkill = new Map<string, { skillId: string; skillName: string; verifiedWorkers: number }>();
    const workerIds = new Set<string>();

    for (const membership of memberships) {
      const workerId = membership.worker.id;
      workerIds.add(workerId);
      for (const skill of membership.worker.skills) {
        const current = bySkill.get(skill.skill.id) ?? {
          skillId: skill.skill.id,
          skillName: skill.skill.name,
          verifiedWorkers: 0,
        };
        current.verifiedWorkers += 1;
        bySkill.set(skill.skill.id, current);
      }
    }

    return {
      totalVerifiedWorkers: workerIds.size,
      bySkill: Array.from(bySkill.values()).map((item) => ({
        skillId: item.skillId,
        skillName: item.skillName,
        verifiedWorkers: item.verifiedWorkers,
      })),
    };
  }

  private countRecordsBySkill(records: Array<{ skill: { id: string } | null }>, skillId: string) {
    return records.filter((record) => record.skill?.id === skillId).length;
  }

  private async getMyCooperativeId(actor: AuthenticatedUser) {
    const cooperative = await this.prisma.cooperative.findFirst({
      where: { adminUserId: actor.id },
      select: { id: true },
    });
    if (!cooperative) {
      throw new NotFoundException('Cooperative is not available');
    }
    return cooperative.id;
  }

  private async assertAdminOf(actor: AuthenticatedUser, cooperativeId: string) {
    const cooperative = await this.prisma.cooperative.findFirst({
      where: { id: cooperativeId, adminUserId: actor.id },
      select: { id: true },
    });
    if (!cooperative) throw new NotFoundException('Cooperative is not available');
  }

  private toSummary(
    cooperative: Prisma.CooperativeGetPayload<{
      include: typeof cooperativeInclude & {
        memberships: {
          select: { worker: { select: { skills: { select: { verificationStatus: true } } } } };
        };
      };
    }>,
  ) {
    const skillStatuses = cooperative.memberships.flatMap((membership) =>
      membership.worker.skills.map((skill) => skill.verificationStatus),
    );
    return {
      id: cooperative.id,
      name: cooperative.name,
      registrationNo: cooperative.registrationNo,
      status: cooperative.status,
      createdAt: cooperative.createdAt,
      memberCount: cooperative._count.memberships,
      verifiedSkillCount: skillStatuses.filter((status) => status === 'VERIFIED').length,
      pendingVerificationCount: skillStatuses.filter(
        (status) => status === 'PENDING' || status === 'ASSESSMENT_PENDING',
      ).length,
    };
  }

  private toDetail(
    cooperative: Prisma.CooperativeGetPayload<{ include: typeof cooperativeInclude }>,
  ) {
    return {
      id: cooperative.id,
      name: cooperative.name,
      registrationNo: cooperative.registrationNo,
      description: cooperative.description,
      location: cooperative.location,
      operatingArea: cooperative.operatingArea,
      contactEmail: cooperative.contactEmail,
      contactPhone: cooperative.contactPhone,
      status: cooperative.status,
      createdAt: cooperative.createdAt,
      updatedAt: cooperative.updatedAt,
      memberCount: cooperative._count.memberships,
      admin: cooperative.admin,
    };
  }

  private toMember(
    membership: Prisma.CooperativeMembershipGetPayload<{ include: typeof memberInclude }>,
    options: { detailed?: boolean } = {},
  ) {
    const skills = membership.worker.skills.map((skill) => ({
      id: skill.id,
      name: skill.skill.name,
      category: skill.skill.category?.name ?? null,
      proficiency: skill.proficiency,
      experienceYears: skill.experienceYears,
      experienceSummary: skill.experienceSummary,
      verificationStatus: skill.verificationStatus,
    }));
    const openMembership = membership.worker.memberships.find((item) => !item.leftAt) ?? null;
    const member = {
      membershipId: membership.id,
      workerId: membership.worker.id,
      userId: membership.worker.userId,
      fullName: membership.worker.fullName,
      location: membership.worker.location,
      yearsExperience: membership.worker.yearsExperience,
      availability: membership.worker.availability,
      email: membership.worker.user.email,
      accountActive: membership.worker.user.isActive,
      membershipRole: membership.role,
      joinedAt: membership.joinedAt,
      leftAt: membership.leftAt,
      membershipStatus: membership.leftAt ? ('FORMER' as const) : ('ACTIVE' as const),
      skillCount: skills.length,
      verifiedSkillCount: skills.filter((skill) => skill.verificationStatus === 'VERIFIED').length,
      skills: options.detailed
        ? skills
        : skills.filter((skill) => skill.verificationStatus === 'VERIFIED'),
    };
    return {
      ...member,
      // Detailed views see every skill; list views see the verified headline.
      ...(options.detailed ? {} : {}),
      currentCooperativeIds: openMembership ? [openMembership.cooperativeId] : [],
    };
  }
}
