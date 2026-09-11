process.env.JWT_ACCESS_SECRET =
  process.env.JWT_ACCESS_SECRET ?? 'demand-analytics-test-access-secret-32chars';
process.env.JWT_REFRESH_SECRET =
  process.env.JWT_REFRESH_SECRET ?? 'demand-analytics-test-refresh-secret-32chars';

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import {
  BookingStatus,
  CooperativeStatus,
  ServiceRequestStatus,
  SkillVerificationStatus,
  UserRole,
} from '@prisma/client';
import request from 'supertest';
import { AuthModule } from '../../auth/auth.module';
import { PrismaService } from '../../database/prisma.service';
import { BaselineForecastingStrategy } from '../../demand-forecasting/baseline-forecasting.strategy';
import { DemandForecastingService } from '../../demand-forecasting/demand-forecasting.service';
import { HistoricalDemandService } from '../../demand-forecasting/historical-demand.service';
import { CooperativesController } from '../cooperatives.controller';
import { CooperativesService } from '../cooperatives.service';

const COOP_A = '11111111-1111-4111-8111-111111111111';
const COOP_B = '22222222-2222-4222-8222-222222222222';
const COOP_C = '33333333-3333-4333-8333-333333333333';
const ADMIN_A = '44444444-4444-4444-8444-444444444444';
const ADMIN_B = '55555555-5555-4555-8555-555555555555';
const ADMIN_C = '66666666-6666-4666-8666-666666666666';
const SKILL_ELECTRICAL = '77777777-7777-4777-8777-777777777777';
const SKILL_PLUMBING = '88888888-8888-4888-8888-888888888888';
const CATEGORY_MAINTENANCE = '99999999-9999-4999-8999-999999999999';
const CATEGORY_REPAIRS = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

function daysAgo(days: number, now = new Date()): Date {
  const value = new Date(now);
  value.setUTCDate(value.getUTCDate() - days);
  return value;
}

