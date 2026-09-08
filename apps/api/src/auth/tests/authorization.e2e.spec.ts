import { Controller, Delete, Get, INestApplication, Patch } from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { UserRole } from '@prisma/client';
import request from 'supertest';
import { AuthorizationService } from '../authorization/authorization.service';
import { Authorize } from '../decorators/authorize.decorator';
import { CurrentUser } from '../decorators/current-user.decorator';
import { AuthenticationGuard } from '../guards/authentication.guard';
import { CooperativeScopeGuard } from '../guards/cooperative-scope.guard';
import { OwnershipGuard } from '../guards/ownership.guard';
import { RolesGuard } from '../guards/roles.guard';
import { PrismaService } from '../../database/prisma.service';

const ACCESS_SECRET = 'access-secret-for-authorization-tests-32-chars';

/** Test-only routes exercise the reusable policy layer; they are not application features. */
@Controller('__test/authorization')
class AuthorizationTestController {
  @Get('customer/:customerId')
  @Authorize({
    roles: [UserRole.CUSTOMER],
    ownership: { resource: 'customer', param: 'customerId' },
  })
  readCustomer(@CurrentUser() user: { id: string }) {
    return { actorId: user.id };
  }

  @Patch('customer/:customerId')
  @Authorize({
    roles: [UserRole.CUSTOMER],
    ownership: { resource: 'customer', param: 'customerId' },
  })
  updateCustomer(@CurrentUser() user: { id: string }) {
    return { actorId: user.id };
  }

  @Delete('customer/:customerId')
  @Authorize({
    roles: [UserRole.CUSTOMER],
    ownership: { resource: 'customer', param: 'customerId' },
  })
  deleteCustomer(@CurrentUser() user: { id: string }) {
    return { actorId: user.id };
  }

  @Get('worker/:workerId')
  @Authorize({
    roles: [UserRole.WORKER],
    ownership: { resource: 'worker', param: 'workerId' },
  })
  readWorker(@CurrentUser() user: { id: string }) {
    return { actorId: user.id };
  }

  @Get('worker-skill/:workerSkillId')
  @Authorize({
    roles: [UserRole.WORKER],
    ownership: { resource: 'workerSkill', param: 'workerSkillId' },
  })
  readWorkerSkill(@CurrentUser() user: { id: string }) {
    return { actorId: user.id };
  }

  @Get('certificate/:certificateId')
  @Authorize({
    roles: [UserRole.WORKER],
    ownership: { resource: 'certificate', param: 'certificateId' },
  })
  readCertificate(@CurrentUser() user: { id: string }) {
    return { actorId: user.id };
  }

  @Get('cooperative/:cooperativeId/admin')
  @Authorize({
    roles: [UserRole.COOPERATIVE_ADMIN],
    cooperativeScope: { scope: 'admin', param: 'cooperativeId' },
  })
  readCooperativeAsAdmin(@CurrentUser() user: { id: string }) {
    return { actorId: user.id };
  }

  @Get('cooperative/:cooperativeId/worker')
  @Authorize({
    roles: [UserRole.WORKER],
    cooperativeScope: { scope: 'worker', param: 'cooperativeId' },
  })
  readCooperativeAsWorker(@CurrentUser() user: { id: string }) {
    return { actorId: user.id };
  }
}

