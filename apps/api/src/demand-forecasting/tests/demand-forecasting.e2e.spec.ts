process.env.JWT_ACCESS_SECRET =
  process.env.JWT_ACCESS_SECRET ?? 'demand-forecasting-test-access-secret-32chars';
process.env.JWT_REFRESH_SECRET =
  process.env.JWT_REFRESH_SECRET ?? 'demand-forecasting-test-refresh-secret-32chars';

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { UserRole } from '@prisma/client';
import request from 'supertest';
import { AuthModule } from '../../auth/auth.module';
import { PrismaService } from '../../database/prisma.service';
import { BaselineForecastingStrategy } from '../baseline-forecasting.strategy';
import { DemandForecastingController } from '../demand-forecasting.controller';
import { DemandForecastingService } from '../demand-forecasting.service';
import { HistoricalDemandService } from '../historical-demand.service';

const COOPERATIVE_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_COOPERATIVE_ID = '22222222-2222-4222-8222-222222222222';
const ADMIN_USER_ID = '33333333-3333-4333-8333-333333333333';

describe('Demand forecasting API', () => {
  let app: INestApplication;
  let jwt: JwtService;
  const prisma = {
    cooperative: {
      findUnique: jest.fn(async ({ where }: { where: { id: string } }) => ({
        id: where.id,
        adminUserId: where.id === COOPERATIVE_ID ? ADMIN_USER_ID : 'another-admin',
      })),
    },
    serviceRequest: {
      findMany: jest.fn(async () => []),
    },
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AuthModule],
      controllers: [DemandForecastingController],
      providers: [HistoricalDemandService, BaselineForecastingStrategy, DemandForecastingService],
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

  const tokenFor = (role: UserRole, subject = ADMIN_USER_ID) =>
    jwt.sign({ sub: subject, role, type: 'access' });

  it('requires an authenticated cooperative administrator', async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/cooperatives/${COOPERATIVE_ID}/demand-forecast`)
      .expect(401);

    await request(app.getHttpServer())
      .get(`/api/v1/cooperatives/${COOPERATIVE_ID}/demand-forecast`)
      .set('Authorization', `Bearer ${tokenFor(UserRole.CUSTOMER)}`)
      .expect(403);
  });

  it('allows only the persisted administrator of the cooperative', async () => {
    const response = await request(app.getHttpServer())
      .get(`/api/v1/cooperatives/${COOPERATIVE_ID}/demand-forecast`)
      .set('Authorization', `Bearer ${tokenFor(UserRole.COOPERATIVE_ADMIN)}`)
      .expect(200);

    expect(response.body.status).toBe('NO_HISTORICAL_DATA');

    await request(app.getHttpServer())
      .get(`/api/v1/cooperatives/${OTHER_COOPERATIVE_ID}/demand-forecast`)
      .set('Authorization', `Bearer ${tokenFor(UserRole.COOPERATIVE_ADMIN)}`)
      .expect(403);
  });

  it('validates date ranges and passes supported filters to historical aggregation', async () => {
    await request(app.getHttpServer())
      .get(
        `/api/v1/cooperatives/${COOPERATIVE_ID}/demand-forecast?forecastStart=2027-06-10&forecastEnd=2027-06-09`,
      )
      .set('Authorization', `Bearer ${tokenFor(UserRole.COOPERATIVE_ADMIN)}`)
      .expect(400);

    await request(app.getHttpServer())
      .get(`/api/v1/cooperatives/${COOPERATIVE_ID}/demand-forecast?location=Sector%2017`)
      .set('Authorization', `Bearer ${tokenFor(UserRole.COOPERATIVE_ADMIN)}`)
      .expect(200);

    expect(prisma.serviceRequest.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          location: { equals: 'Sector 17', mode: 'insensitive' },
        }),
      }),
    );
  });
});