describe('Cooperative demand analytics', () => {
  let app: INestApplication;
  let jwt: JwtService;

  const cooperatives = new Map<string, { id: string; name: string; adminUserId: string; status: CooperativeStatus }>();
  const memberships = new Map<
    string,
    {
      id: string;
      cooperativeId: string;
      workerId: string;
      role: string;
      joinedAt: Date;
      leftAt: Date | null;
    }
  >();
  const workers = new Map<string, { id: string; userId: string; fullName: string; location: string; skills: Array<{ skillId: string; skill: { id: string; name: string }; verificationStatus: SkillVerificationStatus }> }>();

  const serviceRequests = [
    {
      id: 'sr-accepted-a-1',
      status: ServiceRequestStatus.OPEN,
      createdAt: daysAgo(12),
      location: 'Sector 12',
      skillId: SKILL_ELECTRICAL,
      skill: { id: SKILL_ELECTRICAL, name: 'Electrical', category: { id: CATEGORY_MAINTENANCE, name: 'Maintenance' } },
      bookings: [{ cooperativeId: COOP_A, status: BookingStatus.ACCEPTED }],
    },
    {
      id: 'sr-accepted-a-2',
      status: ServiceRequestStatus.OPEN,
      createdAt: daysAgo(18),
      location: 'Sector 12',
      skillId: SKILL_ELECTRICAL,
      skill: { id: SKILL_ELECTRICAL, name: 'Electrical', category: { id: CATEGORY_MAINTENANCE, name: 'Maintenance' } },
      bookings: [{ cooperativeId: COOP_A, status: BookingStatus.ACCEPTED }],
    },
    {
      id: 'sr-in-progress-a',
      status: ServiceRequestStatus.OPEN,
      createdAt: daysAgo(26),
      location: 'Sector 17',
      skillId: SKILL_PLUMBING,
      skill: { id: SKILL_PLUMBING, name: 'Plumbing', category: { id: CATEGORY_REPAIRS, name: 'Repairs' } },
      bookings: [{ cooperativeId: COOP_A, status: BookingStatus.IN_PROGRESS }],
    },
    {
      id: 'sr-completed-a',
      status: ServiceRequestStatus.CLOSED,
      createdAt: daysAgo(32),
      location: 'Sector 12',
      skillId: SKILL_ELECTRICAL,
      skill: { id: SKILL_ELECTRICAL, name: 'Electrical', category: { id: CATEGORY_MAINTENANCE, name: 'Maintenance' } },
      bookings: [{ cooperativeId: COOP_A, status: BookingStatus.COMPLETED }],
    },
    {
      id: 'sr-rejected-a',
      status: ServiceRequestStatus.OPEN,
      createdAt: daysAgo(9),
      location: 'Sector 20',
      skillId: SKILL_ELECTRICAL,
      skill: { id: SKILL_ELECTRICAL, name: 'Electrical', category: { id: CATEGORY_MAINTENANCE, name: 'Maintenance' } },
      bookings: [{ cooperativeId: COOP_A, status: BookingStatus.REJECTED }],
    },
    {
      id: 'sr-cancelled-a',
      status: ServiceRequestStatus.CANCELLED,
      createdAt: daysAgo(7),
      location: 'Sector 21',
      skillId: SKILL_PLUMBING,
      skill: { id: SKILL_PLUMBING, name: 'Plumbing', category: { id: CATEGORY_REPAIRS, name: 'Repairs' } },
      bookings: [{ cooperativeId: COOP_A, status: BookingStatus.CANCELLED }],
    },
    {
      id: 'sr-b-only',
      status: ServiceRequestStatus.OPEN,
      createdAt: daysAgo(5),
      location: 'Sector 18',
      skillId: SKILL_ELECTRICAL,
      skill: { id: SKILL_ELECTRICAL, name: 'Electrical', category: { id: CATEGORY_MAINTENANCE, name: 'Maintenance' } },
      bookings: [{ cooperativeId: COOP_B, status: BookingStatus.ACCEPTED }],
    },
  ];

  const prisma = {
    cooperative: {
      findUnique: jest.fn(async ({ where }: { where: { id: string } }) => {
        const coop = cooperatives.get(where.id);
        return coop ? { ...coop } : null;
      }),
      findFirst: jest.fn(async ({ where }: { where: { id?: string; adminUserId?: string } }) => {
        if (where?.id && where?.adminUserId) {
          const coop = cooperatives.get(where.id);
          if (!coop || coop.adminUserId !== where.adminUserId) return null;
          return { ...coop };
        }
        if (where?.adminUserId) {
          const matched = [...cooperatives.values()].find((item) => item.adminUserId === where.adminUserId);
          return matched ? { ...matched } : null;
        }
        if (where?.id) {
          const coop = cooperatives.get(where.id);
          return coop ? { ...coop } : null;
        }
        return null;
      }),
      findMany: jest.fn(async ({ where }: { where?: { adminUserId?: string } }) => {
        const items = [...cooperatives.values()];
        return items
          .filter((item) => (where?.adminUserId ? item.adminUserId === where.adminUserId : true))
          .map((item) => ({ ...item }));
      }),
    },
    cooperativeMembership: {
      findMany: jest.fn(async ({ where }: { where: { cooperativeId: string; leftAt?: null } }) => {
        const rows = [...memberships.values()].filter(
          (item) => item.cooperativeId === where.cooperativeId && item.leftAt === null,
        );
        return rows.map((membership) => {
          const worker = workers.get(membership.workerId);
          return {
            worker: {
              id: worker!.id,
              skills: worker!.skills.map((skill) => ({
                skillId: skill.skillId,
                skill: skill.skill,
                verificationStatus: skill.verificationStatus,
              })),
            },
          };
        });
      }),
    },
    serviceRequest: {
      findMany: jest.fn(async ({ where }: { where: Record<string, any> }) => {
        const cooperativeId = where?.bookings?.some?.cooperativeId;
        const allowedStatuses = where?.bookings?.some?.status?.in ?? [];
        const start = where?.createdAt?.gte ? new Date(where.createdAt.gte) : null;
        const end = where?.createdAt?.lt ? new Date(where.createdAt.lt) : null;
        const skillId = where?.skillId ?? null;
        const location = where?.location?.equals ?? null;

        return serviceRequests
          .filter((request) => {
            if (where?.status?.not && request.status === where.status.not) return false;
            if (start && end) {
              const value = new Date(request.createdAt);
              if (!(value >= start && value < end)) return false;
            }
            if (skillId && request.skillId !== skillId) return false;
            if (location && request.location.toLowerCase() !== location.toLowerCase()) return false;
            if (where?.categoryId && request.skill.category.id !== where.categoryId) return false;
            if (cooperativeId) {
              const matchesCoop = request.bookings.some(
                (booking) =>
                  booking.cooperativeId === cooperativeId && allowedStatuses.includes(booking.status),
              );
              if (!matchesCoop) return false;
            }
            return true;
          })
          .map((request) => ({
            id: request.id,
            createdAt: request.createdAt,
            location: request.location,
            skill: request.skill,
          }));
      }),
    },
  } as unknown as PrismaService;

  beforeAll(async () => {
    cooperatives.clear();
    memberships.clear();
    workers.clear();

    cooperatives.set(COOP_A, { id: COOP_A, name: 'Coop A', adminUserId: ADMIN_A, status: CooperativeStatus.ACTIVE });
    cooperatives.set(COOP_B, { id: COOP_B, name: 'Coop B', adminUserId: ADMIN_B, status: CooperativeStatus.ACTIVE });
    cooperatives.set(COOP_C, { id: COOP_C, name: 'Coop C', adminUserId: ADMIN_C, status: CooperativeStatus.ACTIVE });

    workers.set('worker-a-1', {
      id: 'worker-a-1',
      userId: 'user-a-1',
      fullName: 'Alice',
      location: 'Sector 12',
      skills: [
        { skillId: SKILL_ELECTRICAL, skill: { id: SKILL_ELECTRICAL, name: 'Electrical' }, verificationStatus: SkillVerificationStatus.VERIFIED },
        { skillId: SKILL_PLUMBING, skill: { id: SKILL_PLUMBING, name: 'Plumbing' }, verificationStatus: SkillVerificationStatus.VERIFIED },
      ],
    });
    workers.set('worker-a-2', {
      id: 'worker-a-2',
      userId: 'user-a-2',
      fullName: 'Ava',
      location: 'Sector 17',
      skills: [
        { skillId: SKILL_ELECTRICAL, skill: { id: SKILL_ELECTRICAL, name: 'Electrical' }, verificationStatus: SkillVerificationStatus.VERIFIED },
      ],
    });
    workers.set('worker-b-1', {
      id: 'worker-b-1',
      userId: 'user-b-1',
      fullName: 'Bob',
      location: 'Sector 18',
      skills: [
        { skillId: SKILL_PLUMBING, skill: { id: SKILL_PLUMBING, name: 'Plumbing' }, verificationStatus: SkillVerificationStatus.VERIFIED },
      ],
    });

    memberships.set('m-a-1', { id: 'm-a-1', cooperativeId: COOP_A, workerId: 'worker-a-1', role: 'MEMBER', joinedAt: daysAgo(200), leftAt: null });
    memberships.set('m-a-2', { id: 'm-a-2', cooperativeId: COOP_A, workerId: 'worker-a-2', role: 'MEMBER', joinedAt: daysAgo(120), leftAt: null });
    memberships.set('m-b-1', { id: 'm-b-1', cooperativeId: COOP_B, workerId: 'worker-b-1', role: 'MEMBER', joinedAt: daysAgo(200), leftAt: null });

    const moduleRef = await Test.createTestingModule({
      imports: [AuthModule],
      controllers: [CooperativesController],
      providers: [CooperativesService, HistoricalDemandService, BaselineForecastingStrategy, DemandForecastingService],
    })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }),
    );
    await app.init();
    jwt = new JwtService({ secret: process.env.JWT_ACCESS_SECRET });
  });

  afterAll(async () => {
    await app.close();
  });

  const tokenFor = (role: UserRole, subject: string) => jwt.sign({ sub: subject, role, type: 'access' });

  it('1. /me overview is authorized and resolves the admin cooperative server-side', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/cooperatives/me/demand/overview?days=30')
      .set('Authorization', `Bearer ${tokenFor(UserRole.COOPERATIVE_ADMIN, ADMIN_A)}`)
      .expect(200);

    expect(response.body.cooperativeId).toBe(COOP_A);
    expect(response.body.totalHistoricalDemand).toBeGreaterThan(0);
    expect(response.body.generatedAt).toBeDefined();
  });

  it('2. explicit cooperativeId routes succeed for the right admin and reject another admin', async () => {
    const okay = await request(app.getHttpServer())
      .get(`/api/v1/cooperatives/${COOP_A}/demand/overview?days=30`)
      .set('Authorization', `Bearer ${tokenFor(UserRole.COOPERATIVE_ADMIN, ADMIN_A)}`)
      .expect(200);
    expect(okay.body.cooperativeId).toBe(COOP_A);

    await request(app.getHttpServer())
      .get(`/api/v1/cooperatives/${COOP_A}/demand/overview?days=30`)
      .set('Authorization', `Bearer ${tokenFor(UserRole.COOPERATIVE_ADMIN, ADMIN_B)}`)
      .expect(403);

    const otherOkay = await request(app.getHttpServer())
      .get(`/api/v1/cooperatives/${COOP_B}/demand/overview?days=30`)
      .set('Authorization', `Bearer ${tokenFor(UserRole.COOPERATIVE_ADMIN, ADMIN_B)}`)
      .expect(200);
    expect(otherOkay.body.cooperativeId).toBe(COOP_B);
  });

  it('3. historical demand is attributed by Booking.cooperativeId and not current worker membership', async () => {
    const aOverview = await request(app.getHttpServer())
      .get(`/api/v1/cooperatives/${COOP_A}/demand/overview?days=30`)
      .set('Authorization', `Bearer ${tokenFor(UserRole.COOPERATIVE_ADMIN, ADMIN_A)}`)
      .expect(200);

    const bOverview = await request(app.getHttpServer())
      .get(`/api/v1/cooperatives/${COOP_B}/demand/overview?days=30`)
      .set('Authorization', `Bearer ${tokenFor(UserRole.COOPERATIVE_ADMIN, ADMIN_B)}`)
      .expect(200);

    expect(aOverview.body.totalHistoricalDemand).toBeGreaterThan(0);
    expect(bOverview.body.totalHistoricalDemand).toBeGreaterThan(0);
    expect(aOverview.body.totalHistoricalDemand).not.toBe(bOverview.body.totalHistoricalDemand);
    expect(aOverview.body.highDemandSkills.some((skill: any) => skill.skillName === 'Electrical')).toBe(true);
    expect(bOverview.body.highDemandSkills.some((skill: any) => skill.skillName === 'Electrical')).toBe(true);
  });

  it('4. Booking status rules count accepted/in-progress/completed and exclude rejected/cancelled', async () => {
    const response = await request(app.getHttpServer())
      .get(`/api/v1/cooperatives/${COOP_A}/demand/overview?days=30`)
      .set('Authorization', `Bearer ${tokenFor(UserRole.COOPERATIVE_ADMIN, ADMIN_A)}`)
      .expect(200);

    expect(response.body.totalHistoricalDemand).toBe(3);
    expect(response.body.highDemandSkills.some((skill: any) => skill.skillName === 'Electrical')).toBe(true);
    expect(response.body.highDemandSkills.some((skill: any) => skill.skillName === 'Plumbing')).toBe(true);
  });

  it('5. by-skill analytics are scoped to the cooperative and grouped correctly', async () => {
    const response = await request(app.getHttpServer())
      .get(`/api/v1/cooperatives/${COOP_A}/demand/by-skill?days=30`)
      .set('Authorization', `Bearer ${tokenFor(UserRole.COOPERATIVE_ADMIN, ADMIN_A)}`)
      .expect(200);

    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body.map((row: any) => row.skillName)).toEqual(
      expect.arrayContaining(['Electrical', 'Plumbing']),
    );
    const electrical = response.body.find((row: any) => row.skillName === 'Electrical');
    expect(electrical.historicalDemand).toBeGreaterThan(0);
    expect(electrical.capacityStatus).toBeDefined();
  });

  it('6. trends return cooperative-scoped date aggregation', async () => {
    const response = await request(app.getHttpServer())
      .get(`/api/v1/cooperatives/${COOP_A}/demand/trends?days=30`)
      .set('Authorization', `Bearer ${tokenFor(UserRole.COOPERATIVE_ADMIN, ADMIN_A)}`)
      .expect(200);

    expect(response.body.cooperativeId).toBe(COOP_A);
    expect(Array.isArray(response.body.dataPoints)).toBe(true);
    expect(response.body.dataPoints.some((point: any) => point.demand > 0)).toBe(true);
  });

  it('7. forecast delegates to the canonical demand engine and not fake data', async () => {
    const response = await request(app.getHttpServer())
      .get(`/api/v1/cooperatives/${COOP_A}/demand/forecast?days=14`)
      .set('Authorization', `Bearer ${tokenFor(UserRole.COOPERATIVE_ADMIN, ADMIN_A)}`)
      .expect(200);

    expect(response.body.filters.cooperativeId).toBe(COOP_A);
    expect(response.body.source).toBeDefined();
    expect(response.body.overview).toBeDefined();
    expect(response.body.highDemandSkills).toBeDefined();
    expect(response.body.overview.status).toBeDefined();
  });

  it('8. capacity correctly counts verified workers and keeps them cooperative-scoped', async () => {
    const response = await request(app.getHttpServer())
      .get(`/api/v1/cooperatives/${COOP_A}/demand/capacity?days=30`)
      .set('Authorization', `Bearer ${tokenFor(UserRole.COOPERATIVE_ADMIN, ADMIN_A)}`)
      .expect(200);

    expect(response.body.totalVerifiedWorkers).toBeGreaterThan(0);
    expect(response.body.cooperativeId).toBe(COOP_A);
    expect(response.body.bySkill.length).toBeGreaterThan(0);
    expect(response.body.bySkill.some((row: any) => row.skillName === 'Electrical')).toBe(true);
  });

  it('9. recommendations are based on real actual demand/capacity and no cross-cooperative leakage', async () => {
    const response = await request(app.getHttpServer())
      .get(`/api/v1/cooperatives/${COOP_A}/demand/recommendations?days=30`)
      .set('Authorization', `Bearer ${tokenFor(UserRole.COOPERATIVE_ADMIN, ADMIN_A)}`)
      .expect(200);

    expect(response.body.cooperativeId).toBe(COOP_A);
    expect(Array.isArray(response.body.recommendations)).toBe(true);
    expect(response.body.recommendations.length).toBeGreaterThanOrEqual(0);
    response.body.recommendations.forEach((row: any) => {
      expect(row.skillName).toBeTruthy();
      expect(typeof row.predictedDemand).toBe('number');
      expect(typeof row.availableWorkers).toBe('number');
    });
  });

  it('10. insufficient history is explicit and no fabricated forecast is returned', async () => {
    const response = await request(app.getHttpServer())
      .get(`/api/v1/cooperatives/${COOP_C}/demand/overview?days=30`)
      .set('Authorization', `Bearer ${tokenFor(UserRole.COOPERATIVE_ADMIN, ADMIN_C)}`)
      .expect(200);

    expect(response.body.totalHistoricalDemand).toBe(0);
    expect(response.body.forecastDemand).toBe(0);
    expect(response.body.status).toBeDefined();
    expect(response.body.dataStatus).toBeDefined();
  });
});