describe('Authorization policy layer', () => {
  let app: INestApplication;
  let jwt: JwtService;

  const customerOwners = new Map([
    ['customer-a', 'customer-user-a'],
    ['customer-b', 'customer-user-b'],
  ]);
  const workerOwners = new Map([
    ['worker-a', 'worker-user-a'],
    ['worker-b', 'worker-user-b'],
  ]);
  const workerSkillOwners = new Map([
    ['worker-skill-a', 'worker-user-a'],
    ['worker-skill-b', 'worker-user-b'],
  ]);
  const certificateOwners = new Map([
    ['certificate-a', 'worker-user-a'],
    ['certificate-b', 'worker-user-b'],
  ]);
  const cooperativeAdmins = new Map([
    ['cooperative-a', 'admin-user-a'],
    ['cooperative-b', 'admin-user-b'],
  ]);
  const memberships = new Set(['worker-user-a:cooperative-a', 'worker-user-b:cooperative-b']);

  const prisma = {
    customer: {
      findUnique: jest.fn(async ({ where }: { where: { id: string } }) => {
        const userId = customerOwners.get(where.id);
        return userId ? { userId } : null;
      }),
    },
    worker: {
      findUnique: jest.fn(async ({ where }: { where: { id?: string; userId?: string } }) => {
        if (where.id) {
          const userId = workerOwners.get(where.id);
          return userId ? { userId } : null;
        }
        if (where.userId) {
          const workerId = [...workerOwners.entries()].find(([, uid]) => uid === where.userId)?.[0];
          return workerId ? { id: workerId } : null;
        }
        return null;
      }),
    },
    workerSkill: {
      findUnique: jest.fn(async ({ where }: { where: { id: string } }) => {
        const userId = workerSkillOwners.get(where.id);
        return userId ? { worker: { userId } } : null;
      }),
    },
    certificate: {
      findUnique: jest.fn(async ({ where }: { where: { id: string } }) => {
        const userId = certificateOwners.get(where.id);
        return userId ? { workerSkill: { worker: { userId } } } : null;
      }),
    },
    cooperative: {
      findUnique: jest.fn(async ({ where }: { where: { id: string } }) => {
        const adminUserId = cooperativeAdmins.get(where.id);
        return adminUserId ? { adminUserId } : null;
      }),
    },
    cooperativeMembership: {
      findFirst: jest.fn(
        async ({
          where,
        }: {
          where: {
            cooperativeId: string;
            workerId?: string;
            worker?: { userId: string };
            leftAt: null;
          };
        }) => {
          const userId = where.workerId ? workerOwners.get(where.workerId) : where.worker?.userId;
          return userId && memberships.has(`${userId}:${where.cooperativeId}`)
            ? { id: 'membership' }
            : null;
        },
      ),
    },
  };

  beforeAll(async () => {
    process.env.JWT_ACCESS_SECRET = ACCESS_SECRET;
    const moduleRef = await Test.createTestingModule({
      imports: [JwtModule.register({})],
      controllers: [AuthorizationTestController],
      providers: [
        Reflector,
        AuthenticationGuard,
        RolesGuard,
        AuthorizationService,
        OwnershipGuard,
        CooperativeScopeGuard,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    await app.init();
    jwt = app.get(JwtService);
  });

  afterAll(async () => {
    await app.close();
  });

  function http() {
    return request(app.getHttpServer());
  }

  async function accessToken(userId: string, role: UserRole, expiresAt?: number): Promise<string> {
    return jwt.signAsync(
      {
        sub: userId,
        role,
        type: 'access',
        ...(expiresAt ? { exp: expiresAt } : {}),
      },
      { secret: ACCESS_SECRET },
    );
  }

  it('PASS: returns 401 for missing, invalid, and expired JWTs before policy checks', async () => {
    await http().get('/api/v1/__test/authorization/customer/customer-a').expect(401);
    await http()
      .get('/api/v1/__test/authorization/customer/customer-a')
      .set('Authorization', 'Bearer invalid.token.value')
      .expect(401);
    await http()
      .get('/api/v1/__test/authorization/customer/customer-a')
      .set(
        'Authorization',
        `Bearer ${await accessToken(
          'customer-user-a',
          UserRole.CUSTOMER,
          Math.floor(Date.now() / 1000) - 30,
        )}`,
      )
      .expect(401);
  });

  it('PASS: enforces the full CUSTOMER, WORKER, and ADMIN role matrix with 403s', async () => {
    const customer = await accessToken('customer-user-a', UserRole.CUSTOMER);
    const worker = await accessToken('worker-user-a', UserRole.WORKER);
    const admin = await accessToken('admin-user-a', UserRole.COOPERATIVE_ADMIN);

    await http()
      .get('/api/v1/__test/authorization/customer/customer-a')
      .set('Authorization', `Bearer ${customer}`)
      .expect(200);
    await http()
      .get('/api/v1/__test/authorization/worker/worker-a')
      .set('Authorization', `Bearer ${worker}`)
      .expect(200);
    await http()
      .get('/api/v1/__test/authorization/cooperative/cooperative-a/admin')
      .set('Authorization', `Bearer ${admin}`)
      .expect(200);

    await http()
      .get('/api/v1/__test/authorization/worker/worker-a')
      .set('Authorization', `Bearer ${customer}`)
      .expect(403);
    await http()
      .get('/api/v1/__test/authorization/cooperative/cooperative-a/admin')
      .set('Authorization', `Bearer ${customer}`)
      .expect(403);
    await http()
      .get('/api/v1/__test/authorization/customer/customer-a')
      .set('Authorization', `Bearer ${worker}`)
      .expect(403);
    await http()
      .get('/api/v1/__test/authorization/cooperative/cooperative-a/admin')
      .set('Authorization', `Bearer ${worker}`)
      .expect(403);
    await http()
      .get('/api/v1/__test/authorization/worker/worker-a')
      .set('Authorization', `Bearer ${admin}`)
      .expect(403);
  });

  it('PASS: resolves ownership from persisted relationships for reads, writes, and deletes', async () => {
    const customerA = await accessToken('customer-user-a', UserRole.CUSTOMER);
    const workerA = await accessToken('worker-user-a', UserRole.WORKER);

    await http()
      .get('/api/v1/__test/authorization/customer/customer-a')
      .set('Authorization', `Bearer ${customerA}`)
      .expect(200)
      .expect({ actorId: 'customer-user-a' });
    await http()
      .get('/api/v1/__test/authorization/customer/customer-b')
      .set('Authorization', `Bearer ${customerA}`)
      .expect(403);
    await http()
      .patch('/api/v1/__test/authorization/customer/customer-b')
      .set('Authorization', `Bearer ${customerA}`)
      .send({ userId: 'customer-user-a' })
      .expect(403);
    await http()
      .delete('/api/v1/__test/authorization/customer/customer-b')
      .set('Authorization', `Bearer ${customerA}`)
      .expect(403);
    await http()
      .patch('/api/v1/__test/authorization/customer/customer-a')
      .set('Authorization', `Bearer ${customerA}`)
      .send({ userId: 'customer-user-b' })
      .expect(200);

    await http()
      .get('/api/v1/__test/authorization/worker/worker-a')
      .set('Authorization', `Bearer ${workerA}`)
      .expect(200);
    await http()
      .get('/api/v1/__test/authorization/worker-skill/worker-skill-a')
      .set('Authorization', `Bearer ${workerA}`)
      .expect(200);
    await http()
      .get('/api/v1/__test/authorization/worker-skill/worker-skill-b')
      .set('Authorization', `Bearer ${workerA}`)
      .expect(403);
    await http()
      .get('/api/v1/__test/authorization/certificate/certificate-a')
      .set('Authorization', `Bearer ${workerA}`)
      .expect(200);
    await http()
      .get('/api/v1/__test/authorization/certificate/certificate-b')
      .set('Authorization', `Bearer ${workerA}`)
      .expect(403);
  });

  it('PASS: enforces cooperative admin and worker membership scope from persisted records', async () => {
    const adminA = await accessToken('admin-user-a', UserRole.COOPERATIVE_ADMIN);
    const workerA = await accessToken('worker-user-a', UserRole.WORKER);

    await http()
      .get('/api/v1/__test/authorization/cooperative/cooperative-a/admin')
      .set('Authorization', `Bearer ${adminA}`)
      .expect(200)
      .expect({ actorId: 'admin-user-a' });
    await http()
      .get(
        '/api/v1/__test/authorization/cooperative/cooperative-b/admin?cooperativeId=cooperative-a',
      )
      .set('Authorization', `Bearer ${adminA}`)
      .expect(403);

    await http()
      .get(
        '/api/v1/__test/authorization/cooperative/cooperative-a/worker?cooperativeId=cooperative-b',
      )
      .set('Authorization', `Bearer ${workerA}`)
      .expect(200)
      .expect({ actorId: 'worker-user-a' });
    await http()
      .get(
        '/api/v1/__test/authorization/cooperative/cooperative-b/worker?cooperativeId=cooperative-a',
      )
      .set('Authorization', `Bearer ${workerA}`)
      .expect(403);
  });
});
