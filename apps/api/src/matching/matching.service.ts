import { Injectable, NotFoundException } from '@nestjs/common';
import { ServiceRequestStatus, SkillVerificationStatus, WorkerAvailability } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { AuthenticatedUser } from '../auth/auth.types';
import {
  haversineDistanceKm,
  parseCoordinates,
  PROXIMITY_THRESHOLD_KM,
} from './utils/coordinate.utils';

const PROFICIENCY_POINTS: Record<string, number> = {
  BEGINNER: 0,
  INTERMEDIATE: 5,
  ADVANCED: 10,
  EXPERT: 15,
};

const SKILL_VERIFIED_BASE = 50;

export interface ComputedMatch {
  workerId: string;
  fullName: string | null;
  profilePhotoUrl: string | null;
  location: string | null;
  experienceYears: number;
  proficiency: string;
  availability: WorkerAvailability | null;
  cooperative: { id: string; name: string } | null;
  skill: { name: string };
  distanceKm: number | null;
  score: number;
  matchReasons: string[];
}

/**
 * Step 7 — deterministic, explainable worker matching foundation.
 *
 * Eligibility (hard filters, all resolved from persisted data):
 *  - worker user is active with role WORKER
 *  - worker holds an open membership (leftAt null) in an ACTIVE cooperative
 *  - worker has a WorkerSkill for the required skill that is VERIFIED
 *  - worker availability is not UNAVAILABLE
 *
 * Education and certificates never influence eligibility or score. Only the
 * existing Step 4 verification mechanism establishes competency.
 */
@Injectable()
export class WorkerMatchingService {
  constructor(private readonly prisma: PrismaService) {}

