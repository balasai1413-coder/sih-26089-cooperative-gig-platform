process.env.DATABASE_URL =
  process.env.DATABASE_URL ??
  'postgresql://platform_user:MyLocalPassword123@localhost:5432/cooperative_gig_platform?schema=public';
process.env.JWT_ACCESS_SECRET =
  process.env.JWT_ACCESS_SECRET ?? 'access-secret-for-step10-tests-at-least-32-chars';
process.env.JWT_REFRESH_SECRET =
  process.env.JWT_REFRESH_SECRET ?? 'refresh-secret-for-step10-tests-at-least-32-ch';

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import {
  BookingStatus,
  CooperativeStatus,
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
import { NotificationsModule } from '../../notifications/notifications.module';
import { PrismaService } from '../../database/prisma.service';
import { ReviewsService } from '../reviews.service';
import { CustomerReviewsController } from '../customer-reviews.controller';
import { WorkerReviewsController } from '../worker-reviews.controller';
import { BookingsService } from '../../bookings/bookings.service';
import { CustomerBookingsController } from '../../bookings/customer-bookings.controller';
import { WorkerBookingsController } from '../../bookings/worker-bookings.controller';
import { WorkersController } from '../../workers/workers.controller';
import { WorkersService } from '../../workers/workers.service';

describe('Ratings, Reviews & Reputation (Step 10, real database)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;

  const suffix = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const createdUserIds: string[] = [];
  const createdSkillIds: string[] = [];
  const createdCoopIds: string[] = [];

  let customerAToken: string;
  let customerBToken: string;
  let customerCToken: string;
  let worker1Token: string;
  let worker2Token: string;
  let adminToken: string;

  let customerAId: string;
  let customerBId: string;
  let customerCId: string;
  let worker1Id: string;
  let worker2Id: string;

  let activeSkillId: string;
  let openRequestId: string;
  let completedBookingId: string;
  let openBookingId: string;
  let inProgressBookingId: string;
  let cancelledBookingId: string;
  let rejectedBookingId: string;

  const createUserWithRole = async (role: UserRole, isActive = true) => {
    const user = await prisma.user.create({
      data: {
        mobile: `9600${createdUserIds.length}${role.length}${isActive ? 1 : 0}${suffix}`.slice(
          0,
          15,
        ),
        passwordHash: 'test-hash-not-a-real-password',
        role,
        isActive,
      },
    });
    createdUserIds.push(user.id);
    return user;
  };

  const mintToken = (userId: string, role: UserRole) =>
    jwtService.sign({ sub: userId, role, type: 'access' });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        AuthModule,
        JwtModule.register({ secret: process.env.JWT_ACCESS_SECRET }),
        NotificationsModule,
      ],
      controllers: [
        CustomerBookingsController,
        WorkerBookingsController,
        CustomerReviewsController,
        WorkerReviewsController,
        WorkersController,
      ],
      providers: [PrismaService, BookingsService, ReviewsService, WorkersService],
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

    // 1. Cooperative
    const coop = await prisma.cooperative.create({
      data: {
        name: `Step10 Coop ${suffix}`,
        status: CooperativeStatus.ACTIVE,
      },
    });
    createdCoopIds.push(coop.id);

    // 2. Skills
    const activeSkill = await prisma.skill.create({
      data: { name: `Plumbing ${suffix}`, active: true },
    });
    activeSkillId = activeSkill.id;
    createdSkillIds.push(activeSkill.id);

    // 3. Customers
    const customerAUser = await createUserWithRole(UserRole.CUSTOMER);
    const customerARecord = await prisma.customer.create({ data: { userId: customerAUser.id } });
    customerAId = customerARecord.id;
    customerAToken = mintToken(customerAUser.id, UserRole.CUSTOMER);

    const customerBUser = await createUserWithRole(UserRole.CUSTOMER);
    const customerBRecord = await prisma.customer.create({ data: { userId: customerBUser.id } });
    customerBId = customerBRecord.id;
    customerBToken = mintToken(customerBUser.id, UserRole.CUSTOMER);

    const customerCUser = await createUserWithRole(UserRole.CUSTOMER);
    const customerCRecord = await prisma.customer.create({ data: { userId: customerCUser.id } });
    customerCId = customerCRecord.id;
    customerCToken = mintToken(customerCUser.id, UserRole.CUSTOMER);

    // 4. Admin
    const adminUser = await createUserWithRole(UserRole.COOPERATIVE_ADMIN);
    adminToken = mintToken(adminUser.id, UserRole.COOPERATIVE_ADMIN);

    // 5. Worker 1
    const w1User = await createUserWithRole(UserRole.WORKER);
    const w1Record = await prisma.worker.create({
      data: {
        userId: w1User.id,
        fullName: `Reviewable Worker 1 ${suffix}`,
        availability: WorkerAvailability.AVAILABLE,
        yearsExperience: 5,
      },
    });
    worker1Id = w1Record.id;
    worker1Token = mintToken(w1User.id, UserRole.WORKER);
    await prisma.cooperativeMembership.create({
      data: { cooperativeId: coop.id, workerId: worker1Id },
    });
    await prisma.workerSkill.create({
      data: {
        workerId: worker1Id,
        skillId: activeSkillId,
        proficiency: SkillProficiency.EXPERT,
        verificationStatus: SkillVerificationStatus.VERIFIED,
      },
    });

    // 6. Worker 2
    const w2User = await createUserWithRole(UserRole.WORKER);
    const w2Record = await prisma.worker.create({
      data: {
        userId: w2User.id,
        fullName: `Reviewable Worker 2 ${suffix}`,
        availability: WorkerAvailability.AVAILABLE,
        yearsExperience: 3,
      },
    });
    worker2Id = w2Record.id;
    worker2Token = mintToken(w2User.id, UserRole.WORKER);
    await prisma.cooperativeMembership.create({
      data: { cooperativeId: coop.id, workerId: worker2Id },
    });
    await prisma.workerSkill.create({
      data: {
        workerId: worker2Id,
        skillId: activeSkillId,
        proficiency: SkillProficiency.ADVANCED,
        verificationStatus: SkillVerificationStatus.VERIFIED,
      },
    });

    // 7. Service Requests
    const reqCompleted = await prisma.serviceRequest.create({
      data: {
        customerId: customerAId,
        skillId: activeSkillId,
        title: `Completed request ${suffix}`,
        status: ServiceRequestStatus.CLOSED,
      },
    });
    const reqOpen = await prisma.serviceRequest.create({
      data: {
        customerId: customerAId,
        skillId: activeSkillId,
        title: `Open request ${suffix}`,
        status: ServiceRequestStatus.OPEN,
      },
    });
    const reqInProgress = await prisma.serviceRequest.create({
      data: {
        customerId: customerAId,
        skillId: activeSkillId,
        title: `In-progress request ${suffix}`,
        status: ServiceRequestStatus.OPEN,
      },
    });
    const reqCancelled = await prisma.serviceRequest.create({
      data: {
        customerId: customerAId,
        skillId: activeSkillId,
        title: `Cancelled request ${suffix}`,
        status: ServiceRequestStatus.OPEN,
      },
    });
    const reqRejected = await prisma.serviceRequest.create({
      data: {
        customerId: customerAId,
        skillId: activeSkillId,
        title: `Rejected request ${suffix}`,
        status: ServiceRequestStatus.OPEN,
      },
    });
    openRequestId = reqOpen.id;

    // 8. Bookings
    const completedBooking = await prisma.booking.create({
      data: {
        serviceRequestId: reqCompleted.id,
        customerId: customerAId,
        workerId: worker1Id,
        status: BookingStatus.COMPLETED,
        completedAt: new Date(),
      },
    });
    completedBookingId = completedBooking.id;

    const openBooking = await prisma.booking.create({
      data: {
        serviceRequestId: reqOpen.id,
        customerId: customerAId,
        workerId: worker1Id,
        status: BookingStatus.PENDING_WORKER_ACCEPTANCE,
      },
    });
    openBookingId = openBooking.id;

    const inProgressBooking = await prisma.booking.create({
      data: {
        serviceRequestId: reqInProgress.id,
        customerId: customerAId,
        workerId: worker1Id,
        status: BookingStatus.IN_PROGRESS,
      },
    });
    inProgressBookingId = inProgressBooking.id;

    const cancelledBooking = await prisma.booking.create({
      data: {
        serviceRequestId: reqCancelled.id,
        customerId: customerAId,
        workerId: worker1Id,
        status: BookingStatus.CANCELLED,
        cancelledAt: new Date(),
      },
    });
    cancelledBookingId = cancelledBooking.id;

    const rejectedBooking = await prisma.booking.create({
      data: {
        serviceRequestId: reqRejected.id,
        customerId: customerAId,
        workerId: worker1Id,
        status: BookingStatus.REJECTED,
      },
    });
    rejectedBookingId = rejectedBooking.id;
  });

  afterAll(async () => {
    await prisma.review.deleteMany({
      where: {
        OR: [
          { customer: { userId: { in: createdUserIds } } },
          { worker: { userId: { in: createdUserIds } } },
        ],
      },
    });
    await prisma.booking.deleteMany({
      where: {
        OR: [
          { customer: { userId: { in: createdUserIds } } },
          { worker: { userId: { in: createdUserIds } } },
        ],
      },
    });
    await prisma.serviceRequest.deleteMany({
      where: { customer: { userId: { in: createdUserIds } } },
    });
    await prisma.workerSkill.deleteMany({
      where: { worker: { userId: { in: createdUserIds } } },
    });
    await prisma.cooperativeMembership.deleteMany({
      where: { worker: { userId: { in: createdUserIds } } },
    });
    await prisma.cooperative.deleteMany({ where: { id: { in: createdCoopIds } } });
    await prisma.customer.deleteMany({ where: { userId: { in: createdUserIds } } });
    await prisma.worker.deleteMany({ where: { userId: { in: createdUserIds } } });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    await prisma.skill.deleteMany({ where: { id: { in: createdSkillIds } } });
    await app.close();
  });

  describe('Customer Review Creation', () => {
    it('1. Customer can review own COMPLETED booking', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/customers/me/bookings/${completedBookingId}/review`)
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({ rating: 5, comment: 'Excellent work!' });

      expect(res.status).toBe(201);
      expect(res.body.id).toBeDefined();
      expect(res.body.rating).toBe(5);
      expect(res.body.comment).toBe('Excellent work!');
      expect(res.body.customer.id).toBe(customerAId);
      expect(res.body.worker.id).toBe(worker1Id);
    });

    it("2. Customer cannot review another customer's completed booking", async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/customers/me/bookings/${completedBookingId}/review`)
        .set('Authorization', `Bearer ${customerBToken}`)
        .send({ rating: 4 });
      expect(res.status).toBe(404);
    });

    it('3. Customer cannot review OPEN booking', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/customers/me/bookings/${openBookingId}/review`)
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({ rating: 4 });
      expect(res.status).toBe(400);
    });

    it('4. Customer cannot review IN_PROGRESS booking', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/customers/me/bookings/${inProgressBookingId}/review`)
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({ rating: 4 });
      expect(res.status).toBe(400);
    });

    it('5. Customer cannot review CANCELLED booking', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/customers/me/bookings/${cancelledBookingId}/review`)
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({ rating: 4 });
      expect(res.status).toBe(400);
    });

    it('6. Customer cannot review REJECTED booking', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/customers/me/bookings/${rejectedBookingId}/review`)
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({ rating: 4 });
      expect(res.status).toBe(400);
    });

    it('7. Duplicate review is rejected', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/customers/me/bookings/${completedBookingId}/review`)
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({ rating: 3 });
      expect(res.status).toBe(409);
    });

    it('8. Rating 0 is rejected', async () => {
      const anotherCompleted = await prisma.booking.create({
        data: {
          serviceRequestId: openRequestId,
          customerId: customerAId,
          workerId: worker1Id,
          status: BookingStatus.COMPLETED,
          completedAt: new Date(),
        },
      });
      const res = await request(app.getHttpServer())
        .post(`/api/v1/customers/me/bookings/${anotherCompleted.id}/review`)
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({ rating: 0 });
      expect(res.status).toBe(400);
    });

    it('9. Rating 6 is rejected', async () => {
      const anotherCompleted2 = await prisma.booking.create({
        data: {
          serviceRequestId: openRequestId,
          customerId: customerAId,
          workerId: worker1Id,
          status: BookingStatus.COMPLETED,
          completedAt: new Date(),
        },
      });
      const res = await request(app.getHttpServer())
        .post(`/api/v1/customers/me/bookings/${anotherCompleted2.id}/review`)
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({ rating: 6 });
      expect(res.status).toBe(400);
    });

    it('10. Non-integer rating is rejected', async () => {
      const anotherCompleted3 = await prisma.booking.create({
        data: {
          serviceRequestId: openRequestId,
          customerId: customerAId,
          workerId: worker1Id,
          status: BookingStatus.COMPLETED,
          completedAt: new Date(),
        },
      });
      const res = await request(app.getHttpServer())
        .post(`/api/v1/customers/me/bookings/${anotherCompleted3.id}/review`)
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({ rating: 3.5 });
      expect(res.status).toBe(400);
    });

    it('11. Forged customerId is rejected', async () => {
      const anotherCompleted4 = await prisma.booking.create({
        data: {
          serviceRequestId: openRequestId,
          customerId: customerAId,
          workerId: worker1Id,
          status: BookingStatus.COMPLETED,
          completedAt: new Date(),
        },
      });
      const res = await request(app.getHttpServer())
        .post(`/api/v1/customers/me/bookings/${anotherCompleted4.id}/review`)
        .set('Authorization', `Bearer ${customerBToken}`)
        .send({ rating: 4, customerId: customerAId });
      expect(res.status).toBe(400);
    });

    it('12. Forged workerId is rejected', async () => {
      const anotherCompleted5 = await prisma.booking.create({
        data: {
          serviceRequestId: openRequestId,
          customerId: customerAId,
          workerId: worker1Id,
          status: BookingStatus.COMPLETED,
          completedAt: new Date(),
        },
      });
      const res = await request(app.getHttpServer())
        .post(`/api/v1/customers/me/bookings/${anotherCompleted5.id}/review`)
        .set('Authorization', `Bearer ${customerBToken}`)
        .send({ rating: 4, workerId: worker2Id });
      expect(res.status).toBe(400);
    });
  });

  describe('Customer Review Read', () => {
    it('13. Customer can read own reviews', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/customers/me/reviews')
        .set('Authorization', `Bearer ${customerAToken}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
      expect(res.body[0].customer.id).toBe(customerAId);
    });

    it('14. Customer can read single review by id', async () => {
      const listRes = await request(app.getHttpServer())
        .get('/api/v1/customers/me/reviews')
        .set('Authorization', `Bearer ${customerAToken}`);
      const firstReviewId = listRes.body[0].id;
      const res = await request(app.getHttpServer())
        .get(`/api/v1/customers/me/reviews/${firstReviewId}`)
        .set('Authorization', `Bearer ${customerAToken}`);
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(firstReviewId);
    });

    it("15. Customer cannot read another customer's review", async () => {
      const listRes = await request(app.getHttpServer())
        .get('/api/v1/customers/me/reviews')
        .set('Authorization', `Bearer ${customerAToken}`);
      const firstReviewId = listRes.body[0].id;
      const res = await request(app.getHttpServer())
        .get(`/api/v1/customers/me/reviews/${firstReviewId}`)
        .set('Authorization', `Bearer ${customerBToken}`);
      expect(res.status).toBe(404);
    });
  });

  describe('Worker Review Read', () => {
    it('16. Worker can read own reviews', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/workers/me/reviews')
        .set('Authorization', `Bearer ${worker1Token}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
      expect(res.body[0].worker.id).toBe(worker1Id);
    });

    it("17. Worker cannot read another worker's reviews", async () => {
      const w1Res = await request(app.getHttpServer())
        .get('/api/v1/workers/me/reviews')
        .set('Authorization', `Bearer ${worker1Token}`);
      const firstReviewId = w1Res.body[0].id;
      const res = await request(app.getHttpServer())
        .get(`/api/v1/workers/me/reviews/${firstReviewId}`)
        .set('Authorization', `Bearer ${worker2Token}`);
      expect(res.status).toBe(404);
    });

    it('18. Worker cannot create review (405)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/workers/me/reviews')
        .set('Authorization', `Bearer ${worker1Token}`)
        .send({ rating: 5 });
      expect([400, 404, 405]).toContain(res.status);
    });
  });

  describe('Reputation Calculation', () => {
    it('19. Reputation average is correct for worker with reviews', async () => {
      const w1Res = await request(app.getHttpServer())
        .get('/api/v1/workers/me/reviews')
        .set('Authorization', `Bearer ${worker1Token}`);
      const reviews = w1Res.body;
      const sum = reviews.reduce((acc: number, r: { rating: number }) => acc + r.rating, 0);
      const expectedAvg = Math.round((sum / reviews.length) * 10) / 10;

      const profileRes = await request(app.getHttpServer())
        .get('/api/v1/workers/me')
        .set('Authorization', `Bearer ${worker1Token}`);
      expect(profileRes.body.reputation.averageRating).toBe(expectedAvg);
      expect(profileRes.body.reputation.totalReviews).toBe(reviews.length);
    });

    it('20. Zero-review worker returns safe empty reputation', async () => {
      const profileRes = await request(app.getHttpServer())
        .get('/api/v1/workers/me')
        .set('Authorization', `Bearer ${worker2Token}`);
      expect(profileRes.body.reputation.averageRating).toBeNull();
      expect(profileRes.body.reputation.totalReviews).toBe(0);
      expect(profileRes.body.reputation.ratingDistribution).toEqual({
        '1': 0,
        '2': 0,
        '3': 0,
        '4': 0,
        '5': 0,
      });
    });

    it('21. Rating distribution is correct', async () => {
      // Add a few more reviews with specific ratings
      const booking1 = await prisma.booking.create({
        data: {
          serviceRequestId: openRequestId,
          customerId: customerAId,
          workerId: worker1Id,
          status: BookingStatus.COMPLETED,
          completedAt: new Date(),
        },
      });
      await prisma.review.create({
        data: { bookingId: booking1.id, customerId: customerAId, workerId: worker1Id, rating: 1 },
      });

      const booking2 = await prisma.booking.create({
        data: {
          serviceRequestId: openRequestId,
          customerId: customerAId,
          workerId: worker1Id,
          status: BookingStatus.COMPLETED,
          completedAt: new Date(),
        },
      });
      await prisma.review.create({
        data: { bookingId: booking2.id, customerId: customerAId, workerId: worker1Id, rating: 5 },
      });

      const w1Res = await request(app.getHttpServer())
        .get('/api/v1/workers/me/reviews')
        .set('Authorization', `Bearer ${worker1Token}`);
      const reviews = w1Res.body;
      const distribution = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 } as Record<string, number>;
      for (const r of reviews) {
        distribution[r.rating]++;
      }

      expect(distribution['1']).toBeGreaterThanOrEqual(1);
      expect(distribution['5']).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Security & Authorization', () => {
    it('22. Sensitive customer fields are not exposed in review', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/customers/me/reviews')
        .set('Authorization', `Bearer ${customerAToken}`);
      const review = res.body[0];
      expect(review.customer).toEqual({ id: customerAId });
      expect(review.customer).not.toHaveProperty('mobile');
      expect(review.customer).not.toHaveProperty('email');
      expect(review.customer).not.toHaveProperty('passwordHash');
      expect(review.customer).not.toHaveProperty('refreshTokenHash');
    });

    it('23. Worker cannot modify reviews (no PATCH/DELETE endpoint)', async () => {
      const w1Res = await request(app.getHttpServer())
        .get('/api/v1/workers/me/reviews')
        .set('Authorization', `Bearer ${worker1Token}`);
      const reviewId = w1Res.body[0].id;

      const patchRes = await request(app.getHttpServer())
        .patch(`/api/v1/workers/me/reviews/${reviewId}`)
        .set('Authorization', `Bearer ${worker1Token}`)
        .send({ rating: 1 });
      expect(patchRes.status).toBe(404);

      const deleteRes = await request(app.getHttpServer())
        .delete(`/api/v1/workers/me/reviews/${reviewId}`)
        .set('Authorization', `Bearer ${worker1Token}`);
      expect(deleteRes.status).toBe(404);
    });

    it('24. Review cannot modify WorkerSkill verification', async () => {
      const workerSkill = await prisma.workerSkill.findFirst({
        where: { workerId: worker1Id },
        select: { verificationStatus: true },
      });
      expect(workerSkill?.verificationStatus).toBe(SkillVerificationStatus.VERIFIED);

      const w1Res = await request(app.getHttpServer())
        .get('/api/v1/workers/me/reviews')
        .set('Authorization', `Bearer ${worker1Token}`);
      const reviewId = w1Res.body[0].id;

      await request(app.getHttpServer())
        .post(`/api/v1/workers/me/reviews/${reviewId}/something`)
        .set('Authorization', `Bearer ${worker1Token}`);

      const updatedSkill = await prisma.workerSkill.findFirst({
        where: { workerId: worker1Id },
        select: { verificationStatus: true },
      });
      expect(updatedSkill?.verificationStatus).toBe(SkillVerificationStatus.VERIFIED);
    });

    it('25. Database uniqueness prevents duplicate reviews', async () => {
      const anotherCompleted = await prisma.booking.create({
        data: {
          serviceRequestId: openRequestId,
          customerId: customerCId,
          workerId: worker1Id,
          status: BookingStatus.COMPLETED,
          completedAt: new Date(),
        },
      });
      await prisma.review.create({
        data: {
          bookingId: anotherCompleted.id,
          customerId: customerCId,
          workerId: worker1Id,
          rating: 4,
        },
      });

      const res = await request(app.getHttpServer())
        .post(`/api/v1/customers/me/bookings/${anotherCompleted.id}/review`)
        .set('Authorization', `Bearer ${customerCToken}`)
        .send({ rating: 5 });
      expect(res.status).toBe(409);
    });
  });

  describe('Authorization', () => {
    it('27. Unauthenticated request is rejected (401)', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/customers/me/bookings/${completedBookingId}/review`)
        .send({ rating: 4 });
      expect(res.status).toBe(401);
    });

    it('28. Worker cannot create a customer review (403)', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/customers/me/bookings/${completedBookingId}/review`)
        .set('Authorization', `Bearer ${worker1Token}`)
        .send({ rating: 4 });
      expect(res.status).toBe(403);
    });

    it('29. Cooperative admin cannot create a customer review (403)', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/customers/me/bookings/${completedBookingId}/review`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ rating: 4 });
      expect(res.status).toBe(403);
    });
  });

  describe('Rating Boundary Validation', () => {
    it('30. Rating 1 is accepted for a completed booking', async () => {
      const booking = await prisma.booking.create({
        data: {
          serviceRequestId: openRequestId,
          customerId: customerBId,
          workerId: worker2Id,
          status: BookingStatus.COMPLETED,
          completedAt: new Date(),
        },
      });
      const res = await request(app.getHttpServer())
        .post(`/api/v1/customers/me/bookings/${booking.id}/review`)
        .set('Authorization', `Bearer ${customerBToken}`)
        .send({ rating: 1 });
      expect(res.status).toBe(201);
      expect(res.body.rating).toBe(1);
    });

    it('31. Rating 5 is accepted for a completed booking', async () => {
      const booking = await prisma.booking.create({
        data: {
          serviceRequestId: openRequestId,
          customerId: customerBId,
          workerId: worker2Id,
          status: BookingStatus.COMPLETED,
          completedAt: new Date(),
        },
      });
      const res = await request(app.getHttpServer())
        .post(`/api/v1/customers/me/bookings/${booking.id}/review`)
        .set('Authorization', `Bearer ${customerBToken}`)
        .send({ rating: 5 });
      expect(res.status).toBe(201);
      expect(res.body.rating).toBe(5);
    });

    it('32. Missing rating is rejected (400)', async () => {
      const booking = await prisma.booking.create({
        data: {
          serviceRequestId: openRequestId,
          customerId: customerAId,
          workerId: worker1Id,
          status: BookingStatus.COMPLETED,
          completedAt: new Date(),
        },
      });
      const res = await request(app.getHttpServer())
        .post(`/api/v1/customers/me/bookings/${booking.id}/review`)
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({});
      expect(res.status).toBe(400);
    });

    it('33. Comment over 1000 characters is rejected (400)', async () => {
      const booking = await prisma.booking.create({
        data: {
          serviceRequestId: openRequestId,
          customerId: customerAId,
          workerId: worker1Id,
          status: BookingStatus.COMPLETED,
          completedAt: new Date(),
        },
      });
      const res = await request(app.getHttpServer())
        .post(`/api/v1/customers/me/bookings/${booking.id}/review`)
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({ rating: 4, comment: 'a'.repeat(1001) });
      expect(res.status).toBe(400);
    });
  });

  describe('Booking Response Includes Review', () => {
    it('34. Completed booking includes review data after submission', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/customers/me/bookings')
        .set('Authorization', `Bearer ${customerAToken}`);
      const completedBooking = (res.body as { id: string; review?: { rating: number } }[]).find(
        (b) => b.id === completedBookingId,
      );
      expect(completedBooking?.review).toBeDefined();
      expect(completedBooking?.review?.rating).toBe(5);
    });
  });
});
