import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import {
  CertificateStatus,
  SkillProficiency,
  SkillVerificationStatus,
  UserRole,
  VerificationMethod,
  WorkerAvailability,
} from '@prisma/client';
import request from 'supertest';
import { AuthorizationService } from '../../auth/authorization/authorization.service';
import { AuthenticationGuard } from '../../auth/guards/authentication.guard';
import { CooperativeResourceScopeGuard } from '../../auth/guards/cooperative-resource-scope.guard';
import { CooperativeScopeGuard } from '../../auth/guards/cooperative-scope.guard';
import { OwnershipGuard } from '../../auth/guards/ownership.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { PrismaService } from '../../database/prisma.service';
import { SkillVerificationController } from '../../verification/skill-verification.controller';
import { SkillVerificationService } from '../../verification/skill-verification.service';
import { WorkersController } from '../workers.controller';
import { WorkersService } from '../workers.service';

const ACCESS_SECRET = 'access-secret-for-step4-tests-at-least-32-chars';

/**
 * In-memory Prisma mock that mirrors the persisted relationships used by the
 * Step 4 worker profile, skill, evidence, certificate, and verification flows.
 * Every authorization decision is resolved from these persisted records, never
 * from request bodies.
 */
function createPrismaMock() {
  const users = new Map<string, { id: string; role: UserRole }>();
  const workers = new Map<
    string,
    {
      id: string;
      userId: string;
      fullName: string | null;
      profilePhotoUrl: string | null;
      bio: string | null;
      location: string | null;
      educationQualification: string | null;
      educationInstitution: string | null;
      educationYear: number | null;
      yearsExperience: number | null;
      availability: WorkerAvailability | null;
      languages: string[];
    }
  >();
  const cooperatives = new Map<string, { id: string; adminUserId: string | null }>();
  const memberships = new Map<
    string,
    { cooperativeId: string; workerId: string; leftAt: Date | null }
  >();
  const skills = new Map<
    string,
    { id: string; name: string; description: string | null; active: boolean }
  >();
  const workerSkills = new Map<
    string,
    {
      id: string;
      workerId: string;
      skillId: string;
      proficiency: SkillProficiency;
      experienceYears: number;
      experienceSummary: string | null;
      evidenceReference: string | null;
      verificationStatus: SkillVerificationStatus;
      verificationRequestedAt: Date | null;
      verifiedAt: Date | null;
      verifiedByUserId: string | null;
    }
  >();
  const experiences = new Map<
    string,
    {
      id: string;
      workerId: string;
      title: string;
      organization: string | null;
      startDate: Date | null;
      endDate: Date | null;
      isCurrent: boolean;
      description: string | null;
      relevantSkills: string[];
    }
  >();
  const evidence = new Map<
    string,
    {
      id: string;
      workerSkillId: string;
      experienceId: string | null;
      type: string;
      description: string;
      referenceUrl: string | null;
      createdAt: Date;
    }
  >();
  const certificates = new Map<
    string,
    {
      id: string;
      workerSkillId: string;
      title: string;
      issuer: string | null;
      referenceNo: string | null;
      documentUrl: string | null;
      issuedAt: Date | null;
      expiresAt: Date | null;
      status: CertificateStatus;
      submittedAt: Date;
      reviewedAt: Date | null;
      reviewNotes: string | null;
    }
  >();
  const verifications = new Map<
    string,
    {
      id: string;
      workerSkillId: string;
      requestedByWorkerId: string | null;
      verifiedById: string | null;
      method: VerificationMethod | null;
      status: SkillVerificationStatus;
      notes: string | null;
      evidenceReference: string | null;
      assessmentReference: string | null;
      requestedAt: Date;
      reviewedAt: Date | null;
    }
  >();

  let idCounter = 0;
  const nextId = (prefix: string) => `${prefix}-${++idCounter}`;

  const workerByUserId = (userId: string) =>
    [...workers.values()].find((worker) => worker.userId === userId) ?? null;
  const workerSkillById = (id: string) => workerSkills.get(id) ?? null;
  const experienceById = (id: string) => experiences.get(id) ?? null;
  const evidenceById = (id: string) => evidence.get(id) ?? null;
  const certificateById = (id: string) => certificates.get(id) ?? null;
  const verificationById = (id: string) => verifications.get(id) ?? null;
  const membershipFor = (workerId: string, cooperativeId: string) =>
    [...memberships.values()].find(
      (item) => item.workerId === workerId && item.cooperativeId === cooperativeId && !item.leftAt,
    ) ?? null;

  // Assigned after construction to avoid a circular reference in the object
  // literal. The transaction receives the same mock object so nested writes
  // resolve against the same in-memory maps.
  // eslint-disable-next-line prefer-const -- the value is only available after the literal is built
  let transactionTarget: unknown;
  const mock = {
    user: {
      findUnique: jest.fn(async ({ where }: { where: { id: string } }) => {
        const user = users.get(where.id);
        return user ? { ...user } : null;
      }),
    },
    worker: {
      findUnique: jest.fn(async ({ where }: { where: { id?: string; userId?: string } }) => {
        const worker = where.id
          ? workers.get(where.id)
          : where.userId
            ? workerByUserId(where.userId)
            : null;
        if (!worker) return null;
        return {
          ...worker,
          skills: [...workerSkills.values()]
            .filter((item) => item.workerId === worker.id)
            .map((item) => ({ id: item.id })),
          experiences: [...experiences.values()]
            .filter((item) => item.workerId === worker.id)
            .map((item) => ({ id: item.id })),
        };
      }),
      update: jest.fn(
        async ({ where, data }: { where: { userId: string }; data: Record<string, unknown> }) => {
          const worker = workerByUserId(where.userId);
          if (!worker) throw new Error('Worker not found');
          Object.assign(worker, data);
          return {
            ...worker,
            skills: [...workerSkills.values()]
              .filter((item) => item.workerId === worker.id)
              .map((item) => ({ id: item.id })),
            experiences: [...experiences.values()]
              .filter((item) => item.workerId === worker.id)
              .map((item) => ({ id: item.id })),
          };
        },
      ),
    },
    cooperative: {
      findUnique: jest.fn(async ({ where }: { where: { id: string } }) => {
        const cooperative = cooperatives.get(where.id);
        return cooperative ? { ...cooperative } : null;
      }),
      findMany: jest.fn(async ({ where }: { where: { adminUserId: string } }) =>
        [...cooperatives.values()]
          .filter((cooperative) => cooperative.adminUserId === where.adminUserId)
          .map((cooperative) => ({ ...cooperative })),
      ),
    },
    cooperativeMembership: {
      findFirst: jest.fn(
        async ({
          where,
        }: {
          where: { cooperativeId: string; workerId?: string; leftAt: null };
        }) => {
          const membership = membershipFor(where.workerId ?? '', where.cooperativeId);
          return membership ? { id: 'membership' } : null;
        },
      ),
    },
    skill: {
      findMany: jest.fn(async () => [...skills.values()].map((skill) => ({ ...skill }))),
      findUnique: jest.fn(async ({ where }: { where: { id: string } }) => {
        const skill = skills.get(where.id);
        return skill ? { ...skill } : null;
      }),
    },
    workerSkill: {
      findMany: jest.fn(async ({ where }: { where: { workerId: string } }) =>
        [...workerSkills.values()]
          .filter((item) => item.workerId === where.workerId)
          .map((item) => ({
            ...item,
            skill: skills.get(item.skillId) ?? null,
            verifications: [],
            _count: { certificates: 0, evidence: 0 },
          })),
      ),
      findUnique: jest.fn(async ({ where }: { where: { id: string } }) => {
        const item = workerSkillById(where.id);
        return item ? { ...item, worker: { userId: workers.get(item.workerId)?.userId } } : null;
      }),
      findFirst: jest.fn(async ({ where }: { where: { id: string; workerId?: string } }) => {
        const item = workerSkillById(where.id);
        if (!item) return null;
        if (where.workerId && item.workerId !== where.workerId) return null;
        return { ...item };
      }),
      create: jest.fn(
        async ({
          data,
        }: {
          data: {
            workerId: string;
            skillId: string;
            proficiency: SkillProficiency;
            experienceYears: number;
            experienceSummary?: string | null;
            evidenceReference?: string | null;
            verificationStatus: SkillVerificationStatus;
          };
        }) => {
          const id = nextId('worker-skill');
          const item = {
            id,
            workerId: data.workerId,
            skillId: data.skillId,
            proficiency: data.proficiency,
            experienceYears: data.experienceYears,
            experienceSummary: data.experienceSummary ?? null,
            evidenceReference: data.evidenceReference ?? null,
            verificationStatus: data.verificationStatus,
            verificationRequestedAt: null,
            verifiedAt: null,
            verifiedByUserId: null,
          };
          workerSkills.set(id, item);
          return {
            ...item,
            skill: skills.get(data.skillId) ?? null,
            verifications: [],
            _count: { certificates: 0, evidence: 0 },
          };
        },
      ),
      update: jest.fn(
        async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
          const item = workerSkillById(where.id);
          if (!item) throw new Error('WorkerSkill not found');
          Object.assign(item, data);
          return {
            ...item,
            skill: skills.get(item.skillId) ?? null,
            verifications: [],
            _count: { certificates: 0, evidence: 0 },
          };
        },
      ),
      delete: jest.fn(async ({ where }: { where: { id: string } }) => {
        const item = workerSkillById(where.id);
        if (!item) throw new Error('WorkerSkill not found');
        workerSkills.delete(where.id);
        return { ...item };
      }),
    },
    workerExperience: {
      findMany: jest.fn(async ({ where }: { where: { workerId: string } }) =>
        [...experiences.values()]
          .filter((item) => item.workerId === where.workerId)
          .map((item) => ({ ...item })),
      ),
      findUnique: jest.fn(async ({ where }: { where: { id: string } }) => {
        const item = experienceById(where.id);
        return item ? { ...item, worker: { userId: workers.get(item.workerId)?.userId } } : null;
      }),
      findFirst: jest.fn(
        async ({ where }: { where: { id: string; worker?: { userId: string } } }) => {
          const item = experienceById(where.id);
          if (!item) return null;
          if (where.worker && workers.get(item.workerId)?.userId !== where.worker.userId) {
            return null;
          }
          return { ...item };
        },
      ),
      create: jest.fn(
        async ({
          data,
        }: {
          data: {
            workerId: string;
            title: string;
            organization?: string | null;
            startDate?: Date | null;
            endDate?: Date | null;
            isCurrent: boolean;
            description?: string | null;
            relevantSkills?: string[];
          };
        }) => {
          const id = nextId('experience');
          const item = {
            id,
            workerId: data.workerId,
            title: data.title,
            organization: data.organization ?? null,
            startDate: data.startDate ?? null,
            endDate: data.endDate ?? null,
            isCurrent: data.isCurrent,
            description: data.description ?? null,
            relevantSkills: data.relevantSkills ?? [],
          };
          experiences.set(id, item);
          return { ...item };
        },
      ),
      update: jest.fn(
        async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
          const item = experienceById(where.id);
          if (!item) throw new Error('Experience not found');
          Object.assign(item, data);
          return { ...item };
        },
      ),
      delete: jest.fn(async ({ where }: { where: { id: string } }) => {
        const item = experienceById(where.id);
        if (!item) throw new Error('Experience not found');
        experiences.delete(where.id);
        return { ...item };
      }),
    },
    skillEvidence: {
      findMany: jest.fn(async ({ where }: { where: { workerSkill: { workerId: string } } }) =>
        [...evidence.values()]
          .filter((item) => {
            const workerSkill = workerSkillById(item.workerSkillId);
            return workerSkill?.workerId === where.workerSkill.workerId;
          })
          .map((item) => ({
            ...item,
            workerSkill: {
              skill: skills.get(workerSkillById(item.workerSkillId)?.skillId ?? '') ?? null,
            },
            experience: item.experienceId ? experienceById(item.experienceId) : null,
          })),
      ),
      findUnique: jest.fn(async ({ where }: { where: { id: string } }) => {
        const item = evidenceById(where.id);
        if (!item) return null;
        const workerSkill = workerSkillById(item.workerSkillId);
        return {
          ...item,
          workerSkill: {
            worker: { userId: workers.get(workerSkill?.workerId ?? '')?.userId },
          },
        };
      }),
      findFirst: jest.fn(
        async ({ where }: { where: { id: string; workerSkill: { workerId: string } } }) => {
          const item = evidenceById(where.id);
          if (!item) return null;
          const workerSkill = workerSkillById(item.workerSkillId);
          if (workerSkill?.workerId !== where.workerSkill.workerId) return null;
          return { id: item.id };
        },
      ),
      create: jest.fn(
        async ({
          data,
        }: {
          data: {
            workerSkillId: string;
            experienceId?: string | null;
            type: string;
            description: string;
            referenceUrl?: string | null;
          };
        }) => {
          const id = nextId('evidence');
          const item = {
            id,
            workerSkillId: data.workerSkillId,
            experienceId: data.experienceId ?? null,
            type: data.type,
            description: data.description,
            referenceUrl: data.referenceUrl ?? null,
            createdAt: new Date(),
          };
          evidence.set(id, item);
          return {
            ...item,
            workerSkill: {
              skill: skills.get(workerSkillById(data.workerSkillId)?.skillId ?? '') ?? null,
            },
            experience: item.experienceId ? experienceById(item.experienceId) : null,
          };
        },
      ),
      update: jest.fn(
        async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
          const item = evidenceById(where.id);
          if (!item) throw new Error('Evidence not found');
          Object.assign(item, data);
          return {
            ...item,
            workerSkill: {
              skill: skills.get(workerSkillById(item.workerSkillId)?.skillId ?? '') ?? null,
            },
            experience: item.experienceId ? experienceById(item.experienceId) : null,
          };
        },
      ),
      delete: jest.fn(async ({ where }: { where: { id: string } }) => {
        const item = evidenceById(where.id);
        if (!item) throw new Error('Evidence not found');
        evidence.delete(where.id);
        return { ...item };
      }),
    },
    certificate: {
      findMany: jest.fn(async ({ where }: { where: { workerSkill: { workerId: string } } }) =>
        [...certificates.values()]
          .filter((item) => {
            const workerSkill = workerSkillById(item.workerSkillId);
            return workerSkill?.workerId === where.workerSkill.workerId;
          })
          .map((item) => ({
            ...item,
            workerSkill: {
              skill: skills.get(workerSkillById(item.workerSkillId)?.skillId ?? '') ?? null,
            },
          })),
      ),
      findUnique: jest.fn(async ({ where }: { where: { id: string } }) => {
        const item = certificateById(where.id);
        if (!item) return null;
        const workerSkill = workerSkillById(item.workerSkillId);
        return {
          ...item,
          workerSkill: {
            worker: { userId: workers.get(workerSkill?.workerId ?? '')?.userId },
          },
        };
      }),
      create: jest.fn(
        async ({
          data,
        }: {
          data: {
            workerSkillId: string;
            title: string;
            issuer?: string | null;
            referenceNo?: string | null;
            documentUrl?: string | null;
            issuedAt?: Date | null;
            expiresAt?: Date | null;
          };
        }) => {
          const id = nextId('certificate');
          const item = {
            id,
            workerSkillId: data.workerSkillId,
            title: data.title,
            issuer: data.issuer ?? null,
            referenceNo: data.referenceNo ?? null,
            documentUrl: data.documentUrl ?? null,
            issuedAt: data.issuedAt ?? null,
            expiresAt: data.expiresAt ?? null,
            status: CertificateStatus.SUBMITTED,
            submittedAt: new Date(),
            reviewedAt: null,
            reviewNotes: null,
          };
          certificates.set(id, item);
          return {
            ...item,
            workerSkill: {
              skill: skills.get(workerSkillById(data.workerSkillId)?.skillId ?? '') ?? null,
            },
          };
        },
      ),
      update: jest.fn(
        async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
          const item = certificateById(where.id);
          if (!item) throw new Error('Certificate not found');
          Object.assign(item, data);
          return {
            ...item,
            workerSkill: {
              skill: skills.get(workerSkillById(item.workerSkillId)?.skillId ?? '') ?? null,
            },
          };
        },
      ),
      delete: jest.fn(async ({ where }: { where: { id: string } }) => {
        const item = certificateById(where.id);
        if (!item) throw new Error('Certificate not found');
        certificates.delete(where.id);
        return { ...item };
      }),
    },
    skillVerification: {
      findFirst: jest.fn(
        async ({
          where,
        }: {
          where: {
            workerSkillId: string;
            status?: { in: SkillVerificationStatus[] };
          };
        }) => {
          const item = [...verifications.values()].find(
            (verification) =>
              verification.workerSkillId === where.workerSkillId &&
              (!where.status || where.status.in.includes(verification.status)),
          );
          return item ? { id: item.id } : null;
        },
      ),
      findUnique: jest.fn(async ({ where }: { where: { id: string } }) => {
        const item = verificationById(where.id);
        if (!item) return null;
        const workerSkill = workerSkillById(item.workerSkillId);
        return {
          ...item,
          workerSkill: { workerId: workerSkill?.workerId ?? null },
        };
      }),
      findMany: jest.fn(
        async ({
          where,
        }: {
          where: {
            status?: { in: SkillVerificationStatus[] };
            requestedByWorkerId?: string;
            workerSkill?: {
              worker: { memberships: { some: { cooperativeId: string; leftAt: null } } };
            };
          };
        }) => {
          const items = [...verifications.values()].filter((verification) => {
            if (where.status && !where.status.in.includes(verification.status)) return false;
            if (
              where.requestedByWorkerId &&
              verification.requestedByWorkerId !== where.requestedByWorkerId
            ) {
              return false;
            }
            if (where.workerSkill) {
              const workerSkill = workerSkillById(verification.workerSkillId);
              if (!workerSkill) return false;
              const membership = membershipFor(
                workerSkill.workerId,
                where.workerSkill.worker.memberships.some.cooperativeId,
              );
              if (!membership) return false;
            }
            return true;
          });
          return items.map((item) => ({
            ...item,
            workerSkill: {
              skill: skills.get(workerSkillById(item.workerSkillId)?.skillId ?? '') ?? null,
              worker: {
                id: workerSkillById(item.workerSkillId)?.workerId ?? '',
                fullName:
                  workers.get(workerSkillById(item.workerSkillId)?.workerId ?? '')?.fullName ??
                  null,
                userId:
                  workers.get(workerSkillById(item.workerSkillId)?.workerId ?? '')?.userId ?? '',
              },
              proficiency:
                workerSkillById(item.workerSkillId)?.proficiency ?? SkillProficiency.INTERMEDIATE,
              experienceYears: workerSkillById(item.workerSkillId)?.experienceYears ?? 0,
              experienceSummary: workerSkillById(item.workerSkillId)?.experienceSummary ?? null,
              evidenceReference: workerSkillById(item.workerSkillId)?.evidenceReference ?? null,
              certificates: [],
              evidence: [],
            },
            requestedByWorker: item.requestedByWorkerId ? { id: item.requestedByWorkerId } : null,
            verifiedBy: item.verifiedById ? { id: item.verifiedById } : null,
          }));
        },
      ),
      create: jest.fn(
        async ({
          data,
        }: {
          data: {
            workerSkillId: string;
            requestedByWorkerId: string;
            method: VerificationMethod;
            status: SkillVerificationStatus;
            notes?: string | null;
            evidenceReference?: string | null;
            assessmentReference?: string | null;
            requestedAt: Date;
          };
        }) => {
          const id = nextId('verification');
          const item = {
            id,
            workerSkillId: data.workerSkillId,
            requestedByWorkerId: data.requestedByWorkerId,
            verifiedById: null,
            method: data.method,
            status: data.status,
            notes: data.notes ?? null,
            evidenceReference: data.evidenceReference ?? null,
            assessmentReference: data.assessmentReference ?? null,
            requestedAt: data.requestedAt,
            reviewedAt: null,
          };
          verifications.set(id, item);
          return {
            ...item,
            workerSkill: {
              skill: skills.get(workerSkillById(data.workerSkillId)?.skillId ?? '') ?? null,
              worker: {
                id: workerSkillById(data.workerSkillId)?.workerId ?? '',
                fullName:
                  workers.get(workerSkillById(data.workerSkillId)?.workerId ?? '')?.fullName ??
                  null,
                userId:
                  workers.get(workerSkillById(data.workerSkillId)?.workerId ?? '')?.userId ?? '',
              },
              proficiency:
                workerSkillById(data.workerSkillId)?.proficiency ?? SkillProficiency.INTERMEDIATE,
              experienceYears: workerSkillById(data.workerSkillId)?.experienceYears ?? 0,
              experienceSummary: workerSkillById(data.workerSkillId)?.experienceSummary ?? null,
              evidenceReference: workerSkillById(data.workerSkillId)?.evidenceReference ?? null,
              certificates: [],
              evidence: [],
            },
            requestedByWorker: { id: data.requestedByWorkerId },
            verifiedBy: null,
          };
        },
      ),
      update: jest.fn(
        async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
          const item = verificationById(where.id);
          if (!item) throw new Error('Verification not found');
          Object.assign(item, data);
          return {
            ...item,
            workerSkill: {
              skill: skills.get(workerSkillById(item.workerSkillId)?.skillId ?? '') ?? null,
              worker: {
                id: workerSkillById(item.workerSkillId)?.workerId ?? '',
                fullName:
                  workers.get(workerSkillById(item.workerSkillId)?.workerId ?? '')?.fullName ??
                  null,
                userId:
                  workers.get(workerSkillById(item.workerSkillId)?.workerId ?? '')?.userId ?? '',
              },
              proficiency:
                workerSkillById(item.workerSkillId)?.proficiency ?? SkillProficiency.INTERMEDIATE,
              experienceYears: workerSkillById(item.workerSkillId)?.experienceYears ?? 0,
              experienceSummary: workerSkillById(item.workerSkillId)?.experienceSummary ?? null,
              evidenceReference: workerSkillById(item.workerSkillId)?.evidenceReference ?? null,
              certificates: [],
              evidence: [],
            },
            requestedByWorker: item.requestedByWorkerId ? { id: item.requestedByWorkerId } : null,
            verifiedBy: item.verifiedById ? { id: item.verifiedById } : null,
          };
        },
      ),
    },
    $transaction: jest.fn(async (callback: (transaction: unknown) => Promise<unknown>) => {
      return callback(transactionTarget);
    }),
    // Seed helpers used by the test setup.
    __seed: {
      addUser(id: string, role: UserRole) {
        users.set(id, { id, role });
      },
      addWorker(
        id: string,
        userId: string,
        data: Partial<{
          fullName: string | null;
          profilePhotoUrl: string | null;
          bio: string | null;
          location: string | null;
          educationQualification: string | null;
          educationInstitution: string | null;
          educationYear: number | null;
          yearsExperience: number | null;
          availability: WorkerAvailability | null;
          languages: string[];
        }> = {},
      ) {
        workers.set(id, {
          id,
          userId,
          fullName: data.fullName ?? null,
          profilePhotoUrl: data.profilePhotoUrl ?? null,
          bio: data.bio ?? null,
          location: data.location ?? null,
          educationQualification: data.educationQualification ?? null,
          educationInstitution: data.educationInstitution ?? null,
          educationYear: data.educationYear ?? null,
          yearsExperience: data.yearsExperience ?? null,
          availability: data.availability ?? null,
          languages: data.languages ?? [],
        });
      },
      addCooperative(id: string, adminUserId: string | null) {
        cooperatives.set(id, { id, adminUserId });
      },
      addMembership(workerId: string, cooperativeId: string) {
        memberships.set(`${workerId}:${cooperativeId}`, { cooperativeId, workerId, leftAt: null });
      },
      // Step 5 added `active` to the schema; seeded skills stay selectable.
      addSkill(id: string, name: string, description: string | null = null) {
        skills.set(id, { id, name, description, active: true });
      },
      addWorkerSkill(
        id: string,
        workerId: string,
        skillId: string,
        data: Partial<{
          proficiency: SkillProficiency;
          experienceYears: number;
          experienceSummary: string | null;
          evidenceReference: string | null;
          verificationStatus: SkillVerificationStatus;
        }> = {},
      ) {
        workerSkills.set(id, {
          id,
          workerId,
          skillId,
          proficiency: data.proficiency ?? SkillProficiency.INTERMEDIATE,
          experienceYears: data.experienceYears ?? 0,
          experienceSummary: data.experienceSummary ?? null,
          evidenceReference: data.evidenceReference ?? null,
          verificationStatus: data.verificationStatus ?? SkillVerificationStatus.NOT_VERIFIED,
          verificationRequestedAt: null,
          verifiedAt: null,
          verifiedByUserId: null,
        });
      },
      addExperience(
        id: string,
        workerId: string,
        data: Partial<{
          title: string;
          organization: string | null;
          startDate: Date | null;
          endDate: Date | null;
          isCurrent: boolean;
          description: string | null;
          relevantSkills: string[];
        }> = {},
      ) {
        experiences.set(id, {
          id,
          workerId,
          title: data.title ?? 'Field work',
          organization: data.organization ?? null,
          startDate: data.startDate ?? null,
          endDate: data.endDate ?? null,
          isCurrent: data.isCurrent ?? false,
          description: data.description ?? null,
          relevantSkills: data.relevantSkills ?? [],
        });
      },
      addEvidence(
        id: string,
        workerSkillId: string,
        data: Partial<{
          experienceId: string | null;
          type: string;
          description: string;
          referenceUrl: string | null;
        }> = {},
      ) {
        evidence.set(id, {
          id,
          workerSkillId,
          experienceId: data.experienceId ?? null,
          type: data.type ?? 'PRACTICAL_EXPERIENCE',
          description: data.description ?? 'Practical work evidence',
          referenceUrl: data.referenceUrl ?? null,
          createdAt: new Date(),
        });
      },
      addCertificate(
        id: string,
        workerSkillId: string,
        data: Partial<{
          title: string;
          issuer: string | null;
          referenceNo: string | null;
          documentUrl: string | null;
          issuedAt: Date | null;
          expiresAt: Date | null;
          status: CertificateStatus;
        }> = {},
      ) {
        certificates.set(id, {
          id,
          workerSkillId,
          title: data.title ?? 'Certificate',
          issuer: data.issuer ?? null,
          referenceNo: data.referenceNo ?? null,
          documentUrl: data.documentUrl ?? null,
          issuedAt: data.issuedAt ?? null,
          expiresAt: data.expiresAt ?? null,
          status: data.status ?? CertificateStatus.SUBMITTED,
          submittedAt: new Date(),
          reviewedAt: null,
          reviewNotes: null,
        });
      },
      addVerification(
        id: string,
        workerSkillId: string,
        data: Partial<{
          requestedByWorkerId: string | null;
          verifiedById: string | null;
          method: VerificationMethod | null;
          status: SkillVerificationStatus;
          notes: string | null;
          evidenceReference: string | null;
          assessmentReference: string | null;
          requestedAt: Date;
          reviewedAt: Date | null;
        }> = {},
      ) {
        verifications.set(id, {
          id,
          workerSkillId,
          requestedByWorkerId: data.requestedByWorkerId ?? null,
          verifiedById: data.verifiedById ?? null,
          method: data.method ?? null,
          status: data.status ?? SkillVerificationStatus.PENDING,
          notes: data.notes ?? null,
          evidenceReference: data.evidenceReference ?? null,
          assessmentReference: data.assessmentReference ?? null,
          requestedAt: data.requestedAt ?? new Date(),
          reviewedAt: data.reviewedAt ?? null,
        });
      },
      getWorkerSkill(id: string) {
        return workerSkillById(id);
      },
      getVerification(id: string) {
        return verificationById(id);
      },
      getVerificationIds() {
        return verifications.keys();
      },
      getCertificate(id: string) {
        return certificateById(id);
      },
      getExperience(id: string) {
        return experienceById(id);
      },
      getEvidence(id: string) {
        return evidenceById(id);
      },
    },
  };

  transactionTarget = mock;

  return mock;
}