  private async resolveCustomerId(user: AuthenticatedUser): Promise<string> {
    const customer = await this.prisma.customer.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });
    if (!customer) {
      throw new NotFoundException('Customer profile is not available');
    }
    return customer.id;
  }

  async findMatches(user: AuthenticatedUser, requestId: string): Promise<ComputedMatch[]> {
    const customerId = await this.resolveCustomerId(user);

    const request = await this.prisma.serviceRequest.findUnique({
      where: { id: requestId },
      select: { id: true, customerId: true, skillId: true, status: true, location: true },
    });
    if (!request) {
      throw new NotFoundException('Service request is not available');
    }
    if (request.customerId !== customerId) {
      throw new NotFoundException('Service request is not available');
    }
    if (request.status !== ServiceRequestStatus.OPEN) {
      throw new NotFoundException('Service request is not available for matching');
    }
    if (!request.skillId) {
      return [];
    }

    const skill = await this.prisma.skill.findUnique({
      where: { id: request.skillId },
      select: { id: true, name: true, active: true },
    });
    if (!skill || !skill.active) {
      return [];
    }

    const workerSkills = await this.prisma.workerSkill.findMany({
      where: {
        skillId: request.skillId,
        verificationStatus: SkillVerificationStatus.VERIFIED,
        worker: {
          user: { isActive: true, role: 'WORKER' },
        },
      },
      select: {
        workerId: true,
        experienceYears: true,
        proficiency: true,
        worker: {
          select: {
            id: true,
            fullName: true,
            profilePhotoUrl: true,
            location: true,
            availability: true,
            memberships: {
              where: { leftAt: null, cooperative: { status: 'ACTIVE' } },
              select: { cooperative: { select: { id: true, name: true } } },
            },
          },
        },
      },
    });

    const matches: ComputedMatch[] = [];
    for (const ws of workerSkills) {
      const worker = ws.worker;
      // Respect the existing availability model: unavailable workers are excluded.
      if (worker.availability === WorkerAvailability.UNAVAILABLE) {
        continue;
      }
      // Cooperative boundaries: only workers with a valid active membership.
      if (worker.memberships.length === 0) {
        continue;
      }

      const coop = worker.memberships[0].cooperative;
      const { distanceKm, locationMatch, locationReason } = this.resolveLocation(
        request.location,
        worker.location,
      );
      const score = this.calculateScore(ws, locationMatch);
      const reasons = this.buildReasons(ws, locationReason);

      matches.push({
        workerId: worker.id,
        fullName: worker.fullName,
        profilePhotoUrl: worker.profilePhotoUrl,
        location: worker.location,
        experienceYears: ws.experienceYears,
        proficiency: ws.proficiency,
        availability: worker.availability,
        cooperative: coop ? { id: coop.id, name: coop.name } : null,
        skill: { name: skill.name },
        distanceKm,
        score,
        matchReasons: reasons,
      });
    }

    // Deterministic ordering: score desc, then experience desc, then name asc.
    matches.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.experienceYears !== a.experienceYears) {
        return b.experienceYears - a.experienceYears;
      }
      return (a.fullName ?? '').localeCompare(b.fullName ?? '');
    });

    return matches;
  }

  /**
   * Safe public worker profile — marketplace-appropriate information only.
   * Education, contact details, verification notes, and authentication data
   * are intentionally excluded.
   */
  async getPublicWorkerProfile(workerUserId: string) {
    const worker = await this.prisma.worker.findUnique({
      where: { userId: workerUserId },
      select: {
        fullName: true,
        profilePhotoUrl: true,
        location: true,
        availability: true,
        languages: true,
        yearsExperience: true,
        bio: true,
      },
    });
    if (!worker) {
      throw new NotFoundException('Worker profile is not available');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: workerUserId },
      select: { isActive: true },
    });
    if (!user || !user.isActive) {
      throw new NotFoundException('Worker profile is not available');
    }

    const verifiedSkills = await this.prisma.workerSkill.findMany({
      where: {
        worker: { userId: workerUserId },
        verificationStatus: SkillVerificationStatus.VERIFIED,
      },
      select: {
        experienceYears: true,
        proficiency: true,
        experienceSummary: true,
        skill: { select: { id: true, name: true, category: { select: { name: true } } } },
      },
      orderBy: [{ proficiency: 'desc' }],
    });

    const memberships = await this.prisma.cooperativeMembership.findMany({
      where: {
        worker: { userId: workerUserId },
        leftAt: null,
        cooperative: { status: 'ACTIVE' },
      },
      select: { cooperative: { select: { id: true, name: true } } },
    });

    const completionFields = [
      Boolean(worker.fullName),
      Boolean(worker.profilePhotoUrl),
      Boolean(worker.bio),
      Boolean(worker.location),
      worker.yearsExperience !== null,
      worker.availability !== null,
      worker.languages.length > 0,
    ];

    return {
      fullName: worker.fullName,
      profilePhotoUrl: worker.profilePhotoUrl,
      location: worker.location,
      availability: worker.availability,
      languages: worker.languages,
      yearsExperience: worker.yearsExperience,
      bio: worker.bio,
      profileCompletion: Math.round(
        (completionFields.filter(Boolean).length / completionFields.length) * 100,
      ),
      verifiedSkills: verifiedSkills.map((ws) => ({
        name: ws.skill.name,
        category: ws.skill.category?.name ?? null,
        proficiency: ws.proficiency,
        experienceYears: ws.experienceYears,
        experienceSummary: ws.experienceSummary,
      })),
      cooperatives: memberships.map((m) => ({ id: m.cooperative.id, name: m.cooperative.name })),
    };
  }

  /**
   * Resolve location compatibility. Coordinates take precedence (Haversine);
   * otherwise fall back to city/locality text overlap.
   */
  private resolveLocation(
    requestLocation: string | null,
    workerLocation: string | null,
  ): { distanceKm: number | null; locationMatch: boolean; locationReason: string | null } {
    const requestCoords = parseCoordinates(requestLocation);
    const workerCoords = parseCoordinates(workerLocation);

    if (requestCoords && workerCoords) {
      const distanceKm = haversineDistanceKm(
        requestCoords.latitude,
        requestCoords.longitude,
        workerCoords.latitude,
        workerCoords.longitude,
      );
      if (Number.isFinite(distanceKm)) {
        return {
          distanceKm: Math.round(distanceKm * 100) / 100,
          locationMatch: distanceKm <= PROXIMITY_THRESHOLD_KM,
          locationReason: `Located ${Math.round(distanceKm)} km away`,
        };
      }
    }

    if (this.isLocationCompatible(requestLocation, workerLocation)) {
      return {
        distanceKm: null,
        locationMatch: true,
        locationReason: 'Location is compatible with the request',
      };
    }
    return { distanceKm: null, locationMatch: false, locationReason: null };
  }

  private isLocationCompatible(
    requestLocation: string | null,
    workerLocation: string | null,
  ): boolean {
    if (!requestLocation || !workerLocation) return false;
    const a = requestLocation.toLowerCase().trim();
    const b = workerLocation.toLowerCase().trim();
    if (!a || !b) return false;
    return a.includes(b) || b.includes(a);
  }

  private calculateScore(
    ws: { experienceYears: number; proficiency: string },
    locationMatch: boolean,
  ): number {
    let score = SKILL_VERIFIED_BASE;
    score += Math.min(ws.experienceYears, 20) * 2;
    score += PROFICIENCY_POINTS[ws.proficiency] ?? 0;
    if (locationMatch) score += 15;
    return score;
  }

  private buildReasons(
    ws: { experienceYears: number; proficiency: string },
    locationReason: string | null,
  ): string[] {
    const reasons: string[] = ['Verified required skill'];
    if (ws.experienceYears > 0) {
      reasons.push(`${Math.min(ws.experienceYears, 99)} years of practical experience`);
    }
    reasons.push(`Proficiency: ${ws.proficiency.toLowerCase()}`);
    if (locationReason) {
      reasons.push(locationReason);
    }
    return reasons;
  }
}
