import { Controller, Get, INestApplication, UseGuards, ValidationPipe } from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { User, UserRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import request from 'supertest';
import { AuthController } from '../auth.controller';
import { AuthService } from '../auth.service';
import { CurrentUser } from '../decorators/current-user.decorator';
import { Roles } from '../decorators/roles.decorator';
import { AuthenticationGuard } from '../guards/authentication.guard';
import { RolesGuard } from '../guards/roles.guard';
import { PrismaService } from '../../database/prisma.service';

const ACCESS_SECRET = 'access-secret-for-tests-at-least-32-chars';
const REFRESH_SECRET = 'refresh-secret-for-tests-at-least-32-chars';

interface CreateUserArgs {
  data: {
    mobile: string;
    email?: string;
    passwordHash: string;
    role: UserRole;
    customer?: unknown;
    worker?: unknown;
  };
}

interface FindUserArgs {
  where: { id?: string; mobile?: string };
}

interface UpdateUserArgs {
  where: { id: string };
  data: { refreshTokenHash: string | null };
}

/** Test-only routes prove that the exported decorator/guards work together. */
@Controller('__test/rbac')
@UseGuards(AuthenticationGuard, RolesGuard)
class RbacTestController {
  @Get('customer')
  @Roles(UserRole.CUSTOMER)
  customer(@CurrentUser() user: { role: UserRole }) {
    return { role: user.role };
  }

  @Get('worker')
  @Roles(UserRole.WORKER)
  worker(@CurrentUser() user: { role: UserRole }) {
    return { role: user.role };
  }

  @Get('admin')
  @Roles(UserRole.COOPERATIVE_ADMIN)
  admin(@CurrentUser() user: { role: UserRole }) {
    return { role: user.role };
  }
}

describe('Authentication API', () => {
  let app: INestApplication;
  let jwt: JwtService;
  const users: User[] = [];

  const prisma = {
    user: {
      findFirst: jest.fn(
        async ({ where }: { where: { OR: Array<{ mobile?: string; email?: string }> } }) =>
          users.find((user) =>
            where.OR.some(
              (candidate) => candidate.mobile === user.mobile || candidate.email === user.email,
            ),
          ) ?? null,
      ),
      findUnique: jest.fn(async ({ where }: FindUserArgs) => {
        return users.find((user) => user.id === where.id || user.mobile === where.mobile) ?? null;
      }),
      create: jest.fn(async ({ data }: CreateUserArgs) => {
        const timestamp = new Date();
        const user: User = {
          id: `user-${users.length + 1}`,
          mobile: data.mobile,
          email: data.email ?? null,
          passwordHash: data.passwordHash,
          refreshTokenHash: null,
          role: data.role,
          isActive: true,
          createdAt: timestamp,
          updatedAt: timestamp,
        };
        users.push(user);
        return user;
      }),
      update: jest.fn(async ({ where, data }: UpdateUserArgs) => {
        const user = users.find((candidate) => candidate.id === where.id);
        if (!user) throw new Error('User not found');
        user.refreshTokenHash = data.refreshTokenHash;
        user.updatedAt = new Date();
        return user;
      }),
    },
  };

  beforeAll(async () => {
    process.env.JWT_ACCESS_SECRET = ACCESS_SECRET;
    process.env.JWT_REFRESH_SECRET = REFRESH_SECRET;
    process.env.JWT_ACCESS_TTL = '15m';
    process.env.JWT_REFRESH_TTL = '7d';

    const moduleRef = await Test.createTestingModule({
      imports: [JwtModule.register({})],
      controllers: [AuthController, RbacTestController],
      providers: [
        AuthService,
        AuthenticationGuard,
        RolesGuard,
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

  function extractRefreshToken(setCookie: string | string[] | undefined): string {
    const cookies = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
    const cookie = cookies.find((value) => value.startsWith('refresh_token='));
    const match = cookie?.match(/^refresh_token=([^;]+)/);
    if (!match) throw new Error('Expected refresh cookie');
    return decodeURIComponent(match[1]);
  }

  async function accessToken(role: UserRole, expiresAt?: number): Promise<string> {
    return jwt.signAsync(
      {
        sub: `rbac-${role.toLowerCase()}`,
        role,
        type: 'access',
        ...(expiresAt ? { exp: expiresAt } : {}),
      },
      { secret: ACCESS_SECRET },
    );
  }

  async function expiredRefreshToken(): Promise<string> {
    return jwt.signAsync(
      {
        sub: 'user-1',
        role: UserRole.CUSTOMER,
        type: 'refresh',
        exp: Math.floor(Date.now() / 1000) - 30,
      },
      { secret: REFRESH_SECRET },
    );
  }

  it('PASS: registers a customer with server-assigned role, a bcrypt hash, and a safe response', async () => {
    const password = 'customer-pass-123';
    const response = await http()
      .post('/api/v1/auth/register/customer')
      .send({ mobile: '+919876543210', email: 'customer@example.com', password })
      .expect(201);

    expect(response.body).toMatchObject({
      user: { mobile: '+919876543210', email: 'customer@example.com', role: UserRole.CUSTOMER },
      accessToken: expect.any(String),
    });
    expect(response.body.refreshToken).toBeUndefined();
    expect(JSON.stringify(response.body)).not.toContain('passwordHash');
    expect(JSON.stringify(response.body)).not.toContain(password);
    expect(response.headers['set-cookie']).toEqual(
      expect.arrayContaining([
        expect.stringContaining('refresh_token='),
        expect.stringContaining('HttpOnly'),
        expect.stringContaining('SameSite=Strict'),
      ]),
    );

    const stored = users.find((user) => user.mobile === '+919876543210');
    expect(stored?.passwordHash).toMatch(/^\$2[aby]\$/);
    expect(stored?.passwordHash).not.toBe(password);
    expect(await bcrypt.compare(password, stored?.passwordHash ?? '')).toBe(true);
  });

  it('PASS: rejects duplicate customer mobile and email', async () => {
    await http()
      .post('/api/v1/auth/register/customer')
      .send({ mobile: '+919876543210', password: 'another-pass-123' })
      .expect(409);
    await http()
      .post('/api/v1/auth/register/customer')
      .send({
        mobile: '+919876543212',
        email: 'customer@example.com',
        password: 'another-pass-123',
      })
      .expect(409);
  });

  it('PASS: rejects invalid and unsupported customer registration input', async () => {
    await http()
      .post('/api/v1/auth/register/customer')
      .send({ mobile: '9876543210', password: 'valid-pass-123' })
      .expect(400);
    await http()
      .post('/api/v1/auth/register/customer')
      .send({ mobile: '+919876543213', password: 'short' })
      .expect(400);
    await http()
      .post('/api/v1/auth/register/customer')
      .send({
        mobile: '+919876543213',
        password: 'valid-pass-123',
        role: UserRole.COOPERATIVE_ADMIN,
      })
      .expect(400);
  });

  it('PASS: registers a worker with the endpoint-controlled worker role', async () => {
    const response = await http()
      .post('/api/v1/auth/register/worker')
      .send({ mobile: '+919876543211', email: 'worker@example.com', password: 'worker-pass-123' })
      .expect(201);

    expect(response.body.user.role).toBe(UserRole.WORKER);
    expect(response.body.refreshToken).toBeUndefined();
    expect(JSON.stringify(response.body)).not.toContain('passwordHash');
    expect(prisma.user.create).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ role: UserRole.WORKER, worker: { create: {} } }),
      }),
    );
  });

  it('PASS: rejects duplicate and invalid worker registration input', async () => {
    await http()
      .post('/api/v1/auth/register/worker')
      .send({ mobile: '+919876543211', password: 'worker-pass-456' })
      .expect(409);
    await http()
      .post('/api/v1/auth/register/worker')
      .send({ mobile: '+919876543214', email: 'worker@example.com', password: 'worker-pass-456' })
      .expect(409);
    await http()
      .post('/api/v1/auth/register/worker')
      .send({ mobile: 'not-e164', password: 'worker-pass-456' })
      .expect(400);
    await http()
      .post('/api/v1/auth/register/worker')
      .send({ mobile: '+919876543214', password: 'short' })
      .expect(400);
  });

  it('PASS: authenticates only valid mobile/password login without leaking hashes or refresh tokens', async () => {
    const response = await http()
      .post('/api/v1/auth/login')
      .send({ mobile: '+919876543210', password: 'customer-pass-123' })
      .expect(200);
    const refreshToken = extractRefreshToken(response.headers['set-cookie']);

    expect(response.body.user.mobile).toBe('+919876543210');
    expect(response.body.accessToken).toEqual(expect.any(String));
    expect(response.body.refreshToken).toBeUndefined();
    expect(JSON.stringify(response.body)).not.toContain('passwordHash');
    expect(JSON.stringify(response.body)).not.toContain(refreshToken);

    const wrongPassword = await http()
      .post('/api/v1/auth/login')
      .send({ mobile: '+919876543210', password: 'incorrect-password' })
      .expect(401);
    const unknownUser = await http()
      .post('/api/v1/auth/login')
      .send({ mobile: '+919876543299', password: 'unknown-user-pass' })
      .expect(401);
    expect(wrongPassword.body.message).toBe('Invalid mobile number or password');
    expect(unknownUser.body.message).toBe('Invalid mobile number or password');
  });

  it('PASS: completes the shared login, refresh, me, and logout lifecycle for a provisioned admin', async () => {
    const timestamp = new Date();
    users.push({
      id: 'provisioned-admin',
      mobile: '+919876543299',
      email: 'admin@example.com',
      passwordHash: await bcrypt.hash('admin-pass-123', 12),
      refreshTokenHash: null,
      role: UserRole.COOPERATIVE_ADMIN,
      isActive: true,
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    const login = await http()
      .post('/api/v1/auth/login')
      .send({ mobile: '+919876543299', password: 'admin-pass-123' })
      .expect(200);
    expect(login.body.user.role).toBe(UserRole.COOPERATIVE_ADMIN);

    await http()
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${login.body.accessToken}`)
      .expect(200)
      .expect((response) => expect(response.body.role).toBe(UserRole.COOPERATIVE_ADMIN));

    const refreshed = await http()
      .post('/api/v1/auth/refresh')
      .set('Cookie', login.headers['set-cookie'])
      .expect(200);
    expect(refreshed.body.user.role).toBe(UserRole.COOPERATIVE_ADMIN);

    await http()
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${refreshed.body.accessToken}`)
      .set('Cookie', refreshed.headers['set-cookie'])
      .expect(200);
    await http().post('/api/v1/auth/refresh').set('Cookie', refreshed.headers['set-cookie']).expect(401);
  });

  it('PASS: accepts valid JWTs and rejects missing, invalid, and expired access tokens', async () => {
    const login = await http()
      .post('/api/v1/auth/login')
      .send({ mobile: '+919876543210', password: 'customer-pass-123' })
      .expect(200);

    await http().get('/api/v1/auth/me').expect(401);
    await http()
      .get('/api/v1/auth/me')
      .set('Authorization', 'Bearer invalid.token.value')
      .expect(401);
    await http()
      .get('/api/v1/auth/me')
      .set(
        'Authorization',
        `Bearer ${await accessToken(UserRole.CUSTOMER, Math.floor(Date.now() / 1000) - 30)}`,
      )
      .expect(401);

    const response = await http()
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${login.body.accessToken}`)
      .expect(200);
    expect(response.body).toMatchObject({ mobile: '+919876543210', role: UserRole.CUSTOMER });
    expect(response.body.passwordHash).toBeUndefined();
  });

  it('PASS: refreshes a valid cookie and rejects invalid or expired refresh tokens without leaking them', async () => {
    const login = await http()
      .post('/api/v1/auth/login')
      .send({ mobile: '+919876543210', password: 'customer-pass-123' })
      .expect(200);
    const refreshCookie = login.headers['set-cookie'];

    const refreshed = await http()
      .post('/api/v1/auth/refresh')
      .set('Cookie', refreshCookie)
      .expect(200);
    expect(refreshed.body.accessToken).toEqual(expect.any(String));
    expect(refreshed.body.refreshToken).toBeUndefined();
    expect(JSON.stringify(refreshed.body)).not.toContain(extractRefreshToken(refreshCookie));
    expect(refreshed.headers['set-cookie']).toEqual(
      expect.arrayContaining([expect.stringContaining('refresh_token=')]),
    );

    await http().post('/api/v1/auth/refresh').set('Cookie', 'refresh_token=not-a-jwt').expect(401);
    await http()
      .post('/api/v1/auth/refresh')
      .set('Cookie', `refresh_token=${encodeURIComponent(await expiredRefreshToken())}`)
      .expect(401);
  });

  it('PASS: logout clears the cookie and revokes the server-side refresh session', async () => {
    const login = await http()
      .post('/api/v1/auth/login')
      .send({ mobile: '+919876543210', password: 'customer-pass-123' })
      .expect(200);
    const refreshCookie = login.headers['set-cookie'];

    const logout = await http()
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${login.body.accessToken}`)
      .set('Cookie', refreshCookie)
      .expect(200);
    expect(logout.body).toEqual({ success: true });
    expect(logout.headers['set-cookie']).toEqual(
      expect.arrayContaining([expect.stringContaining('refresh_token=;')]),
    );
    await http().post('/api/v1/auth/refresh').set('Cookie', refreshCookie).expect(401);
  });

  it('PASS: enforces CUSTOMER, WORKER, and COOPERATIVE_ADMIN role boundaries with 403s', async () => {
    const customer = await accessToken(UserRole.CUSTOMER);
    const worker = await accessToken(UserRole.WORKER);
    const admin = await accessToken(UserRole.COOPERATIVE_ADMIN);

    await http()
      .get('/api/v1/__test/rbac/customer')
      .set('Authorization', `Bearer ${customer}`)
      .expect(200)
      .expect({ role: UserRole.CUSTOMER });
    await http()
      .get('/api/v1/__test/rbac/worker')
      .set('Authorization', `Bearer ${worker}`)
      .expect(200)
      .expect({ role: UserRole.WORKER });
    await http()
      .get('/api/v1/__test/rbac/admin')
      .set('Authorization', `Bearer ${admin}`)
      .expect(200)
      .expect({ role: UserRole.COOPERATIVE_ADMIN });

    await http()
      .get('/api/v1/__test/rbac/worker')
      .set('Authorization', `Bearer ${customer}`)
      .expect(403);
    await http()
      .get('/api/v1/__test/rbac/customer')
      .set('Authorization', `Bearer ${worker}`)
      .expect(403);
    await http()
      .get('/api/v1/__test/rbac/admin')
      .set('Authorization', `Bearer ${customer}`)
      .expect(403);
  });
});
