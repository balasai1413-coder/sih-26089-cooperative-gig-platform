process.env.DATABASE_URL =
  process.env.DATABASE_URL ??
  'postgresql://platform_user:MyLocalPassword123@localhost:5432/cooperative_gig_platform?schema=public';

process.env.JWT_ACCESS_SECRET =
  process.env.JWT_ACCESS_SECRET ?? 'access-secret-for-step6-tests-at-least-32-chars';

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { ServiceRequestStatus, UserRole } from '@prisma/client';
import request from 'supertest';

import { AuthModule } from '../../auth/auth.module';
import { AuthenticationGuard } from '../../auth/guards/authentication.guard';
import { OwnershipGuard } from '../../auth/guards/ownership.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { PrismaService } from '../../database/prisma.service';
import { ServiceRequestsController } from '../service-requests.controller';
import { ServiceRequestsService } from '../service-requests.service';

/**
 * Step 6 end-to-end tests run against the real PostgreSQL database.
 *
 * Every record created here uses a unique suffix and is cleaned up
 * in afterAll so existing Step 1-5 data is not disturbed.
 */
describe('ServiceRequestsController (Step 6, real database)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;

  const suffix = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  const createdUserIds: string[] = [];
  const createdSkillIds: string[] = [];

  let customerAToken: string;
  let customerBToken: string;
  let workerToken: string;
  let adminToken: string;

  let activeSkillId: string;
  let inactiveSkillId: string;

  const createUserWithRole = async (role: UserRole) => {
    const user = await prisma.user.create({
      data: {
        mobile: `9600${createdUserIds.length}${role.length}${suffix}`.slice(0, 15),
        passwordHash: 'test-hash-not-a-real-password',
        role,
      },
    });

    createdUserIds.push(user.id);

    return user;
  };

  const mintToken = (userId: string, role: UserRole) =>
    jwtService.sign({
      sub: userId,
      role,
      type: 'access',
    });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        AuthModule,
        JwtModule.register({
          secret: process.env.JWT_ACCESS_SECRET,
        }),
      ],
      controllers: [ServiceRequestsController],
      providers: [ServiceRequestsService],
    }).compile();

    app = moduleRef.createNestApplication();

    app.setGlobalPrefix('api/v1');

    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );

    app.useGlobalGuards(
      app.get(AuthenticationGuard, { strict: false }),
      app.get(RolesGuard, { strict: false }),
      app.get(OwnershipGuard, { strict: false }),
    );

    await app.init();

    prisma = app.get(PrismaService);
    jwtService = app.get(JwtService);

    // -------------------------
    // Customer A
    // -------------------------
    const customerA = await createUserWithRole(UserRole.CUSTOMER);

    await prisma.customer.create({
      data: {
        userId: customerA.id,
      },
    });

    customerAToken = mintToken(customerA.id, UserRole.CUSTOMER);

    // -------------------------
    // Customer B
    // -------------------------
    const customerB = await createUserWithRole(UserRole.CUSTOMER);

    await prisma.customer.create({
      data: {
        userId: customerB.id,
      },
    });

    customerBToken = mintToken(customerB.id, UserRole.CUSTOMER);

    // -------------------------
    // Worker
    // -------------------------
    const worker = await createUserWithRole(UserRole.WORKER);

    await prisma.worker.create({
      data: {
        userId: worker.id,
      },
    });

    workerToken = mintToken(worker.id, UserRole.WORKER);

    // -------------------------
    // Cooperative Admin
    // -------------------------
    const admin = await createUserWithRole(UserRole.COOPERATIVE_ADMIN);

    adminToken = mintToken(admin.id, UserRole.COOPERATIVE_ADMIN);

    // -------------------------
    // Active Skill
    // -------------------------
    const activeSkill = await prisma.skill.create({
      data: {
        name: `Wiring ${suffix}`,
        active: true,
      },
    });

    activeSkillId = activeSkill.id;
    createdSkillIds.push(activeSkill.id);

    // -------------------------
    // Inactive Skill
    // -------------------------
    const inactiveSkill = await prisma.skill.create({
      data: {
        name: `Retired ${suffix}`,
        active: false,
      },
    });

    inactiveSkillId = inactiveSkill.id;
    createdSkillIds.push(inactiveSkill.id);
  });

  afterAll(async () => {
    // Delete service requests first
    await prisma.serviceRequest.deleteMany({
      where: {
        customer: {
          userId: {
            in: createdUserIds,
          },
        },
      },
    });

    // Delete customers
    await prisma.customer.deleteMany({
      where: {
        userId: {
          in: createdUserIds,
        },
      },
    });

    // Delete workers
    await prisma.worker.deleteMany({
      where: {
        userId: {
          in: createdUserIds,
        },
      },
    });

    // Delete users
    await prisma.user.deleteMany({
      where: {
        id: {
          in: createdUserIds,
        },
      },
    });

    // Delete skills
    await prisma.skill.deleteMany({
      where: {
        id: {
          in: createdSkillIds,
        },
      },
    });

    await app.close();
  });

  // ============================================================
  // AUTHORIZATION
  // ============================================================

  it('returns 401 for unauthenticated requests', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/customers/me/service-requests');

    expect(res.status).toBe(401);
  });

  it('returns 403 when a WORKER tries to manage service requests', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/customers/me/service-requests')
      .set('Authorization', `Bearer ${workerToken}`);

    expect(res.status).toBe(403);
  });

  it('returns 403 for a COOPERATIVE_ADMIN on create', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/customers/me/service-requests')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        skillId: activeSkillId,
        title: 'Admin attempt',
      });

    expect(res.status).toBe(403);
  });

  // ============================================================
  // CREATE
  // ============================================================

  it('lets a customer create a service request with OPEN status', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/customers/me/service-requests')
      .set('Authorization', `Bearer ${customerAToken}`)
      .send({
        skillId: activeSkillId,
        title: 'Fix kitchen wiring',
        description: 'Sparking socket near the sink',
        location: 'Green Park, Phase 2',
        preferredDateTime: '2026-09-15T10:00:00.000Z',
      });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe(ServiceRequestStatus.OPEN);
    expect(res.body.skill.id).toBe(activeSkillId);
    expect(res.body.title).toBe('Fix kitchen wiring');
  });

  it('rejects creation with an inactive skill', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/customers/me/service-requests')
      .set('Authorization', `Bearer ${customerAToken}`)
      .send({
        skillId: inactiveSkillId,
        title: 'Should not pass',
      });

    expect(res.status).toBe(404);
  });

  it('rejects creation with an unknown skill', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/customers/me/service-requests')
      .set('Authorization', `Bearer ${customerAToken}`)
      .send({
        skillId: '00000000-0000-4000-8000-000000000000',
        title: 'Nope',
      });

    expect(res.status).toBe(404);
  });

  it('rejects invalid payloads with 400 including forged customerId', async () => {
    const missingTitle = await request(app.getHttpServer())
      .post('/api/v1/customers/me/service-requests')
      .set('Authorization', `Bearer ${customerAToken}`)
      .send({
        skillId: activeSkillId,
      });

    expect(missingTitle.status).toBe(400);

    const badUuid = await request(app.getHttpServer())
      .post('/api/v1/customers/me/service-requests')
      .set('Authorization', `Bearer ${customerAToken}`)
      .send({
        skillId: 'not-a-uuid',
        title: 'Bad uuid',
      });

    expect(badUuid.status).toBe(400);

    const forged = await request(app.getHttpServer())
      .post('/api/v1/customers/me/service-requests')
      .set('Authorization', `Bearer ${customerAToken}`)
      .send({
        skillId: activeSkillId,
        title: 'Forged',
        customerId: '00000000-0000-4000-8000-000000000000',
      });

    expect(forged.status).toBe(400);
  });

  // ============================================================
  // LIST
  // ============================================================

  it('lists only the authenticated customer requests, newest first', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/customers/me/service-requests')
      .set('Authorization', `Bearer ${customerAToken}`)
      .send({
        skillId: activeSkillId,
        title: 'Second request',
      });

    const mine = await request(app.getHttpServer())
      .get('/api/v1/customers/me/service-requests')
      .set('Authorization', `Bearer ${customerAToken}`);

    expect(mine.status).toBe(200);
    expect(mine.body.length).toBe(2);
    expect(mine.body[0].title).toBe('Second request');

    const theirs = await request(app.getHttpServer())
      .get('/api/v1/customers/me/service-requests')
      .set('Authorization', `Bearer ${customerBToken}`);

    expect(theirs.status).toBe(200);
    expect(theirs.body.length).toBe(0);
  });

  // ============================================================
  // GET
  // ============================================================

  it('gets an owned request and returns 404 for another customer request', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/v1/customers/me/service-requests')
      .set('Authorization', `Bearer ${customerBToken}`)
      .send({
        skillId: activeSkillId,
        title: 'B request',
      });

    expect(created.status).toBe(201);

    const requestId = created.body.id as string;

    const own = await request(app.getHttpServer())
      .get(`/api/v1/customers/me/service-requests/${requestId}`)
      .set('Authorization', `Bearer ${customerBToken}`);

    expect(own.status).toBe(200);
    expect(own.body.title).toBe('B request');

    const cross = await request(app.getHttpServer())
      .get(`/api/v1/customers/me/service-requests/${requestId}`)
      .set('Authorization', `Bearer ${customerAToken}`);

    expect(cross.status).toBe(404);
  });

  // ============================================================
  // UPDATE
  // ============================================================

  it('updates an owned request only', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/v1/customers/me/service-requests')
      .set('Authorization', `Bearer ${customerAToken}`)
      .send({
        skillId: activeSkillId,
        title: 'Before update',
      });

    expect(created.status).toBe(201);

    const requestId = created.body.id as string;

    const updated = await request(app.getHttpServer())
      .patch(`/api/v1/customers/me/service-requests/${requestId}`)
      .set('Authorization', `Bearer ${customerAToken}`)
      .send({
        title: 'After update',
        location: 'New location',
      });

    expect(updated.status).toBe(200);
    expect(updated.body.title).toBe('After update');
    expect(updated.body.location).toBe('New location');

    const cross = await request(app.getHttpServer())
      .patch(`/api/v1/customers/me/service-requests/${requestId}`)
      .set('Authorization', `Bearer ${customerBToken}`)
      .send({
        title: 'Hijack attempt',
      });

    expect(cross.status).toBe(404);
  });

  // ============================================================
  // DELETE / CANCEL
  // ============================================================

  it('cancels an owned request', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/v1/customers/me/service-requests')
      .set('Authorization', `Bearer ${customerAToken}`)
      .send({
        skillId: activeSkillId,
        title: 'To cancel',
      });

    expect(created.status).toBe(201);

    const requestId = created.body.id as string;

    const cancelled = await request(app.getHttpServer())
      .delete(`/api/v1/customers/me/service-requests/${requestId}`)
      .set('Authorization', `Bearer ${customerAToken}`);

    expect(cancelled.status).toBe(200);
    expect(cancelled.body.status).toBe(ServiceRequestStatus.CANCELLED);
  });

  // ============================================================
  // HISTORICAL REQUEST
  // ============================================================

  it('keeps historical requests valid after skill deactivation', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/v1/customers/me/service-requests')
      .set('Authorization', `Bearer ${customerAToken}`)
      .send({
        skillId: activeSkillId,
        title: 'Survives deactivation',
      });

    expect(created.status).toBe(201);

    const requestId = created.body.id as string;

    await prisma.skill.update({
      where: {
        id: activeSkillId,
      },
      data: {
        active: false,
      },
    });

    const after = await request(app.getHttpServer())
      .get(`/api/v1/customers/me/service-requests/${requestId}`)
      .set('Authorization', `Bearer ${customerAToken}`);

    expect(after.status).toBe(200);
    expect(after.body.skill.id).toBe(activeSkillId);

    // Restore skill for safety
    await prisma.skill.update({
      where: {
        id: activeSkillId,
      },
      data: {
        active: true,
      },
    });
  });
});
