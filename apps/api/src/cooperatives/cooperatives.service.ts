<<<<<<< Updated upstream
import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, SkillVerificationStatus } from '@prisma/client';
=======
import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
>>>>>>> Stashed changes
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

<<<<<<< Updated upstream
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
=======
  async getDemandOverview(actor: AuthenticatedUser, cooperativeId: string, days = 30) {
    await this.assertAdminOf(actor, cooperativeId);
    const normalizedDays = this.normalizeForecastDays(days);
    const snapshot = await this.buildDemandSnapshot(cooperativeId, normalizedDays);
    const forecast = snapshot.forecast.map((entry) => ({
      ...entry,
      cooperativeId,
      engine: 'deterministic-statistical',
      status: entry.status,
    }));
    const overallStatus = snapshot.forecast.some((entry) => entry.status === 'SUFFICIENT_DATA')
      ? 'SUFFICIENT_DATA'
      : 'INSUFFICIENT_DATA';
    const totalPredictedDemand = forecast.reduce((sum, item) => sum + item.predictedDemand, 0);

    return {
      cooperativeId,
      forecastPeriodDays: normalizedDays,
      generatedAt: new Date().toISOString(),
      status: overallStatus,
      totalHistoricalRequests: snapshot.totalHistoricalRequests,
      averageDailyDemand: snapshot.averageDailyDemand,
      emergencyShare: snapshot.emergencyShare,
      totalPredictedDemand,
      forecast,
      recommendations: await this.buildRecommendations(cooperativeId, normalizedDays),
>>>>>>> Stashed changes
    };
  }

  async getDemandBySkill(actor: AuthenticatedUser, cooperativeId: string, days = 30) {
    await this.assertAdminOf(actor, cooperativeId);
<<<<<<< Updated upstream
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
=======
    const normalizedDays = this.normalizeForecastDays(days);
    const snapshot = await this.buildDemandSnapshot(cooperativeId, normalizedDays);
    return {
      cooperativeId,
      forecastPeriodDays: normalizedDays,
      generatedAt: new Date().toISOString(),
      records: snapshot.forecast.map((entry) => ({
        skillId: entry.skillId,
        skillName: entry.skillName,
        totalRequests: entry.historicalDemand,
        emergencyRequests: entry.emergencyDemand,
        completionRate: entry.completionRate,
        predictedDemand: entry.predictedDemand,
        confidence: entry.confidence,
        confidenceLevel: entry.confidenceLevel,
      })),
    };
>>>>>>> Stashed changes
  }

  async getDemandTrends(actor: AuthenticatedUser, cooperativeId: string, days = 30) {
    await this.assertAdminOf(actor, cooperativeId);
<<<<<<< Updated upstream
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
=======
    const normalizedDays = this.normalizeForecastDays(days);
    const snapshot = await this.buildDemandSnapshot(cooperativeId, normalizedDays);
    return {
      cooperativeId,
      forecastPeriodDays: normalizedDays,
      generatedAt: new Date().toISOString(),
      series: snapshot.trendSeries,
      summary: {
        averageDailyDemand: snapshot.averageDailyDemand,
        emergencyShare: snapshot.emergencyShare,
        trendDirection: snapshot.trendDirection,
      },
>>>>>>> Stashed changes
    };
  }

  async getDemandForecast(actor: AuthenticatedUser, cooperativeId: string, days = 30) {
    await this.assertAdminOf(actor, cooperativeId);
<<<<<<< Updated upstream
    const forecastStart = startOfUtcDay(addUtcDays(new Date(), 1));
    const forecastEnd = startOfUtcDay(addUtcDays(forecastStart, Math.max(6, days - 1)));
    return this.demandForecasting.getForecast(cooperativeId, {
      forecastStart: forecastStart.toISOString().slice(0, 10),
      forecastEnd: forecastEnd.toISOString().slice(0, 10),
    });
=======
    const normalizedDays = this.normalizeForecastDays(days);
    const snapshot = await this.buildDemandSnapshot(cooperativeId, normalizedDays);
    return {
      cooperativeId,
      forecastPeriodDays: normalizedDays,
      status: snapshot.forecast.some((entry) => entry.status === 'SUFFICIENT_DATA')
        ? 'SUFFICIENT_DATA'
        : 'INSUFFICIENT_DATA',
      generatedAt: new Date().toISOString(),
      forecast: snapshot.forecast,
    };
>>>>>>> Stashed changes
  }

  async getDemandCapacity(actor: AuthenticatedUser, cooperativeId: string, days = 30) {
    await this.assertAdminOf(actor, cooperativeId);
<<<<<<< Updated upstream
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
=======
    const normalizedDays = this.normalizeForecastDays(days);
    const snapshot = await this.buildDemandSnapshot(cooperativeId, normalizedDays);
    return {
      cooperativeId,
      forecastPeriodDays: normalizedDays,
      generatedAt: new Date().toISOString(),
      capacity: snapshot.capacityRows,
>>>>>>> Stashed changes
    };
  }

  async getDemandRecommendations(actor: AuthenticatedUser, cooperativeId: string, days = 30) {
    await this.assertAdminOf(actor, cooperativeId);
<<<<<<< Updated upstream
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
=======
    const normalizedDays = this.normalizeForecastDays(days);
    return {
      cooperativeId,
      forecastPeriodDays: normalizedDays,
      generatedAt: new Date().toISOString(),
      recommendations: await this.buildRecommendations(cooperativeId, normalizedDays),
    };
  }

  private normalizeForecastDays(days: number): number {
    const normalized = Number(days ?? 30);
    if (!Number.isFinite(normalized) || normalized < 7 || normalized > 180) {
      throw new BadRequestException('Forecast days must be between 7 and 180');
    }
    return normalized;
  }

  private async buildRecommendations(cooperativeId: string, days: number) {
    const snapshot = await this.buildDemandSnapshot(cooperativeId, days);
    return snapshot.capacityRows.map((row) => ({
      skillId: row.skillId,
      skillName: row.skillName,
      predictedDemand: row.predictedDemand,
      availableWorkers: row.availableWorkers,
      recommendedWorkers: row.recommendedWorkers,
      capacityGap: row.capacityGap,
      status: row.capacityGap > 0 ? 'SHORTAGE' : 'SUFFICIENT',
      reasons: [
        row.trend > 0 ? 'Demand trend is rising over the last observation window.' : 'Demand is stable across the recent observation window.',
        row.emergencyDemand > 0 ? 'Emergency demand is materially contributing to the required workforce.' : 'Normal demand remains the primary driver of capacity requirements.',
        row.availableWorkers < row.recommendedWorkers
          ? 'Verified cooperative capacity is below the recommended staffing threshold.'
          : 'Verified cooperative capacity is adequate against predicted demand.',
      ],
    }));
  }

  private async buildDemandSnapshot(cooperativeId: string, days: number) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    const skillIds = await this.prisma.workerSkill.findMany({
      where: {
        verificationStatus: 'VERIFIED',
        worker: {
          user: { isActive: true },
          memberships: {
            some: {
              cooperativeId,
              leftAt: null,
              cooperative: { status: 'ACTIVE' },
>>>>>>> Stashed changes
            },
          },
        },
      },
<<<<<<< Updated upstream
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

=======
      select: { skillId: true },
      distinct: ['skillId'],
    });

    const relevantSkillIds = skillIds.map((entry) => entry.skillId);
    const requestRecords = relevantSkillIds.length
      ? await this.prisma.serviceRequest.findMany({
          where: { skillId: { in: relevantSkillIds }, createdAt: { gte: cutoff } },
          select: {
            id: true,
            skillId: true,
            status: true,
            priority: true,
            createdAt: true,
            skill: { select: { id: true, name: true, category: { select: { name: true } } } },
          },
          orderBy: { createdAt: 'asc' },
        })
      : [];

    const groupedBySkill = new Map<string, { skillId: string; skillName: string; records: typeof requestRecords }>();
    for (const record of requestRecords) {
      const skillId = record.skillId ?? '';
      if (!skillId) continue;
      const skillName = record.skill?.name ?? 'Unknown skill';
      const bucket = groupedBySkill.get(skillId) ?? { skillId, skillName, records: [] as typeof requestRecords };
      bucket.records.push(record);
      groupedBySkill.set(skillId, bucket);
    }

    const forecast = await Promise.all(
      Array.from(groupedBySkill.values()).map(async (entry) => {
        const records = entry.records;
        const total = records.length;
        const emergencyDemand = records.filter((item) => item.priority === 'EMERGENCY').length;
        const completed = records.filter((item) => item.status === 'CLOSED').length;
        const cancelled = records.filter((item) => item.status === 'CANCELLED').length;
        const open = records.filter((item) => item.status === 'OPEN').length;
        const avgDaily = total / Math.max(days, 1);
        const latestWindowStart = new Date();
        latestWindowStart.setDate(latestWindowStart.getDate() - 7);
        const olderWindowStart = new Date();
        olderWindowStart.setDate(olderWindowStart.getDate() - 14);
        const recentDemand = records.filter((item) => item.createdAt >= latestWindowStart).length;
        const previousDemand = records.filter(
          (item) => item.createdAt >= olderWindowStart && item.createdAt < latestWindowStart,
        ).length;
        const trend = previousDemand === 0 ? (recentDemand > 0 ? 1 : 0) : (recentDemand - previousDemand) / previousDemand;
        const predictedDemand = Math.max(0, Math.round(avgDaily + avgDaily * Math.max(trend, 0) + emergencyDemand * 0.75));
        const availableWorkerRows = await this.prisma.workerSkill.findMany({
          where: {
            skillId: entry.skillId,
            verificationStatus: 'VERIFIED',
            worker: {
              user: { isActive: true },
              memberships: {
                some: {
                  cooperativeId,
                  leftAt: null,
                  cooperative: { status: 'ACTIVE' },
                },
              },
            },
          },
          select: { id: true },
        });
        const availableWorkers = availableWorkerRows.length;
        const recommendedWorkers = Math.max(1, Math.ceil(predictedDemand / 3));
        const capacityGap = Math.max(0, recommendedWorkers - availableWorkers);
        const completionRate = total === 0 ? 0 : completed / total;
        const cancellationRate = total === 0 ? 0 : cancelled / total;
        const confidenceRaw = Math.min(
          1,
          0.2 + Math.min(total / 15, 0.4) + (records.length >= 4 ? 0.2 : 0) + (Math.abs(trend) < 0.5 ? 0.2 : 0),
        );
        const confidence = Number(confidenceRaw.toFixed(2));
        const confidenceLevel = confidence >= 0.8 ? 'HIGH' : confidence >= 0.5 ? 'MEDIUM' : 'LOW';
        const status = total >= 3 ? 'SUFFICIENT_DATA' : 'INSUFFICIENT_DATA';

        return {
          skillId: entry.skillId,
          skillName: entry.skillName,
          historicalDemand: total,
          emergencyDemand,
          completionRate,
          cancellationRate,
          trend,
          predictedDemand,
          availableWorkers,
          recommendedWorkers,
          capacityGap,
          confidence,
          confidenceLevel,
          status,
          reasons: [
            trend > 0 ? 'Recent demand is increasing relative to the prior period.' : 'Recent demand is stable or declining versus the prior period.',
            emergencyDemand > 0 ? 'Emergency demand is contributing to the observed workload.' : 'Normal demand is driving the forecast profile.',
          ],
          open,
          completed,
          cancelled,
        };
      }),
    );

    const totalHistoricalRequests = requestRecords.length;
    const emergencyShare = totalHistoricalRequests === 0 ? 0 : requestRecords.filter((item) => item.priority === 'EMERGENCY').length / totalHistoricalRequests;
    const averageDailyDemand = totalHistoricalRequests === 0 ? 0 : totalHistoricalRequests / Math.max(days, 1);
    const trendDirection = forecast.length
      ? forecast.reduce((sum, item) => sum + item.trend, 0) >= 0
        ? 'UPWARD'
        : 'DOWNWARD'
      : 'STABLE';

    const trendSeries = Array.from({ length: 7 }, (_, index) => {
      const currentDate = new Date();
      currentDate.setDate(currentDate.getDate() - (6 - index));
      const dayKey = currentDate.toISOString().slice(0, 10);
      const demand = requestRecords.filter((item) => item.createdAt.toISOString().slice(0, 10) === dayKey).length;
      return {
        date: dayKey,
        demand,
      };
    });

    const capacityRows = forecast.map((entry) => ({
      skillId: entry.skillId,
      skillName: entry.skillName,
      predictedDemand: entry.predictedDemand,
      availableWorkers: entry.availableWorkers,
      activeWorkload: entry.historicalDemand,
      recommendedWorkers: entry.recommendedWorkers,
      capacityGap: entry.capacityGap,
      confidence: entry.confidence,
      trend: entry.trend,
      emergencyDemand: entry.emergencyDemand,
    }));

    return {
      totalHistoricalRequests,
      averageDailyDemand,
      emergencyShare,
      trendDirection,
      trendSeries,
      forecast,
      capacityRows,
    };
  }

>>>>>>> Stashed changes
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