type PrismaMock = ReturnType<typeof createPrismaMock>;

describe('Step 4 — Worker profile, skills, evidence, certificates, and verification', () => {
  let app: INestApplication;
  let jwt: JwtService;
  let prisma: PrismaMock;

  beforeAll(async () => {
    process.env.JWT_ACCESS_SECRET = ACCESS_SECRET;
    prisma = createPrismaMock();

    // Seed persisted relationships.
    prisma.__seed.addUser('worker-user-a', UserRole.WORKER);
    prisma.__seed.addUser('worker-user-b', UserRole.WORKER);
    prisma.__seed.addUser('admin-user-a', UserRole.COOPERATIVE_ADMIN);
    prisma.__seed.addUser('admin-user-b', UserRole.COOPERATIVE_ADMIN);

    prisma.__seed.addWorker('worker-a', 'worker-user-a', {
      fullName: 'Aarav Kumar',
      location: 'Pune',
      yearsExperience: 12,
      availability: WorkerAvailability.AVAILABLE,
      languages: ['Hindi', 'Marathi'],
    });
    prisma.__seed.addWorker('worker-b', 'worker-user-b', {
      fullName: 'Meera Nair',
      location: 'Kochi',
    });

    prisma.__seed.addCooperative('cooperative-a', 'admin-user-a');
    prisma.__seed.addCooperative('cooperative-b', 'admin-user-b');
    prisma.__seed.addMembership('worker-a', 'cooperative-a');
    prisma.__seed.addMembership('worker-b', 'cooperative-b');

    prisma.__seed.addSkill(
      '11111111-1111-4111-8111-111111111111',
      'Plumbing',
      'Pipe fitting and repair',
    );
    prisma.__seed.addSkill(
      '22222222-2222-4222-8222-222222222222',
      'Electrical Work',
      'Wiring and fixtures',
    );

    prisma.__seed.addWorkerSkill(
      'worker-skill-a',
      'worker-a',
      '11111111-1111-4111-8111-111111111111',
      {
        proficiency: SkillProficiency.ADVANCED,
        experienceYears: 10,
        experienceSummary: 'Installed and repaired plumbing in residential buildings.',
      },
    );
    prisma.__seed.addWorkerSkill(
      'worker-skill-b',
      'worker-b',
      '22222222-2222-4222-8222-222222222222',
      {
        proficiency: SkillProficiency.INTERMEDIATE,
        experienceYears: 3,
      },
    );

    prisma.__seed.addExperience('experience-a', 'worker-a', {
      title: 'Plumbing technician',
      organization: 'City Housing Society',
      startDate: new Date('2014-01-01'),
      isCurrent: true,
      description: 'Maintenance and repair of water lines and fixtures.',
      relevantSkills: ['Plumbing'],
    });

    prisma.__seed.addCertificate('certificate-a', 'worker-skill-a', {
      title: 'Plumbing Safety Certificate',
      issuer: 'Skill India',
      referenceNo: 'REF-2023-001',
      issuedAt: new Date('2023-05-01'),
    });

    const moduleRef = await Test.createTestingModule({
      imports: [JwtModule.register({})],
      controllers: [WorkersController, SkillVerificationController],
      providers: [
        WorkersService,
        SkillVerificationService,
        AuthorizationService,
        AuthenticationGuard,
        RolesGuard,
        OwnershipGuard,
        CooperativeScopeGuard,
        CooperativeResourceScopeGuard,
        Reflector,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }),
    );
    await app.init();
    jwt = app.get(JwtService);
  });

  afterAll(async () => {
    await app.close();
  });

  function http() {
    return request(app.getHttpServer());
  }

  async function accessToken(userId: string, role: UserRole): Promise<string> {
    return jwt.signAsync({ sub: userId, role, type: 'access' }, { secret: ACCESS_SECRET });
  }

  describe('Worker profile', () => {
    it('PASS: worker reads their own profile with completion and optional education', async () => {
      const token = await accessToken('worker-user-a', UserRole.WORKER);
      const response = await http()
        .get('/api/v1/workers/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body).toMatchObject({
        id: 'worker-a',
        fullName: 'Aarav Kumar',
        location: 'Pune',
        yearsExperience: 12,
        availability: WorkerAvailability.AVAILABLE,
        languages: ['Hindi', 'Marathi'],
        education: null,
        skillCount: 1,
        experienceCount: 1,
      });
      expect(response.body.profileCompletion).toBeGreaterThan(0);
    });

    it('PASS: worker updates their own profile without requiring education', async () => {
      const token = await accessToken('worker-user-a', UserRole.WORKER);
      const response = await http()
        .patch('/api/v1/workers/me')
        .set('Authorization', `Bearer ${token}`)
        .send({ bio: 'Self-taught plumber with a decade of practical work.' })
        .expect(200);

      expect(response.body.bio).toBe('Self-taught plumber with a decade of practical work.');
      expect(response.body.education).toBeNull();
    });

    it('PASS: unauthenticated profile access is rejected with 401', async () => {
      await http().get('/api/v1/workers/me').expect(401);
    });

    it('PASS: a customer cannot access the worker profile endpoint', async () => {
      const token = await accessToken('customer-user', UserRole.CUSTOMER);
      await http().get('/api/v1/workers/me').set('Authorization', `Bearer ${token}`).expect(403);
    });
  });

  describe('Worker experience', () => {
    it('PASS: worker creates their own experience', async () => {
      const token = await accessToken('worker-user-a', UserRole.WORKER);
      const response = await http()
        .post('/api/v1/workers/me/experiences')
        .set('Authorization', `Bearer ${token}`)
        .send({
          title: 'Independent plumbing work',
          organization: 'Local clients',
          startDate: '2020-01-01',
          isCurrent: true,
          description: 'Residential plumbing repairs.',
          relevantSkills: ['Plumbing'],
        })
        .expect(201);

      expect(response.body).toMatchObject({
        title: 'Independent plumbing work',
        organization: 'Local clients',
        isCurrent: true,
        relevantSkills: ['Plumbing'],
      });
    });

    it('PASS: worker updates their own experience', async () => {
      const token = await accessToken('worker-user-a', UserRole.WORKER);
      const response = await http()
        .patch('/api/v1/workers/me/experiences/experience-a')
        .set('Authorization', `Bearer ${token}`)
        .send({ description: 'Updated: full maintenance contract.' })
        .expect(200);

      expect(response.body.description).toBe('Updated: full maintenance contract.');
    });

    it('PASS: worker cannot modify another worker experience (403)', async () => {
      const token = await accessToken('worker-user-b', UserRole.WORKER);
      await http()
        .patch('/api/v1/workers/me/experiences/experience-a')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Hijacked' })
        .expect(403);
    });

    it('PASS: worker deletes their own experience', async () => {
      const token = await accessToken('worker-user-a', UserRole.WORKER);
      const response = await http()
        .delete('/api/v1/workers/me/experiences/experience-a')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body).toEqual({ success: true });
    });
  });

  describe('Worker skills', () => {
    it('PASS: worker lists the shared skill catalog', async () => {
      const token = await accessToken('worker-user-a', UserRole.WORKER);
      const response = await http()
        .get('/api/v1/workers/me/skill-catalog')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.length).toBeGreaterThanOrEqual(2);
      expect(response.body.map((skill: { name: string }) => skill.name)).toEqual(
        expect.arrayContaining(['Plumbing', 'Electrical Work']),
      );
    });

    it('PASS: worker adds a skill that starts NOT_VERIFIED', async () => {
      const token = await accessToken('worker-user-a', UserRole.WORKER);
      const response = await http()
        .post('/api/v1/workers/me/skills')
        .set('Authorization', `Bearer ${token}`)
        .send({
          skillId: '22222222-2222-4222-8222-222222222222',
          proficiency: SkillProficiency.BEGINNER,
          experienceYears: 1,
          experienceSummary: 'Basic wiring for home fixtures.',
        })
        .expect(201);

      expect(response.body.verificationStatus).toBe(SkillVerificationStatus.NOT_VERIFIED);
      expect(response.body.skill.name).toBe('Electrical Work');
    });

    it('PASS: worker updates their own skill proficiency without auto-verifying', async () => {
      const token = await accessToken('worker-user-a', UserRole.WORKER);
      const response = await http()
        .patch('/api/v1/workers/me/skills/worker-skill-a')
        .set('Authorization', `Bearer ${token}`)
        .send({ proficiency: SkillProficiency.EXPERT })
        .expect(200);

      expect(response.body.proficiency).toBe(SkillProficiency.EXPERT);
      expect(response.body.verificationStatus).toBe(SkillVerificationStatus.NOT_VERIFIED);
    });

    it('PASS: worker cannot modify another worker skill (403)', async () => {
      const token = await accessToken('worker-user-b', UserRole.WORKER);
      await http()
        .patch('/api/v1/workers/me/skills/worker-skill-a')
        .set('Authorization', `Bearer ${token}`)
        .send({ proficiency: SkillProficiency.EXPERT })
        .expect(403);
    });
  });

  describe('Worker evidence', () => {
    it('PASS: worker creates evidence linked to their skill', async () => {
      const token = await accessToken('worker-user-a', UserRole.WORKER);
      const response = await http()
        .post('/api/v1/workers/me/skills/worker-skill-a/evidence')
        .set('Authorization', `Bearer ${token}`)
        .send({
          type: 'PRACTICAL_EXPERIENCE',
          description: 'Completed 40+ residential plumbing installations.',
          referenceUrl: 'https://example.com/portfolio',
        })
        .expect(201);

      expect(response.body).toMatchObject({
        type: 'PRACTICAL_EXPERIENCE',
        description: 'Completed 40+ residential plumbing installations.',
        referenceUrl: 'https://example.com/portfolio',
      });
    });

    it('PASS: worker cannot add evidence to another worker skill (403)', async () => {
      const token = await accessToken('worker-user-b', UserRole.WORKER);
      await http()
        .post('/api/v1/workers/me/skills/worker-skill-a/evidence')
        .set('Authorization', `Bearer ${token}`)
        .send({ type: 'WORK_SAMPLE', description: 'Hijacked evidence' })
        .expect(403);
    });
  });

  describe('Worker certificates', () => {
    it('PASS: worker creates certificate metadata that does NOT auto-verify the skill', async () => {
      const token = await accessToken('worker-user-a', UserRole.WORKER);
      const response = await http()
        .post('/api/v1/workers/me/skills/worker-skill-a/certificates')
        .set('Authorization', `Bearer ${token}`)
        .send({
          title: 'Plumbing Safety Certificate',
          issuer: 'Skill India',
          issuedAt: '2023-05-01',
        })
        .expect(201);

      expect(response.body).toMatchObject({
        title: 'Plumbing Safety Certificate',
        issuer: 'Skill India',
        status: CertificateStatus.SUBMITTED,
      });

      // The skill must remain NOT_VERIFIED after certificate submission.
      const skill = prisma.__seed.getWorkerSkill('worker-skill-a');
      expect(skill?.verificationStatus).toBe(SkillVerificationStatus.NOT_VERIFIED);
    });

    it('PASS: worker updates their own certificate', async () => {
      const token = await accessToken('worker-user-a', UserRole.WORKER);
      const response = await http()
        .patch('/api/v1/workers/me/certificates/certificate-a')
        .set('Authorization', `Bearer ${token}`)
        .send({ referenceNo: 'REF-2023-001' })
        .expect(200);

      expect(response.body.referenceNo).toBe('REF-2023-001');
    });

    it('PASS: worker cannot modify another worker certificate (403)', async () => {
      const token = await accessToken('worker-user-b', UserRole.WORKER);
      await http()
        .patch('/api/v1/workers/me/certificates/certificate-a')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Hijacked' })
        .expect(403);
    });

    it('PASS: worker deletes their own certificate', async () => {
      const token = await accessToken('worker-user-a', UserRole.WORKER);
      const response = await http()
        .delete('/api/v1/workers/me/certificates/certificate-a')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body).toEqual({ success: true });
    });
  });

  describe('Skill verification workflow', () => {
    it('PASS: worker requests verification and status becomes PENDING', async () => {
      const token = await accessToken('worker-user-a', UserRole.WORKER);
      const response = await http()
        .post('/api/v1/workers/me/skills/worker-skill-a/verification-requests')
        .set('Authorization', `Bearer ${token}`)
        .send({
          method: VerificationMethod.PRACTICAL_ASSESSMENT,
          note: 'Ready for a practical assessment.',
        })
        .expect(201);

      expect(response.body.status).toBe(SkillVerificationStatus.PENDING);
      expect(response.body.method).toBe(VerificationMethod.PRACTICAL_ASSESSMENT);

      const skill = prisma.__seed.getWorkerSkill('worker-skill-a');
      expect(skill?.verificationStatus).toBe(SkillVerificationStatus.PENDING);
    });

    it('PASS: adding experience does NOT auto-verify a skill', async () => {
      const token = await accessToken('worker-user-a', UserRole.WORKER);
      await http()
        .post('/api/v1/workers/me/experiences')
        .set('Authorization', `Bearer ${token}`)
        .send({
          title: 'More plumbing work',
          isCurrent: true,
          relevantSkills: ['Plumbing'],
        })
        .expect(201);

      const skill = prisma.__seed.getWorkerSkill('worker-skill-a');
      expect(skill?.verificationStatus).toBe(SkillVerificationStatus.PENDING);
    });

    it('PASS: cooperative admin sees pending requests for their cooperative', async () => {
      const token = await accessToken('admin-user-a', UserRole.COOPERATIVE_ADMIN);
      const response = await http()
        .get('/api/v1/cooperatives/cooperative-a/verification-requests')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.length).toBeGreaterThanOrEqual(1);
      expect(response.body[0]).toMatchObject({
        status: SkillVerificationStatus.PENDING,
        worker: { id: 'worker-a', fullName: 'Aarav Kumar' },
        skill: { name: 'Plumbing' },
      });
    });

    it('PASS: admin from another cooperative cannot see or review the request (403)', async () => {
      const token = await accessToken('admin-user-b', UserRole.COOPERATIVE_ADMIN);
      await http()
        .get('/api/v1/cooperatives/cooperative-a/verification-requests')
        .set('Authorization', `Bearer ${token}`)
        .expect(403);

      const verificationId = [...prisma.__seed.getVerificationIds()][0];
      await http()
        .patch(`/api/v1/cooperatives/cooperative-a/verification-requests/${verificationId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ decision: SkillVerificationStatus.VERIFIED })
        .expect(403);
    });

    it('PASS: cooperative admin approves the verification', async () => {
      const token = await accessToken('admin-user-a', UserRole.COOPERATIVE_ADMIN);
      const verificationId = [...prisma.__seed.getVerificationIds()][0];
      const response = await http()
        .patch(`/api/v1/cooperatives/cooperative-a/verification-requests/${verificationId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ decision: SkillVerificationStatus.VERIFIED, note: 'Practical assessment passed.' })
        .expect(200);

      expect(response.body.status).toBe(SkillVerificationStatus.VERIFIED);
      expect(response.body.reviewedByUserId).toBe('admin-user-a');

      const skill = prisma.__seed.getWorkerSkill('worker-skill-a');
      expect(skill?.verificationStatus).toBe(SkillVerificationStatus.VERIFIED);
    });

    it('PASS: cooperative admin rejects with a required reason', async () => {
      // Seed a fresh pending request for worker-b in cooperative-b.
      prisma.__seed.addVerification('verification-b', 'worker-skill-b', {
        requestedByWorkerId: 'worker-b',
        method: VerificationMethod.EXPERIENCE_EVIDENCE,
        status: SkillVerificationStatus.PENDING,
      });

      const token = await accessToken('admin-user-b', UserRole.COOPERATIVE_ADMIN);
      const response = await http()
        .patch('/api/v1/cooperatives/cooperative-b/verification-requests/verification-b')
        .set('Authorization', `Bearer ${token}`)
        .send({ decision: SkillVerificationStatus.REJECTED, note: 'Evidence is insufficient.' })
        .expect(200);

      expect(response.body.status).toBe(SkillVerificationStatus.REJECTED);
      expect(response.body.note).toBe('Evidence is insufficient.');

      const skill = prisma.__seed.getWorkerSkill('worker-skill-b');
      expect(skill?.verificationStatus).toBe(SkillVerificationStatus.REJECTED);
    });

    it('PASS: rejection without a reason is a 400', async () => {
      prisma.__seed.addVerification('verification-c', 'worker-skill-b', {
        requestedByWorkerId: 'worker-b',
        method: VerificationMethod.ADMIN_REVIEW,
        status: SkillVerificationStatus.PENDING,
      });

      const token = await accessToken('admin-user-b', UserRole.COOPERATIVE_ADMIN);
      await http()
        .patch('/api/v1/cooperatives/cooperative-b/verification-requests/verification-c')
        .set('Authorization', `Bearer ${token}`)
        .send({ decision: SkillVerificationStatus.REJECTED })
        .expect(400);
    });
  });

  describe('Destructive cleanup', () => {
    it('PASS: worker deletes their own skill', async () => {
      const token = await accessToken('worker-user-a', UserRole.WORKER);
      const response = await http()
        .delete('/api/v1/workers/me/skills/worker-skill-a')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body).toEqual({ success: true });
    });
  });
});
