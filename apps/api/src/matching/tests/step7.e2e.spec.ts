process.env.DATABASE_URL =
  process.env.DATABASE_URL ??
  'postgresql://platform_user:MyLocalPassword123@localhost:5432/cooperative_gig_platform?schema=public';
process.env.JWT_ACCESS_SECRET =
  process.env.JWT_ACCESS_SECRET ?? 'access-secret-for-step7-tests-at-least-32-chars';
process.env.JWT_REFRESH_SECRET =
  process.env.JWT_REFRESH_SECRET ?? 'refresh-secret-for-step7-tests-at-least-32-ch';

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import {
  ServiceRequestStatus,
  SkillProficiency,
  SkillVerificationStatus,
  UserRole,
  WorkerAvailability,
} from '@prisma/client';
import request from 'supertest';
import { AuthModule } from '../../auth/auth.module';
import { AuthenticationGuard } from '../../auth/guards/authentication.guard';
import { OwnershipGuard } from '../../auth/guards/ownership.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { PrismaService } from '../../database/prisma.service';
import { WorkerDiscoveryController } from '../matching.controller';
import { WorkerMatchingService } from '../matching.service';
import { PROXIMITY_THRESHOLD_KM } from '../utils/coordinate.utils';

/**
 * Step 7 end-to-end tests run against the real PostgreSQL database.
 * All records use a unique suffix and are cleaned up in afterAll.
 */
