import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import {
  CertificateStatus,
  CooperativeStatus,
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
import { WorkersController } from '../../workers/workers.controller';
import { WorkersService } from '../../workers/workers.service';
import { CooperativesController } from '../cooperatives.controller';
import { CooperativesService } from '../cooperatives.service';
import { SkillsController } from '../../skills/skills.controller';
import { SkillsService } from '../../skills/skills.service';

const ACCESS_SECRET = 'access-secret-for-step5-tests-at-least-32-chars';

const CAT_ELECTRICAL = '11111111-1111-4111-8111-111111111111';
const CAT_PLUMBING = '22222222-2222-4222-8222-222222222222';
const SKILL_WIRING = '33333333-3333-4333-8333-333333333333';
const SKILL_PLUMBING = '44444444-4444-4444-8444-444444444444';
const SKILL_RETIRED = '55555555-5555-4555-8555-555555555555';

function createPrismaMock() {
  const users = new Map<
    string,
    { id: string; role: UserRole; email: string | null; isActive: boolean }
  >();
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
  const cooperatives = new Map<
    string,
    {
      id: string;
      name: string;
      registrationNo: string | null;
      description: string | null;
      location: string | null;
      operatingArea: string | null;
      contactEmail: string | null;
      contactPhone: string | null;
      status: CooperativeStatus;
      adminUserId: string | null;
    }
  >();
  const memberships = new Map<
    string,
    { cooperativeId: string; workerId: string; role: string; joinedAt: Date; leftAt: Date | null }
  >();
  const skillCategories = new Map<
    string,
    { id: string; name: string; description: string | null; active: boolean }
  >();
  const skills = new Map<
    string,
    {
      id: string;
      name: string;
      description: string | null;
      categoryId: string | null;
      active: boolean;
    }
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
    [...workers.values()].find((w) => w.userId === userId) ?? null;
  const workerSkillById = (id: string) => workerSkills.get(id) ?? null;
  const experienceById = (id: string) => experiences.get(id) ?? null;
  const evidenceById = (id: string) => evidence.get(id) ?? null;
  const certificateById = (id: string) => certificates.get(id) ?? null;
  const verificationById = (id: string) => verifications.get(id) ?? null;
  const membershipFor = (workerId: string, cooperativeId: string) =>
    [...memberships.values()].find(
      (m) => m.workerId === workerId && m.cooperativeId === cooperativeId && !m.leftAt,
    ) ?? null;

  const item_admin = (c: { adminUserId: string | null }) => {
    const u = c.adminUserId ? users.get(c.adminUserId) : null;
    return u ? { id: u.id, email: u.email } : null;
  };
  const member_worker = (w: {
    id: string;
    userId: string;
    fullName: string | null;
    location: string | null;
    yearsExperience: number | null;
    availability: WorkerAvailability | null;
  }) => {
    const u = users.get(w.userId);
    return {
      id: w.id,
      userId: w.userId,
      fullName: w.fullName,
      location: w.location,
      yearsExperience: w.yearsExperience,
      availability: w.availability,
      user: u ? { id: u.id, email: u.email, isActive: u.isActive } : null,
      skills: [...workerSkills.values()]
        .filter((s) => s.workerId === w.id)
        .map((s) => ({
          id: s.id,
          verificationStatus: s.verificationStatus,
          skill: {
            id: s.skillId,
            name: skills.get(s.skillId)?.name ?? '',
            category: skills.get(s.skillId)?.categoryId
              ? { name: skillCategories.get(skills.get(s.skillId)!.categoryId!)?.name ?? '' }
              : null,
          },
        })),
      memberships: [...memberships.values()]
        .filter((m) => m.workerId === w.id)
        .map((m) => ({
          cooperativeId: m.cooperativeId,
          role: m.role,
          joinedAt: m.joinedAt,
          leftAt: m.leftAt,
        })),
    };
  };

  const mock: Record<string, unknown> = {
    user: {
      findUnique: jest.fn(async ({ where }: { where: { id: string } }) => {
        const u = users.get(where.id);
        return u ? { ...u } : null;
      }),
    },
    worker: {
      findUnique: jest.fn(async ({ where }: { where: { id?: string; userId?: string } }) => {
        const w = where.id
          ? workers.get(where.id)
          : where.userId
            ? workerByUserId(where.userId)
            : null;
        if (!w) return null;
        return {
          ...w,
          skills: [...workerSkills.values()]
            .filter((s) => s.workerId === w.id)
            .map((s) => ({ id: s.id })),
          experiences: [...experiences.values()]
            .filter((e) => e.workerId === w.id)
            .map((e) => ({ id: e.id })),
        };
      }),
      update: jest.fn(
        async ({ where, data }: { where: { userId: string }; data: Record<string, unknown> }) => {
          const w = workerByUserId(where.userId);
          if (!w) throw new Error('Worker not found');
          Object.assign(w, data);
          return {
            ...w,
            skills: [...workerSkills.values()]
              .filter((s) => s.workerId === w.id)
              .map((s) => ({ id: s.id })),
            experiences: [...experiences.values()]
              .filter((e) => e.workerId === w.id)
              .map((e) => ({ id: e.id })),
          };
        },
      ),
    },
    cooperative: {
      findUnique: jest.fn(async ({ where }: { where: { id: string } }) => {
        const c = cooperatives.get(where.id);
        return c ? { ...c } : null;
      }),
      findFirst: jest.fn(async ({ where }: { where: { id?: string; adminUserId?: string } }) => {
        const c = [...cooperatives.values()].find((item) => {
          if (where.id && item.id !== where.id) return false;
          if (where.adminUserId && item.adminUserId !== where.adminUserId) return false;
          return true;
        });
        return c
          ? {
              ...c,
              admin: item_admin(c),
              _count: {
                memberships: [...memberships.values()].filter(
                  (m) => m.cooperativeId === (c as { id: string }).id && !m.leftAt,
                ).length,
              },
            }
          : null;
      }),
      findMany: jest.fn(async ({ where }: { where: { adminUserId?: string } }) =>
        [...cooperatives.values()]
          .filter((c) => (where.adminUserId ? c.adminUserId === where.adminUserId : true))
          .map((c) => ({
            ...c,
            admin: item_admin(c),
            _count: {
              memberships: [...memberships.values()].filter(
                (m) => m.cooperativeId === c.id && !m.leftAt,
              ).length,
            },
          })),
      ),
      update: jest.fn(
        async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
          const c = cooperatives.get(where.id);
          if (!c) throw new Error('Cooperative not found');
          Object.assign(c, data);
          return {
            ...c,
            admin: item_admin(c),
            _count: {
              memberships: [...memberships.values()].filter(
                (m) => m.cooperativeId === c.id && !m.leftAt,
              ).length,
            },
          };
        },
      ),
    },
    cooperativeMembership: {
      findFirst: jest.fn(
        async ({
          where,
        }: {
          where: { cooperativeId: string; workerId?: string; leftAt?: null | { not: null } };
        }) => {
          const m = [...memberships.values()].find((item) => {
            if (item.cooperativeId !== where.cooperativeId) return false;
            if (where.workerId && item.workerId !== where.workerId) return false;
            if (where.leftAt === null && item.leftAt) return false;
            if (where.leftAt && 'not' in where.leftAt && !item.leftAt) return false;
            return true;
          });
          if (!m) return null;
          const w = workers.get(m.workerId);
          return { ...m, worker: w ? member_worker(w) : null };
        },
      ),
      findMany: jest.fn(
        async ({ where }: { where: { cooperativeId: string; leftAt?: null | { not: null } } }) =>
          [...memberships.values()]
            .filter((item) => {
              if (item.cooperativeId !== where.cooperativeId) return false;
              if (where.leftAt === null && item.leftAt) return false;
              if (where.leftAt && 'not' in where.leftAt && !item.leftAt) return false;
              return true;
            })
            .map((m) => {
              const w = workers.get(m.workerId);
              return { ...m, worker: w ? member_worker(w) : null };
            }),
      ),
    },
    skillCategory: {
      findUnique: jest.fn(async ({ where }: { where: { id: string } }) => {
        const c = skillCategories.get(where.id);
        return c ? { ...c } : null;
      }),
      findMany: jest.fn(async ({ where }: { where: { active?: boolean } }) =>
        [...skillCategories.values()]
          .filter((c) => (where.active !== undefined ? c.active === where.active : true))
          .map((c) => ({
            ...c,
            _count: { skills: [...skills.values()].filter((s) => s.categoryId === c.id).length },
          })),
      ),
    },
    skill: {
      findUnique: jest.fn(async ({ where }: { where: { id: string } }) => {
        const s = skills.get(where.id);
        return s ? { ...s } : null;
      }),
      findMany: jest.fn(
        async ({
          where,
        }: {
          where: {
            active?: boolean;
            categoryId?: string;
            name?: { contains: string; mode: string };
          };
        }) =>
          [...skills.values()]
            .filter((s) => {
              if (where.active !== undefined && s.active !== where.active) return false;
              if (where.categoryId !== undefined && s.categoryId !== where.categoryId) return false;
              if (where.name && !s.name.toLowerCase().includes(where.name.contains.toLowerCase()))
                return false;
              return true;
            })
            .map((s) => ({
              ...s,
              category: s.categoryId ? (skillCategories.get(s.categoryId) ?? null) : null,
              _count: {
                workerSkills: [...workerSkills.values()].filter((ws) => ws.skillId === s.id).length,
              },
            })),
      ),
      create: jest.fn(
        async ({
          data,
        }: {
          data: {
            name: string;
            description: string | null;
            categoryId: string | null;
            active: boolean;
          };
        }) => {
          const id = nextId('skill');
          const s = {
            id,
            name: data.name,
            description: data.description ?? null,
            categoryId: data.categoryId ?? null,
            active: data.active,
          };
          skills.set(id, s);
          return {
            ...s,
            category: s.categoryId ? (skillCategories.get(s.categoryId) ?? null) : null,
            _count: { workerSkills: 0 },
          };
        },
      ),
      update: jest.fn(
        async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
          const s = skills.get(where.id);
          if (!s) throw new Error('Skill not found');
          Object.assign(s, data);
          return {
            ...s,
            category: s.categoryId ? (skillCategories.get(s.categoryId) ?? null) : null,
            _count: {
              workerSkills: [...workerSkills.values()].filter((ws) => ws.skillId === s.id).length,
            },
          };
        },
      ),
    },
    workerSkill: {
      findMany: jest.fn(async ({ where }: { where: { workerId: string } }) =>
        [...workerSkills.values()]
          .filter((s) => s.workerId === where.workerId)
          .map((s) => ({
            ...s,
            skill: skills.get(s.skillId) ?? null,
            verifications: [],
            _count: { certificates: 0, evidence: 0 },
          })),
      ),
      findUnique: jest.fn(async ({ where }: { where: { id: string } }) => {
        const s = workerSkillById(where.id);
        return s ? { ...s, worker: { userId: workers.get(s.workerId)?.userId } } : null;
      }),
      findFirst: jest.fn(async ({ where }: { where: { id: string; workerId?: string } }) => {
        const s = workerSkillById(where.id);
        if (!s) return null;
        if (where.workerId && s.workerId !== where.workerId) return null;
        return { ...s };
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
          const s = {
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
          workerSkills.set(id, s);
          return {
            ...s,
            skill: skills.get(data.skillId) ?? null,
            verifications: [],
            _count: { certificates: 0, evidence: 0 },
          };
        },
      ),
      update: jest.fn(
        async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
          const s = workerSkillById(where.id);
          if (!s) throw new Error('WorkerSkill not found');
          Object.assign(s, data);
          return {
            ...s,
            skill: skills.get(s.skillId) ?? null,
            verifications: [],
            _count: { certificates: 0, evidence: 0 },
          };
        },
      ),
      delete: jest.fn(async ({ where }: { where: { id: string } }) => {
        const s = workerSkillById(where.id);
        if (!s) throw new Error('WorkerSkill not found');
        workerSkills.delete(where.id);
        return { ...s };
      }),
    },
    workerExperience: {
      findMany: jest.fn(async ({ where }: { where: { workerId: string } }) =>
        [...experiences.values()]
          .filter((e) => e.workerId === where.workerId)
          .map((e) => ({ ...e })),
      ),
      findUnique: jest.fn(async ({ where }: { where: { id: string } }) => {
        const e = experienceById(where.id);
        return e ? { ...e, worker: { userId: workers.get(e.workerId)?.userId } } : null;
      }),
      findFirst: jest.fn(
        async ({ where }: { where: { id: string; worker?: { userId: string } } }) => {
          const e = experienceById(where.id);
          if (!e) return null;
          if (where.worker && workers.get(e.workerId)?.userId !== where.worker.userId) return null;
          return { ...e };
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
          const e = {
            id,
            workerId: data.workerId,
            title: data.title,
            organization: data.organization ?? null,
            startDate: data.startDate ?? null,
            endDate: data.isCurrent ? null : (data.endDate ?? null),
            isCurrent: data.isCurrent,
            description: data.description ?? null,
            relevantSkills: data.relevantSkills ?? [],
          };
          experiences.set(id, e);
          return { ...e };
        },
      ),
      update: jest.fn(
        async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
          const e = experienceById(where.id);
          if (!e) throw new Error('Experience not found');
          Object.assign(e, data);
          return { ...e };
        },
      ),
      delete: jest.fn(async ({ where }: { where: { id: string } }) => {
        const e = experienceById(where.id);
        if (!e) throw new Error('Experience not found');
        experiences.delete(where.id);
        return { ...e };
      }),
    },
    skillEvidence: {
      findMany: jest.fn(async ({ where }: { where: { workerSkill: { workerId: string } } }) =>
        [...evidence.values()]
          .filter((item) => {
            const ws = workerSkillById(item.workerSkillId);
            return ws?.workerId === where.workerSkill.workerId;
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
        const ws = workerSkillById(item.workerSkillId);
        return {
          ...item,
          workerSkill: { worker: { userId: workers.get(ws?.workerId ?? '')?.userId } },
        };
      }),
      findFirst: jest.fn(
        async ({ where }: { where: { id: string; workerSkill: { workerId: string } } }) => {
          const item = evidenceById(where.id);
          if (!item) return null;
          const ws = workerSkillById(item.workerSkillId);
          if (ws?.workerId !== where.workerSkill.workerId) return null;
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
            const ws = workerSkillById(item.workerSkillId);
            return ws?.workerId === where.workerSkill.workerId;
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
        const ws = workerSkillById(item.workerSkillId);
        return {
          ...item,
          workerSkill: { worker: { userId: workers.get(ws?.workerId ?? '')?.userId } },
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
          where: { workerSkillId: string; status?: { in: SkillVerificationStatus[] } };
        }) => {
          const item = [...verifications.values()].find(
            (v) =>
              v.workerSkillId === where.workerSkillId &&
              (!where.status || where.status.in.includes(v.status)),
          );
          return item ? { id: item.id } : null;
        },
      ),
      findUnique: jest.fn(async ({ where }: { where: { id: string } }) => {
        const item = verificationById(where.id);
        if (!item) return null;
        const ws = workerSkillById(item.workerSkillId);
        return { ...item, workerSkill: { workerId: ws?.workerId ?? null } };
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
          const items = [...verifications.values()].filter((v) => {
            if (where.status && !where.status.in.includes(v.status)) return false;
            if (where.requestedByWorkerId && v.requestedByWorkerId !== where.requestedByWorkerId)
              return false;
            if (where.workerSkill) {
              const ws = workerSkillById(v.workerSkillId);
              if (!ws) return false;
              if (
                !membershipFor(ws.workerId, where.workerSkill.worker.memberships.some.cooperativeId)
              )
                return false;
            }
            return true;
          });
          return items.map((item) => {
            const ws = workerSkillById(item.workerSkillId);
            return {
              ...item,
              workerSkill: {
                skill: skills.get(ws?.skillId ?? '') ?? null,
                worker: {
                  id: ws?.workerId ?? '',
                  fullName: workers.get(ws?.workerId ?? '')?.fullName ?? null,
                  userId: workers.get(ws?.workerId ?? '')?.userId ?? '',
                },
                proficiency: ws?.proficiency ?? SkillProficiency.INTERMEDIATE,
                experienceYears: ws?.experienceYears ?? 0,
                experienceSummary: ws?.experienceSummary ?? null,
                evidenceReference: ws?.evidenceReference ?? null,
                certificates: [],
                evidence: [],
              },
              requestedByWorker: item.requestedByWorkerId ? { id: item.requestedByWorkerId } : null,
              verifiedBy: item.verifiedById ? { id: item.verifiedById } : null,
            };
          });
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
          const ws = workerSkillById(data.workerSkillId);
          return {
            ...item,
            workerSkill: {
              skill: skills.get(ws?.skillId ?? '') ?? null,
              worker: {
                id: ws?.workerId ?? '',
                fullName: workers.get(ws?.workerId ?? '')?.fullName ?? null,
                userId: workers.get(ws?.workerId ?? '')?.userId ?? '',
              },
              proficiency: ws?.proficiency ?? SkillProficiency.INTERMEDIATE,
              experienceYears: ws?.experienceYears ?? 0,
              experienceSummary: ws?.experienceSummary ?? null,
              evidenceReference: ws?.evidenceReference ?? null,
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
          const ws = workerSkillById(item.workerSkillId);
          return {
            ...item,
            workerSkill: {
              skill: skills.get(ws?.skillId ?? '') ?? null,
              worker: {
                id: ws?.workerId ?? '',
                fullName: workers.get(ws?.workerId ?? '')?.fullName ?? null,
                userId: workers.get(ws?.workerId ?? '')?.userId ?? '',
              },
              proficiency: ws?.proficiency ?? SkillProficiency.INTERMEDIATE,
              experienceYears: ws?.experienceYears ?? 0,
              experienceSummary: ws?.experienceSummary ?? null,
              evidenceReference: ws?.evidenceReference ?? null,
              certificates: [],
              evidence: [],
            },
            requestedByWorker: item.requestedByWorkerId ? { id: item.requestedByWorkerId } : null,
            verifiedBy: item.verifiedById ? { id: item.verifiedById } : null,
          };
        },
      ),
    },
    $transaction: jest.fn(async (cb: (t: unknown) => Promise<unknown>) => cb(mock)),
  };

  (mock as { __seed: Record<string, unknown> }).__seed = {
    addUser: (id: string, role: UserRole, email: string | null = null) => {
      users.set(id, { id, role, email, isActive: true });
    },
    addWorker: (id: string, userId: string, data: Record<string, unknown> = {}) => {
      workers.set(id, {
        id,
        userId,
        fullName: (data.fullName as string | null) ?? null,
        profilePhotoUrl: null,
        bio: null,
        location: (data.location as string | null) ?? null,
        educationQualification: null,
        educationInstitution: null,
        educationYear: null,
        yearsExperience: (data.yearsExperience as number | null) ?? null,
        availability: (data.availability as WorkerAvailability | null) ?? null,
        languages: [],
      });
    },
    addCooperative: (
      id: string,
      adminUserId: string | null,
      data: Record<string, unknown> = {},
    ) => {
      cooperatives.set(id, {
        id,
        name: (data.name as string) ?? 'Cooperative',
        registrationNo: (data.registrationNo as string | null) ?? null,
        description: (data.description as string | null) ?? null,
        location: (data.location as string | null) ?? null,
        operatingArea: (data.operatingArea as string | null) ?? null,
        contactEmail: (data.contactEmail as string | null) ?? null,
        contactPhone: (data.contactPhone as string | null) ?? null,
        status: (data.status as CooperativeStatus) ?? CooperativeStatus.ACTIVE,
        adminUserId,
      });
    },
    addMembership: (workerId: string, cooperativeId: string, leftAt: Date | null = null) => {
      memberships.set(`${workerId}:${cooperativeId}`, {
        cooperativeId,
        workerId,
        role: 'MEMBER',
        joinedAt: new Date('2024-01-01'),
        leftAt,
      });
    },
    addCategory: (id: string, name: string, active = true) => {
      skillCategories.set(id, { id, name, description: null, active });
    },
    addSkill: (id: string, name: string, categoryId: string | null = null, active = true) => {
      skills.set(id, { id, name, description: null, categoryId, active });
    },
    addWorkerSkill: (
      id: string,
      workerId: string,
      skillId: string,
      verificationStatus: SkillVerificationStatus = SkillVerificationStatus.NOT_VERIFIED,
    ) => {
      workerSkills.set(id, {
        id,
        workerId,
        skillId,
        proficiency: SkillProficiency.INTERMEDIATE,
        experienceYears: 0,
        experienceSummary: null,
        evidenceReference: null,
        verificationStatus,
        verificationRequestedAt: null,
        verifiedAt: null,
        verifiedByUserId: null,
      });
    },
    addVerification: (
      id: string,
      workerSkillId: string,
      requestedByWorkerId: string,
      status: SkillVerificationStatus = SkillVerificationStatus.PENDING,
    ) => {
      verifications.set(id, {
        id,
        workerSkillId,
        requestedByWorkerId,
        verifiedById: null,
        method: VerificationMethod.EXPERIENCE_EVIDENCE,
        status,
        notes: null,
        evidenceReference: null,
        assessmentReference: null,
        requestedAt: new Date(),
        reviewedAt: null,
      });
    },
  };
  return mock;
}

type PrismaMock = ReturnType<typeof createPrismaMock>;
type SeedFn = (...args: unknown[]) => void;

describe('Step 5 — Cooperative management, members, and skill catalog', () => {
  let app: INestApplication;
  let jwt: JwtService;
  let prisma: PrismaMock;

  beforeAll(async () => {
    process.env.JWT_ACCESS_SECRET = ACCESS_SECRET;
    prisma = createPrismaMock();
    const seed = (prisma as unknown as { __seed: Record<string, SeedFn> }).__seed;
    seed.addUser('admin-user-a', UserRole.COOPERATIVE_ADMIN, 'admin-a@example.com');
    seed.addUser('admin-user-b', UserRole.COOPERATIVE_ADMIN, 'admin-b@example.com');
    seed.addUser('worker-user-a', UserRole.WORKER);
    seed.addUser('worker-user-b', UserRole.WORKER);
    seed.addUser('customer-user', UserRole.CUSTOMER);
    seed.addWorker('worker-a', 'worker-user-a', {
      fullName: 'Aarav Kumar',
      location: 'Pune',
      yearsExperience: 12,
      availability: WorkerAvailability.AVAILABLE,
    });
    seed.addWorker('worker-b', 'worker-user-b', { fullName: 'Meera Nair', location: 'Kochi' });
    seed.addCooperative('cooperative-a', 'admin-user-a', {
      name: 'Pune Plumbers Collective',
      registrationNo: 'REG-001',
      description: 'A worker-owned plumbing cooperative',
      location: 'Pune',
      operatingArea: 'Maharashtra',
      contactEmail: 'hello@puneplumbers.test',
      contactPhone: '+91-20-12345678',
    });
    seed.addCooperative('cooperative-b', 'admin-user-b', {
      name: 'Kochi Electricians Guild',
      registrationNo: 'REG-002',
    });
    seed.addMembership('worker-a', 'cooperative-a');
    seed.addMembership('worker-b', 'cooperative-b');
    seed.addCategory(CAT_ELECTRICAL, 'Electrical');
    seed.addCategory(CAT_PLUMBING, 'Plumbing');
    seed.addSkill(SKILL_WIRING, 'Electrical Wiring', CAT_ELECTRICAL);
    seed.addSkill(SKILL_PLUMBING, 'Plumbing Repair', CAT_PLUMBING);
    seed.addSkill(SKILL_RETIRED, 'Deprecated Skill', null, false);
    seed.addWorkerSkill('ws-a', 'worker-a', SKILL_PLUMBING, SkillVerificationStatus.VERIFIED);
    seed.addWorkerSkill('ws-b', 'worker-b', SKILL_WIRING, SkillVerificationStatus.PENDING);
    seed.addVerification('verification-b', 'ws-b', 'worker-b', SkillVerificationStatus.PENDING);

    const moduleRef = await Test.createTestingModule({
      imports: [JwtModule.register({})],
      controllers: [
        CooperativesController,
        SkillsController,
        WorkersController,
        SkillVerificationController,
      ],
      providers: [
        CooperativesService,
        SkillsService,
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
  const http = () => request(app.getHttpServer());
  const accessToken = async (userId: string, role: UserRole) =>
    jwt.signAsync({ sub: userId, role, type: 'access' }, { secret: ACCESS_SECRET });

  describe('Cooperative management', () => {
    it('PASS: admin can view own cooperative', async () => {
      const token = await accessToken('admin-user-a', UserRole.COOPERATIVE_ADMIN);
      const res = await http()
        .get('/api/v1/cooperatives/cooperative-a')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(res.body).toMatchObject({
        id: 'cooperative-a',
        name: 'Pune Plumbers Collective',
        registrationNo: 'REG-001',
        description: 'A worker-owned plumbing cooperative',
        location: 'Pune',
        operatingArea: 'Maharashtra',
        contactEmail: 'hello@puneplumbers.test',
        contactPhone: '+91-20-12345678',
        status: CooperativeStatus.ACTIVE,
        memberCount: 1,
      });
    });
    it('PASS: admin can update own cooperative', async () => {
      const token = await accessToken('admin-user-a', UserRole.COOPERATIVE_ADMIN);
      const res = await http()
        .patch('/api/v1/cooperatives/cooperative-a')
        .set('Authorization', `Bearer ${token}`)
        .send({ description: 'Updated description', contactPhone: '+91-20-99999999' })
        .expect(200);
      expect(res.body.description).toBe('Updated description');
      expect(res.body.contactPhone).toBe('+91-20-99999999');
      expect(res.body.name).toBe('Pune Plumbers Collective');
    });
    it('PASS: admin cannot access another cooperative (403)', async () => {
      const token = await accessToken('admin-user-a', UserRole.COOPERATIVE_ADMIN);
      await http()
        .get('/api/v1/cooperatives/cooperative-b')
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
    });
    it('PASS: worker cannot manage cooperative profile (403)', async () => {
      const token = await accessToken('worker-user-a', UserRole.WORKER);
      await http()
        .get('/api/v1/cooperatives/cooperative-a')
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
    });
    it('PASS: customer cannot manage cooperative profile (403)', async () => {
      const token = await accessToken('customer-user', UserRole.CUSTOMER);
      await http()
        .get('/api/v1/cooperatives/cooperative-a')
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
    });
  });

  describe('Member management', () => {
    it('PASS: admin can list own members', async () => {
      const token = await accessToken('admin-user-a', UserRole.COOPERATIVE_ADMIN);
      const res = await http()
        .get('/api/v1/cooperatives/cooperative-a/members')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(res.body.length).toBe(1);
      expect(res.body[0]).toMatchObject({
        workerId: 'worker-a',
        fullName: 'Aarav Kumar',
        membershipStatus: 'ACTIVE',
        verifiedSkillCount: 1,
      });
    });
    it('PASS: admin can view member details', async () => {
      const token = await accessToken('admin-user-a', UserRole.COOPERATIVE_ADMIN);
      const res = await http()
        .get('/api/v1/cooperatives/cooperative-a/members/worker-a')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(res.body).toMatchObject({
        workerId: 'worker-a',
        fullName: 'Aarav Kumar',
        skillCount: 1,
      });
      expect(res.body.skills[0]).toMatchObject({
        name: 'Plumbing Repair',
        verificationStatus: SkillVerificationStatus.VERIFIED,
      });
    });
    it('PASS: cross-cooperative member access returns 403', async () => {
      const token = await accessToken('admin-user-a', UserRole.COOPERATIVE_ADMIN);
      await http()
        .get('/api/v1/cooperatives/cooperative-a/members/worker-b')
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
    });
    it('PASS: forged cooperativeId cannot bypass scope', async () => {
      const token = await accessToken('admin-user-a', UserRole.COOPERATIVE_ADMIN);
      await http()
        .get('/api/v1/cooperatives/cooperative-b/members/worker-b')
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
    });
  });

  describe('Skill catalog', () => {
    it('PASS: worker can read active skill catalog', async () => {
      const token = await accessToken('worker-user-a', UserRole.WORKER);
      const res = await http()
        .get('/api/v1/skills')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      const names = res.body.map((s: { name: string }) => s.name);
      expect(names).toContain('Electrical Wiring');
      expect(names).toContain('Plumbing Repair');
      expect(names).not.toContain('Deprecated Skill');
    });
    it('PASS: admin can create skill', async () => {
      const token = await accessToken('admin-user-a', UserRole.COOPERATIVE_ADMIN);
      const res = await http()
        .post('/api/v1/skills')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Pipe Installation', categoryId: CAT_PLUMBING })
        .expect(201);
      expect(res.body).toMatchObject({
        name: 'Pipe Installation',
        active: true,
        category: { id: CAT_PLUMBING, name: 'Plumbing' },
      });
    });
    it('PASS: admin can update skill', async () => {
      const token = await accessToken('admin-user-a', UserRole.COOPERATIVE_ADMIN);
      const res = await http()
        .patch(`/api/v1/skills/${SKILL_WIRING}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ description: 'Updated wiring description' })
        .expect(200);
      expect(res.body.description).toBe('Updated wiring description');
    });
    it('PASS: admin can deactivate skill', async () => {
      const token = await accessToken('admin-user-a', UserRole.COOPERATIVE_ADMIN);
      const res = await http()
        .patch(`/api/v1/skills/${SKILL_WIRING}/status`)
        .set('Authorization', `Bearer ${token}`)
        .send({ active: false })
        .expect(200);
      expect(res.body.active).toBe(false);
    });
    it('PASS: worker cannot modify catalog (403)', async () => {
      const token = await accessToken('worker-user-a', UserRole.WORKER);
      await http()
        .post('/api/v1/skills')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Hacked Skill' })
        .expect(403);
    });
    it('PASS: customer cannot modify catalog (403)', async () => {
      const token = await accessToken('customer-user', UserRole.CUSTOMER);
      await http()
        .post('/api/v1/skills')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Hacked Skill' })
        .expect(403);
    });
    it('PASS: inactive skill cannot be newly selected', async () => {
      const token = await accessToken('worker-user-a', UserRole.WORKER);
      await http()
        .post('/api/v1/workers/me/skills')
        .set('Authorization', `Bearer ${token}`)
        .send({
          skillId: SKILL_RETIRED,
          proficiency: SkillProficiency.BEGINNER,
          experienceYears: 1,
        })
        .expect(404);
    });
  });

  describe('Step 4 regression', () => {
    it('PASS: existing worker skills still work', async () => {
      const token = await accessToken('worker-user-a', UserRole.WORKER);
      const res = await http()
        .get('/api/v1/workers/me/skills')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(res.body.length).toBe(1);
      expect(res.body[0].skill.name).toBe('Plumbing Repair');
    });
    it('PASS: existing verification requests still work', async () => {
      const token = await accessToken('worker-user-b', UserRole.WORKER);
      const res = await http()
        .get('/api/v1/workers/me/verification-requests')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(res.body.length).toBe(1);
      expect(res.body[0].status).toBe(SkillVerificationStatus.PENDING);
    });
    it('PASS: certificate submission still does not auto-verify', async () => {
      const token = await accessToken('worker-user-a', UserRole.WORKER);
      await http()
        .post('/api/v1/workers/me/skills/ws-a/certificates')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Extra Certificate', issuer: 'Test Issuer' })
        .expect(201);
      const skills = await http()
        .get('/api/v1/workers/me/skills')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(skills.body[0].verificationStatus).toBe(SkillVerificationStatus.VERIFIED);
    });
    it('PASS: experience still does not auto-verify', async () => {
      const token = await accessToken('worker-user-b', UserRole.WORKER);
      await http()
        .post('/api/v1/workers/me/experiences')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'New wiring job', isCurrent: true })
        .expect(201);
      const skills = await http()
        .get('/api/v1/workers/me/skills')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(skills.body[0].verificationStatus).toBe(SkillVerificationStatus.PENDING);
    });
    it('PASS: proficiency changes still do not auto-verify', async () => {
      const token = await accessToken('worker-user-b', UserRole.WORKER);
      const res = await http()
        .patch('/api/v1/workers/me/skills/ws-b')
        .set('Authorization', `Bearer ${token}`)
        .send({ proficiency: SkillProficiency.EXPERT })
        .expect(200);
      expect(res.body.proficiency).toBe(SkillProficiency.EXPERT);
      expect(res.body.verificationStatus).toBe(SkillVerificationStatus.PENDING);
    });
    it('PASS: cooperative verification scope still works', async () => {
      const token = await accessToken('admin-user-b', UserRole.COOPERATIVE_ADMIN);
      const res = await http()
        .get('/api/v1/cooperatives/cooperative-b/verification-requests')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(res.body.length).toBe(1);
      expect(res.body[0].worker.id).toBe('worker-b');
    });
    it('PASS: admin cannot modify protected ownership fields (400)', async () => {
      const token = await accessToken('admin-user-a', UserRole.COOPERATIVE_ADMIN);
      await http()
        .patch('/api/v1/cooperatives/cooperative-a')
        .set('Authorization', `Bearer ${token}`)
        .send({ adminUserId: '00000000-0000-0000-0000-000000000000' })
        .expect(400);
    });
    it('PASS: skill deactivation preserves historical WorkerSkill records', async () => {
      // worker-b has ws-b linked to SKILL_WIRING (PENDING). Deactivate the skill.
      const adminToken = await accessToken('admin-user-b', UserRole.COOPERATIVE_ADMIN);
      await http()
        .patch(`/api/v1/skills/${SKILL_WIRING}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ active: false })
        .expect(200);

      // The worker's existing WorkerSkill record must survive deactivation.
      const res = await http()
        .get('/api/v1/cooperatives/cooperative-b/members/worker-b')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      const wiring = res.body.skills.find(
        (skill: { name: string }) => skill.name === 'Electrical Wiring',
      );
      expect(wiring).toBeDefined();
      expect(wiring.verificationStatus).toBe(SkillVerificationStatus.PENDING);
    });
  });
});