describe('WorkerDiscoveryController (Step 7, real database)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;

  const suffix = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const createdUserIds: string[] = [];
  const createdSkillIds: string[] = [];
  const createdWorkerIds: string[] = [];

  let customerAToken: string;
  let customerBToken: string;
  let workerToken: string;
  let adminToken: string;
  let adminUserId: string;
  let customerACustomerId: string;

  let verifiedWorkerUserId: string;
  let verifiedWorkerId: string;

  let activeSkillId: string;
  let inactiveSkillId: string;
  let cooperativeId: string;
  let requestId: string;

  const createWorker = async (
    availability: WorkerAvailability | null,
    isActive: boolean,
  ): Promise<{ userId: string; workerId: string }> => {
    const user = await prisma.user.create({
      data: {
        mobile:
          `9800${createdUserIds.length}${availability?.length ?? 1}${isActive ? 1 : 0}${suffix}`.slice(
            0,
            15,
          ),
        passwordHash: 'test-hash-not-a-real-password',
        role: UserRole.WORKER,
        isActive,
      },
    });
    createdUserIds.push(user.id);
    const worker = await prisma.worker.create({
      data: {
        userId: user.id,
        fullName: `Test Worker ${createdUserIds.length}`,
        location: 'Pune',
        availability,
      },
    });
    createdWorkerIds.push(worker.id);
    return { userId: user.id, workerId: worker.id };
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AuthModule, JwtModule.register({ secret: process.env.JWT_ACCESS_SECRET })],
      controllers: [WorkerDiscoveryController],
      providers: [WorkerMatchingService],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }),
    );
    app.useGlobalGuards(
      app.get(AuthenticationGuard, { strict: false }),
      app.get(RolesGuard, { strict: false }),
      app.get(OwnershipGuard, { strict: false }),
    );
    await app.init();

    prisma = app.get(PrismaService);
    jwtService = app.get(JwtService);

    const mint = (userId: string, role: UserRole) =>
      jwtService.sign({ sub: userId, role, type: 'access' });

    const customerA = await prisma.user.create({
      data: {
        mobile: `9700${suffix}`.slice(0, 15),
        passwordHash: 'test-hash-not-a-real-password',
        role: UserRole.CUSTOMER,
      },
    });
    createdUserIds.push(customerA.id);
    const customerARecord = await prisma.customer.create({ data: { userId: customerA.id } });
    customerACustomerId = customerARecord.id;
    customerAToken = mint(customerA.id, UserRole.CUSTOMER);

    const customerB = await prisma.user.create({
      data: {
        mobile: `9701${suffix}`.slice(0, 15),
        passwordHash: 'test-hash-not-a-real-password',
        role: UserRole.CUSTOMER,
      },
    });
    createdUserIds.push(customerB.id);
    await prisma.customer.create({ data: { userId: customerB.id } });
    customerBToken = mint(customerB.id, UserRole.CUSTOMER);

    const workerUser = await prisma.user.create({
      data: {
        mobile: `9702${suffix}`.slice(0, 15),
        passwordHash: 'test-hash-not-a-real-password',
        role: UserRole.WORKER,
      },
    });
    createdUserIds.push(workerUser.id);
    await prisma.worker.create({ data: { userId: workerUser.id } });
    workerToken = mint(workerUser.id, UserRole.WORKER);

    const admin = await prisma.user.create({
      data: {
        mobile: `9703${suffix}`.slice(0, 15),
        passwordHash: 'test-hash-not-a-real-password',
        role: UserRole.COOPERATIVE_ADMIN,
      },
    });
    createdUserIds.push(admin.id);
    adminUserId = admin.id;
    adminToken = mint(admin.id, UserRole.COOPERATIVE_ADMIN);

    const activeSkill = await prisma.skill.create({
      data: { name: `Matching Skill ${suffix}`, active: true },
    });
    activeSkillId = activeSkill.id;
    createdSkillIds.push(activeSkill.id);

    const retired = await prisma.skill.create({
      data: { name: `Retired Skill ${suffix}`, active: false },
    });
    inactiveSkillId = retired.id;
    createdSkillIds.push(retired.id);

    const cooperative = await prisma.cooperative.create({
      data: { name: `Match Coop ${suffix}`, adminUserId: admin.id },
    });
    cooperativeId = cooperative.id;
  });

  /** Seed the full eligibility matrix inside beforeAll of each suite case. */
  let seeded = false;

  const seedEligibilityMatrix = async () => {
    if (seeded) return;
    seeded = true;

    // Active + verified + valid membership -> should be returned.
    const v = await createWorker(WorkerAvailability.AVAILABLE, true);
    verifiedWorkerUserId = v.userId;
    verifiedWorkerId = v.workerId;
    await prisma.workerSkill.create({
      data: {
        workerId: v.workerId,
        skillId: activeSkillId,
        proficiency: SkillProficiency.ADVANCED,
        experienceYears: 8,
        verificationStatus: SkillVerificationStatus.VERIFIED,
      },
    });
    await prisma.cooperativeMembership.create({
      data: { cooperativeId, workerId: v.workerId, role: 'MEMBER' },
    });

    // Same worker also has a certificate on a DIFFERENT unverified skill record.
    await prisma.workerSkill.create({
      data: {
        workerId: v.workerId,
        skillId: inactiveSkillId,
        proficiency: SkillProficiency.BEGINNER,
        experienceYears: 1,
        verificationStatus: SkillVerificationStatus.NOT_VERIFIED,
      },
    });
    await prisma.workerSkill.updateMany({
      where: { workerId: v.workerId, skillId: inactiveSkillId },
      data: { verificationStatus: SkillVerificationStatus.NOT_VERIFIED },
    });
    const ws = await prisma.workerSkill.findFirst({
      where: { workerId: v.workerId, skillId: inactiveSkillId },
    });
    if (ws) {
      await prisma.certificate.create({
        data: { workerSkillId: ws.id, title: `Cert ${suffix}`, status: 'ACCEPTED' },
      });
    }

    // Active + unverified -> excluded.
    const u = await createWorker(WorkerAvailability.AVAILABLE, true);
    await prisma.workerSkill.create({
      data: {
        workerId: u.workerId,
        skillId: activeSkillId,
        proficiency: SkillProficiency.BEGINNER,
        experienceYears: 3,
        verificationStatus: SkillVerificationStatus.NOT_VERIFIED,
      },
    });
    await prisma.cooperativeMembership.create({
      data: { cooperativeId, workerId: u.workerId, role: 'MEMBER' },
    });

    // Active + verified + UNAVAILABLE -> excluded.
    const un = await createWorker(WorkerAvailability.UNAVAILABLE, true);
    await prisma.workerSkill.create({
      data: {
        workerId: un.workerId,
        skillId: activeSkillId,
        proficiency: SkillProficiency.EXPERT,
        experienceYears: 15,
        verificationStatus: SkillVerificationStatus.VERIFIED,
      },
    });
    await prisma.cooperativeMembership.create({
      data: { cooperativeId, workerId: un.workerId, role: 'MEMBER' },
    });

    // Active + verified + no membership -> excluded.
    const nm = await createWorker(WorkerAvailability.AVAILABLE, true);
    await prisma.workerSkill.create({
      data: {
        workerId: nm.workerId,
        skillId: activeSkillId,
        proficiency: SkillProficiency.INTERMEDIATE,
        experienceYears: 5,
        verificationStatus: SkillVerificationStatus.VERIFIED,
      },
    });

    // Inactive worker with verified skill -> excluded.
    const inact = await createWorker(WorkerAvailability.AVAILABLE, false);
    await prisma.workerSkill.create({
      data: {
        workerId: inact.workerId,
        skillId: activeSkillId,
        proficiency: SkillProficiency.EXPERT,
        experienceYears: 20,
        verificationStatus: SkillVerificationStatus.VERIFIED,
      },
    });
    await prisma.cooperativeMembership.create({
      data: { cooperativeId, workerId: inact.workerId, role: 'MEMBER' },
    });

    // Certificate only (no verified WorkerSkill for required skill) -> excluded.
    const cert = await createWorker(WorkerAvailability.AVAILABLE, true);
    const certWs = await prisma.workerSkill.create({
      data: {
        workerId: cert.workerId,
        skillId: inactiveSkillId,
        proficiency: SkillProficiency.EXPERT,
        experienceYears: 10,
        verificationStatus: SkillVerificationStatus.NOT_VERIFIED,
      },
    });
    await prisma.certificate.create({
      data: { workerSkillId: certWs.id, title: `CertOnly ${suffix}`, status: 'ACCEPTED' },
    });
    await prisma.cooperativeMembership.create({
      data: { cooperativeId, workerId: cert.workerId, role: 'MEMBER' },
    });

    // Education only -> excluded.
    const edu = await createWorker(WorkerAvailability.AVAILABLE, true);
    await prisma.worker.update({
      where: { id: edu.workerId },
      data: { educationQualification: 'B.Tech', educationYear: 2015 },
    });
    await prisma.cooperativeMembership.create({
      data: { cooperativeId, workerId: edu.workerId, role: 'MEMBER' },
    });

    // Experience only (experience on skill but NOT verified) -> excluded.
    const exp = await createWorker(WorkerAvailability.AVAILABLE, true);
    await prisma.workerSkill.create({
      data: {
        workerId: exp.workerId,
        skillId: activeSkillId,
        proficiency: SkillProficiency.EXPERT,
        experienceYears: 25,
        verificationStatus: SkillVerificationStatus.NOT_VERIFIED,
      },
    });
    await prisma.cooperativeMembership.create({
      data: { cooperativeId, workerId: exp.workerId, role: 'MEMBER' },
    });

    // OPEN service request for customer A.
    const sr = await prisma.serviceRequest.create({
      data: {
        customerId: customerACustomerId,
        skillId: activeSkillId,
        title: `Need ${suffix}`,
        location: 'Pune',
        status: ServiceRequestStatus.OPEN,
      },
    });
    requestId = sr.id;
  };

  afterAll(async () => {
    await prisma.cooperative.deleteMany({ where: { id: cooperativeId } });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    await prisma.skill.deleteMany({ where: { id: { in: createdSkillIds } } });
    await app.close();
  });

  const BASE = '/api/v1';

  it('returns 401 for unauthenticated match requests', async () => {
    const res = await request(app.getHttpServer()).get(
      `${BASE}/customers/me/service-requests/${requestId}/matches`,
    );
    expect(res.status).toBe(401);
  });

  it('returns 403 when a WORKER tries to access customer matching', async () => {
    const res = await request(app.getHttpServer())
      .get(`${BASE}/customers/me/service-requests/${requestId}/matches`)
      .set('Authorization', `Bearer ${workerToken}`);
    expect(res.status).toBe(403);
  });

  it('returns 403 for COOPERATIVE_ADMIN on the customer matching endpoint', async () => {
    const res = await request(app.getHttpServer())
      .get(`${BASE}/customers/me/service-requests/${requestId}/matches`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(403);
  });

  it('rejects a non-UUID request id with 400', async () => {
    const res = await request(app.getHttpServer())
      .get(`${BASE}/customers/me/service-requests/not-a-uuid/matches`)
      .set('Authorization', `Bearer ${customerAToken}`);
    expect(res.status).toBe(400);
  });

  it('returns 404 for an unknown request id', async () => {
    const res = await request(app.getHttpServer())
      .get(`${BASE}/customers/me/service-requests/00000000-0000-4000-8000-000000000000/matches`)
      .set('Authorization', `Bearer ${customerAToken}`);
    expect(res.status).toBe(404);
  });

  it('blocks cross-customer access (Customer B cannot view A matches)', async () => {
    await seedEligibilityMatrix();
    const res = await request(app.getHttpServer())
      .get(`${BASE}/customers/me/service-requests/${requestId}/matches`)
      .set('Authorization', `Bearer ${customerBToken}`);
    expect(res.status).toBe(404);
  });

  it('returns only verified eligible workers for an OPEN request', async () => {
    await seedEligibilityMatrix();
    const res = await request(app.getHttpServer())
      .get(`${BASE}/customers/me/service-requests/${requestId}/matches`)
      .set('Authorization', `Bearer ${customerAToken}`);
    expect(res.status).toBe(200);
    const ids = res.body.map((m: { workerId: string }) => m.workerId);
    expect(ids).toContain(verifiedWorkerId);
    expect(ids).toHaveLength(1);

    const match = res.body[0];
    expect(match.score).toBeGreaterThan(0);
    expect(match.skill.name).toContain('Matching Skill');
    expect(match.cooperative.id).toBe(cooperativeId);
    expect(match.distanceKm).toBeNull();
    expect(match.matchReasons).toContain('Verified required skill');
    expect(match.matchReasons).toContain('8 years of practical experience');
    expect(match.matchReasons).toContain('Location is compatible with the request');
  });

  it('deterministically computes the expected score', async () => {
    await seedEligibilityMatrix();
    const res = await request(app.getHttpServer())
      .get(`${BASE}/customers/me/service-requests/${requestId}/matches`)
      .set('Authorization', `Bearer ${customerAToken}`);
    // base 50 + experience 8*2=16 + proficiency ADVANCED 10 + location 15 = 91
    expect(res.body[0].score).toBe(91);
  });

  it('does not expose sensitive fields in match responses', async () => {
    await seedEligibilityMatrix();
    const res = await request(app.getHttpServer())
      .get(`${BASE}/customers/me/service-requests/${requestId}/matches`)
      .set('Authorization', `Bearer ${customerAToken}`);
    const raw = JSON.stringify(res.body);
    expect(raw).not.toContain('passwordHash');
    expect(raw).not.toContain('refreshTokenHash');
    expect(raw).not.toContain('educationQualification');
    expect(raw).not.toContain('educationInstitution');
    expect(raw).not.toContain('mobile');
    expect(raw).not.toContain('notes');
  });

  it('refuses matching for CANCELLED requests', async () => {
    await seedEligibilityMatrix();
    await prisma.serviceRequest.update({
      where: { id: requestId },
      data: { status: ServiceRequestStatus.CANCELLED },
    });
    const res = await request(app.getHttpServer())
      .get(`${BASE}/customers/me/service-requests/${requestId}/matches`)
      .set('Authorization', `Bearer ${customerAToken}`);
    expect(res.status).toBe(404);
    await prisma.serviceRequest.update({
      where: { id: requestId },
      data: { status: ServiceRequestStatus.OPEN },
    });
  });

  it('refuses matching for CLOSED requests', async () => {
    await seedEligibilityMatrix();
    await prisma.serviceRequest.update({
      where: { id: requestId },
      data: { status: ServiceRequestStatus.CLOSED },
    });
    const res = await request(app.getHttpServer())
      .get(`${BASE}/customers/me/service-requests/${requestId}/matches`)
      .set('Authorization', `Bearer ${customerAToken}`);
    expect(res.status).toBe(404);
    await prisma.serviceRequest.update({
      where: { id: requestId },
      data: { status: ServiceRequestStatus.OPEN },
    });
  });

  it('returns empty matches when the required skill is deactivated', async () => {
    await seedEligibilityMatrix();
    await prisma.skill.update({ where: { id: activeSkillId }, data: { active: false } });
    const res = await request(app.getHttpServer())
      .get(`${BASE}/customers/me/service-requests/${requestId}/matches`)
      .set('Authorization', `Bearer ${customerAToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(0);
    await prisma.skill.update({ where: { id: activeSkillId }, data: { active: true } });
  });

  it('returns a safe public worker profile without private fields', async () => {
    await seedEligibilityMatrix();
    const res = await request(app.getHttpServer())
      .get(`${BASE}/workers/${verifiedWorkerUserId}/public`)
      .set('Authorization', `Bearer ${customerAToken}`);
    expect(res.status).toBe(200);
    expect(res.body.fullName).toContain('Test Worker');
    expect(res.body.verifiedSkills.length).toBeGreaterThanOrEqual(1);
    expect(res.body.cooperatives.length).toBeGreaterThanOrEqual(1);

    const raw = JSON.stringify(res.body);
    expect(raw).not.toContain('passwordHash');
    expect(raw).not.toContain('educationQualification');
    expect(raw).not.toContain('mobile');
    expect(raw).not.toContain('email');
    expect(raw).not.toContain('refreshTokenHash');
  });

  it('returns 401 for unauthenticated public worker profile', async () => {
    const res = await request(app.getHttpServer()).get(
      `${BASE}/workers/00000000-0000-4000-8000-000000000000/public`,
    );
    expect(res.status).toBe(401);
  });

  it('returns 404 for an unknown worker public profile', async () => {
    const res = await request(app.getHttpServer())
      .get(`${BASE}/workers/00000000-0000-4000-8000-000000000000/public`)
      .set('Authorization', `Bearer ${customerAToken}`);
    expect(res.status).toBe(404);
  });

  it('excludes workers with an inactive (left) membership', async () => {
    await seedEligibilityMatrix();
    const left = await createWorker(WorkerAvailability.AVAILABLE, true);
    await prisma.workerSkill.create({
      data: {
        workerId: left.workerId,
        skillId: activeSkillId,
        proficiency: SkillProficiency.EXPERT,
        experienceYears: 12,
        verificationStatus: SkillVerificationStatus.VERIFIED,
      },
    });
    await prisma.cooperativeMembership.create({
      data: { cooperativeId, workerId: left.workerId, role: 'MEMBER' },
    });
    await prisma.cooperativeMembership.updateMany({
      where: { cooperativeId, workerId: left.workerId },
      data: { leftAt: new Date() },
    });

    const res = await request(app.getHttpServer())
      .get(`${BASE}/customers/me/service-requests/${requestId}/matches`)
      .set('Authorization', `Bearer ${customerAToken}`);
    expect(res.status).toBe(200);
    expect(res.body.map((m: { workerId: string }) => m.workerId)).not.toContain(left.workerId);
  });

  it('excludes workers with an inactive cooperative', async () => {
    await seedEligibilityMatrix();
    const inactiveCoop = await prisma.cooperative.create({
      data: { name: `Inactive Coop ${suffix}`, adminUserId: adminUserId, status: 'INACTIVE' },
    });
    const inactiveMember = await createWorker(WorkerAvailability.AVAILABLE, true);
    await prisma.workerSkill.create({
      data: {
        workerId: inactiveMember.workerId,
        skillId: activeSkillId,
        proficiency: SkillProficiency.EXPERT,
        experienceYears: 12,
        verificationStatus: SkillVerificationStatus.VERIFIED,
      },
    });
    await prisma.cooperativeMembership.create({
      data: { cooperativeId: inactiveCoop.id, workerId: inactiveMember.workerId, role: 'MEMBER' },
    });

    const res = await request(app.getHttpServer())
      .get(`${BASE}/customers/me/service-requests/${requestId}/matches`)
      .set('Authorization', `Bearer ${customerAToken}`);
    expect(res.status).toBe(200);
    expect(res.body.map((m: { workerId: string }) => m.workerId)).not.toContain(
      inactiveMember.workerId,
    );
    await prisma.cooperative.delete({ where: { id: inactiveCoop.id } });
  });

  it('uses Haversine distance when both sides carry coordinates', async () => {
    await seedEligibilityMatrix();
    // Pune and a nearby town ~12 km away.
    await prisma.serviceRequest.update({
      where: { id: requestId },
      data: { location: '18.5204,73.8567' },
    });
    await prisma.worker.update({
      where: { id: verifiedWorkerId },
      data: { location: '18.5304,73.8667' },
    });
    const res = await request(app.getHttpServer())
      .get(`${BASE}/customers/me/service-requests/${requestId}/matches`)
      .set('Authorization', `Bearer ${customerAToken}`);
    expect(res.status).toBe(200);
    expect(res.body[0].distanceKm).not.toBeNull();
    expect(res.body[0].distanceKm).toBeGreaterThan(0);
    expect(res.body[0].distanceKm).toBeLessThan(PROXIMITY_THRESHOLD_KM);
    expect(res.body[0].matchReasons).toContain(
      `Located ${Math.round(res.body[0].distanceKm)} km away`,
    );
    await prisma.serviceRequest.update({
      where: { id: requestId },
      data: { location: 'Pune' },
    });
    await prisma.worker.update({
      where: { id: verifiedWorkerId },
      data: { location: 'Pune' },
    });
  });

  it('falls back to text matching when coordinates are missing', async () => {
    await seedEligibilityMatrix();
    const res = await request(app.getHttpServer())
      .get(`${BASE}/customers/me/service-requests/${requestId}/matches`)
      .set('Authorization', `Bearer ${customerAToken}`);
    expect(res.status).toBe(200);
    expect(res.body[0].distanceKm).toBeNull();
    expect(res.body[0].matchReasons).toContain('Location is compatible with the request');
  });

  it('does not award proximity bonus when coordinates are too far apart', async () => {
    await seedEligibilityMatrix();
    await prisma.serviceRequest.update({
      where: { id: requestId },
      data: { location: '18.5204,73.8567' },
    });
    await prisma.worker.update({
      where: { id: verifiedWorkerId },
      data: { location: '28.6139,77.2090' }, // Delhi — far outside the 50 km threshold
    });
    const res = await request(app.getHttpServer())
      .get(`${BASE}/customers/me/service-requests/${requestId}/matches`)
      .set('Authorization', `Bearer ${customerAToken}`);
    expect(res.status).toBe(200);
    expect(res.body.map((m: { workerId: string }) => m.workerId)).toContain(verifiedWorkerId);
    expect(res.body[0].distanceKm).not.toBeNull();
    expect(res.body[0].distanceKm).toBeGreaterThan(PROXIMITY_THRESHOLD_KM);
    expect(res.body[0].matchReasons).not.toContain(`Located ${res.body[0].distanceKm} km away`);
    // Score should drop by the 15-point proximity bonus.
    expect(res.body[0].score).toBe(91 - 15);
    await prisma.serviceRequest.update({
      where: { id: requestId },
      data: { location: 'Pune' },
    });
    await prisma.worker.update({
      where: { id: verifiedWorkerId },
      data: { location: 'Pune' },
    });
  });

  it('excludes an inactive WorkerSkill for the required skill', async () => {
    await seedEligibilityMatrix();
    await prisma.workerSkill.updateMany({
      where: { workerId: verifiedWorkerId, skillId: activeSkillId },
      data: { verificationStatus: SkillVerificationStatus.NOT_VERIFIED },
    });
    const res = await request(app.getHttpServer())
      .get(`${BASE}/customers/me/service-requests/${requestId}/matches`)
      .set('Authorization', `Bearer ${customerAToken}`);
    expect(res.status).toBe(200);
    expect(res.body.map((m: { workerId: string }) => m.workerId)).not.toContain(verifiedWorkerId);
    await prisma.workerSkill.updateMany({
      where: { workerId: verifiedWorkerId, skillId: activeSkillId },
      data: { verificationStatus: SkillVerificationStatus.VERIFIED },
    });
  });
});
