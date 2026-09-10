process.env.DATABASE_URL =
  process.env.DATABASE_URL ??
  'postgresql://platform_user:MyLocalPassword123@localhost:5432/cooperative_gig_platform?schema=public';
process.env.JWT_ACCESS_SECRET =
  process.env.JWT_ACCESS_SECRET ?? 'access-secret-for-step8-tests-at-least-32-chars';
process.env.JWT_REFRESH_SECRET =
  process.env.JWT_REFRESH_SECRET ?? 'refresh-secret-for-step8-tests-at-least-32-ch';

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
import { BookingsService } from '../bookings.service';
import { CustomerBookingsController } from '../customer-bookings.controller';
import { WorkerBookingsController } from '../worker-bookings.controller';

describe('Bookings & Worker Assignment (Step 8, real database)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;

  const suffix = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const createdUserIds: string[] = [];
  const createdSkillIds: string[] = [];
  const createdCoopIds: string[] = [];

  let customerAToken: string;
  let customerBToken: string;
  let worker1Token: string;
  let worker2Token: string;
  let adminToken: string;

  let customerAId: string;
  let worker1Id: string;
  let worker2Id: string;
  let inactiveWorkerId: string;
  let noSkillWorkerId: string;
  let unverifiedSkillWorkerId: string;
  let inactiveCoopWorkerId: string;
  let leftMembershipWorkerId: string;

  let activeSkillId: string;
  let inactiveSkillId: string;
  let activeCoopId: string;
  let openRequestId: string;
  let closedRequestId: string;
  let cancelledRequestId: string;

  const createUserWithRole = async (role: UserRole, isActive = true) => {
    const user = await prisma.user.create({
      data: {
        mobile: `9500${createdUserIds.length}${role.length}${isActive ? 1 : 0}${suffix}`.slice(
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
      controllers: [CustomerBookingsController, WorkerBookingsController],
      providers: [BookingsService],
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
        name: `Step8 Coop ${suffix}`,
        status: CooperativeStatus.ACTIVE,
      },
    });
    activeCoopId = coop.id;
    createdCoopIds.push(coop.id);

    const inactiveCoop = await prisma.cooperative.create({
      data: {
        name: `Step8 Inactive Coop ${suffix}`,
        status: CooperativeStatus.INACTIVE,
      },
    });
    createdCoopIds.push(inactiveCoop.id);

    // 2. Skills
    const activeSkill = await prisma.skill.create({
      data: { name: `Electrical ${suffix}`, active: true },
    });
    activeSkillId = activeSkill.id;
    createdSkillIds.push(activeSkill.id);

    const inactiveSkill = await prisma.skill.create({
      data: { name: `Archived Skill ${suffix}`, active: false },
    });
    inactiveSkillId = inactiveSkill.id;
    createdSkillIds.push(inactiveSkill.id);

    // 3. Customers
    const customerAUser = await createUserWithRole(UserRole.CUSTOMER);
    const customerARecord = await prisma.customer.create({ data: { userId: customerAUser.id } });
    customerAId = customerARecord.id;
    customerAToken = mintToken(customerAUser.id, UserRole.CUSTOMER);

    const customerBUser = await createUserWithRole(UserRole.CUSTOMER);
    await prisma.customer.create({ data: { userId: customerBUser.id } });
    customerBToken = mintToken(customerBUser.id, UserRole.CUSTOMER);

    // 4. Admin
    const adminUser = await createUserWithRole(UserRole.COOPERATIVE_ADMIN);
    adminToken = mintToken(adminUser.id, UserRole.COOPERATIVE_ADMIN);

    // 5. Eligible Worker 1
    const w1User = await createUserWithRole(UserRole.WORKER);
    const w1Record = await prisma.worker.create({
      data: {
        userId: w1User.id,
        fullName: `Eligible Worker 1 ${suffix}`,
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

    // 6. Eligible Worker 2
    const w2User = await createUserWithRole(UserRole.WORKER);
    const w2Record = await prisma.worker.create({
      data: {
        userId: w2User.id,
        fullName: `Eligible Worker 2 ${suffix}`,
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

    // 7. Inactive Worker
    const inactUser = await createUserWithRole(UserRole.WORKER, false);
    const inactRecord = await prisma.worker.create({
      data: { userId: inactUser.id, fullName: 'Inactive Worker' },
    });
    inactiveWorkerId = inactRecord.id;
    await prisma.cooperativeMembership.create({
      data: { cooperativeId: coop.id, workerId: inactiveWorkerId },
    });
    await prisma.workerSkill.create({
      data: {
        workerId: inactiveWorkerId,
        skillId: activeSkillId,
        verificationStatus: SkillVerificationStatus.VERIFIED,
      },
    });

    // 8. Worker without required skill
    const noSkillUser = await createUserWithRole(UserRole.WORKER);
    const noSkillRecord = await prisma.worker.create({
      data: { userId: noSkillUser.id, fullName: 'No Skill Worker' },
    });
    noSkillWorkerId = noSkillRecord.id;
    await prisma.cooperativeMembership.create({
      data: { cooperativeId: coop.id, workerId: noSkillWorkerId },
    });

    // 9. Worker with unverified skill
    const unverUser = await createUserWithRole(UserRole.WORKER);
    const unverRecord = await prisma.worker.create({
      data: { userId: unverUser.id, fullName: 'Unverified Skill Worker' },
    });
    unverifiedSkillWorkerId = unverRecord.id;
    await prisma.cooperativeMembership.create({
      data: { cooperativeId: coop.id, workerId: unverifiedSkillWorkerId },
    });
    await prisma.workerSkill.create({
      data: {
        workerId: unverifiedSkillWorkerId,
        skillId: activeSkillId,
        verificationStatus: SkillVerificationStatus.PENDING,
      },
    });

    // 10. Worker in inactive cooperative
    const inactCoopUser = await createUserWithRole(UserRole.WORKER);
    const inactCoopRecord = await prisma.worker.create({
      data: { userId: inactCoopUser.id, fullName: 'Inactive Coop Worker' },
    });
    inactiveCoopWorkerId = inactCoopRecord.id;
    await prisma.cooperativeMembership.create({
      data: { cooperativeId: inactiveCoop.id, workerId: inactiveCoopWorkerId },
    });
    await prisma.workerSkill.create({
      data: {
        workerId: inactiveCoopWorkerId,
        skillId: activeSkillId,
        verificationStatus: SkillVerificationStatus.VERIFIED,
      },
    });

    // 11. Worker who left membership
    const leftUser = await createUserWithRole(UserRole.WORKER);
    const leftRecord = await prisma.worker.create({
      data: { userId: leftUser.id, fullName: 'Left Membership Worker' },
    });
    leftMembershipWorkerId = leftRecord.id;
    await prisma.cooperativeMembership.create({
      data: {
        cooperativeId: coop.id,
        workerId: leftMembershipWorkerId,
        leftAt: new Date(),
      },
    });
    await prisma.workerSkill.create({
      data: {
        workerId: leftMembershipWorkerId,
        skillId: activeSkillId,
        verificationStatus: SkillVerificationStatus.VERIFIED,
      },
    });

    // 12. Service Requests
    const reqOpen = await prisma.serviceRequest.create({
      data: {
        customerId: customerAId,
        skillId: activeSkillId,
        title: `Need wiring help ${suffix}`,
        status: ServiceRequestStatus.OPEN,
      },
    });
    openRequestId = reqOpen.id;

    const reqClosed = await prisma.serviceRequest.create({
      data: {
        customerId: customerAId,
        skillId: activeSkillId,
        title: `Closed help ${suffix}`,
        status: ServiceRequestStatus.CLOSED,
      },
    });
    closedRequestId = reqClosed.id;

    const reqCancelled = await prisma.serviceRequest.create({
      data: {
        customerId: customerAId,
        skillId: activeSkillId,
        title: `Cancelled help ${suffix}`,
        status: ServiceRequestStatus.CANCELLED,
      },
    });
    cancelledRequestId = reqCancelled.id;
  });

  afterAll(async () => {
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

  describe('Booking Creation & Authorization', () => {
    it('1. Customer can create booking with eligible worker', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/customers/me/service-requests/${openRequestId}/bookings`)
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({
          workerId: worker1Id,
          scheduledAt: '2026-09-10T10:00:00.000Z',
          customerNotes: 'Please bring testing equipment.',
        });

      expect(res.status).toBe(201);
      expect(res.body.id).toBeDefined();
      expect(res.body.status).toBe(BookingStatus.PENDING_WORKER_ACCEPTANCE);
      expect(res.body.worker.id).toBe(worker1Id);
      expect(res.body.customerNotes).toBe('Please bring testing equipment.');
      expect(res.body.serviceRequest.id).toBe(openRequestId);

      const stored = await prisma.booking.findUnique({
        where: { id: res.body.id },
        select: { cooperativeId: true },
      });
      expect(stored?.cooperativeId).toBe(activeCoopId);
    });

    it('2. Unauthenticated user rejected with 401', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/customers/me/service-requests/${openRequestId}/bookings`)
        .send({ workerId: worker1Id });
      expect(res.status).toBe(401);
    });

    it('3. Worker cannot create customer booking (403)', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/customers/me/service-requests/${openRequestId}/bookings`)
        .set('Authorization', `Bearer ${worker1Token}`)
        .send({ workerId: worker1Id });
      expect(res.status).toBe(403);
    });

    it('4. Cooperative admin cannot create customer booking (403)', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/customers/me/service-requests/${openRequestId}/bookings`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ workerId: worker1Id });
      expect(res.status).toBe(403);
    });

    it('5. Customer cannot book another customer service request (404)', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/customers/me/service-requests/${openRequestId}/bookings`)
        .set('Authorization', `Bearer ${customerBToken}`)
        .send({ workerId: worker1Id });
      expect(res.status).toBe(404);
    });

    it('6. Unknown service request returns 404', async () => {
      const fakeId = 'a0000000-0000-0000-0000-000000000000';
      const res = await request(app.getHttpServer())
        .post(`/api/v1/customers/me/service-requests/${fakeId}/bookings`)
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({ workerId: worker1Id });
      expect(res.status).toBe(404);
    });

    it('7. Closed request cannot create booking (400)', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/customers/me/service-requests/${closedRequestId}/bookings`)
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({ workerId: worker1Id });
      expect(res.status).toBe(400);
    });

    it('8. Cancelled request cannot create booking (400)', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/customers/me/service-requests/${cancelledRequestId}/bookings`)
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({ workerId: worker1Id });
      expect(res.status).toBe(400);
    });

    it('9. Duplicate active booking rejected with 409 Conflict', async () => {
      // openRequestId already has a PENDING booking from test 1
      const res = await request(app.getHttpServer())
        .post(`/api/v1/customers/me/service-requests/${openRequestId}/bookings`)
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({ workerId: worker2Id });
      expect(res.status).toBe(409);
    });
  });

  describe('Worker Eligibility Re-validation', () => {
    let freshRequestId: string;

    beforeEach(async () => {
      const req = await prisma.serviceRequest.create({
        data: {
          customerId: customerAId,
          skillId: activeSkillId,
          title: `Fresh request ${suffix}`,
          status: ServiceRequestStatus.OPEN,
        },
      });
      freshRequestId = req.id;
    });

    afterEach(async () => {
      await prisma.booking.deleteMany({ where: { serviceRequestId: freshRequestId } });
      await prisma.serviceRequest.deleteMany({ where: { id: freshRequestId } });
    });

    it('10. Inactive worker rejected (400)', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/customers/me/service-requests/${freshRequestId}/bookings`)
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({ workerId: inactiveWorkerId });
      expect(res.status).toBe(400);
    });

    it('11. Worker without required skill rejected (400)', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/customers/me/service-requests/${freshRequestId}/bookings`)
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({ workerId: noSkillWorkerId });
      expect(res.status).toBe(400);
    });

    it('12. Unverified WorkerSkill rejected (400)', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/customers/me/service-requests/${freshRequestId}/bookings`)
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({ workerId: unverifiedSkillWorkerId });
      expect(res.status).toBe(400);
    });

    it('13. Inactive skill on service request rejected (400)', async () => {
      const inactiveReq = await prisma.serviceRequest.create({
        data: {
          customerId: customerAId,
          skillId: inactiveSkillId,
          title: `Inactive skill request ${suffix}`,
          status: ServiceRequestStatus.OPEN,
        },
      });

      const res = await request(app.getHttpServer())
        .post(`/api/v1/customers/me/service-requests/${inactiveReq.id}/bookings`)
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({ workerId: worker1Id });
      expect(res.status).toBe(400);

      await prisma.serviceRequest.delete({ where: { id: inactiveReq.id } });
    });

    it('14. Worker with inactive cooperative rejected (400)', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/customers/me/service-requests/${freshRequestId}/bookings`)
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({ workerId: inactiveCoopWorkerId });
      expect(res.status).toBe(400);
    });

    it('15. Worker with left cooperative membership rejected (400)', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/customers/me/service-requests/${freshRequestId}/bookings`)
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({ workerId: leftMembershipWorkerId });
      expect(res.status).toBe(400);
    });

    it('16. Forged customerId or cooperativeId rejected by server-side validation (400)', async () => {
      const fakeCustomerId = 'b0000000-0000-0000-0000-000000000000';
      const resCustomer = await request(app.getHttpServer())
        .post(`/api/v1/customers/me/service-requests/${freshRequestId}/bookings`)
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({
          workerId: worker1Id,
          customerId: fakeCustomerId,
        });
      expect(resCustomer.status).toBe(400);

      const fakeCooperativeId = 'c0000000-0000-0000-0000-000000000000';
      const resCoop = await request(app.getHttpServer())
        .post(`/api/v1/customers/me/service-requests/${freshRequestId}/bookings`)
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({
          workerId: worker1Id,
          cooperativeId: fakeCooperativeId,
        });
      expect(resCoop.status).toBe(400);
    });

    it('17. Invalid scheduled time rejected (400)', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/customers/me/service-requests/${freshRequestId}/bookings`)
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({
          workerId: worker1Id,
          scheduledAt: 'not-a-valid-date',
        });
      expect(res.status).toBe(400);
    });
  });

  describe('Worker Booking Lifecycle & State Transitions', () => {
    let lifecycleReqId: string;
    let bookingId: string;

    beforeAll(async () => {
      const req = await prisma.serviceRequest.create({
        data: {
          customerId: customerAId,
          skillId: activeSkillId,
          title: `Lifecycle Request ${suffix}`,
          status: ServiceRequestStatus.OPEN,
        },
      });
      lifecycleReqId = req.id;

      const res = await request(app.getHttpServer())
        .post(`/api/v1/customers/me/service-requests/${lifecycleReqId}/bookings`)
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({ workerId: worker1Id });
      bookingId = res.body.id;
    });

    it('18. Worker can see own bookings', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/workers/me/bookings')
        .set('Authorization', `Bearer ${worker1Token}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      const found = res.body.find((b: { id: string }) => b.id === bookingId);
      expect(found).toBeDefined();
    });

    it('19. Worker cannot see another worker booking (404)', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/workers/me/bookings/${bookingId}`)
        .set('Authorization', `Bearer ${worker2Token}`);
      expect(res.status).toBe(404);
    });

    it('20. Worker cannot start a pending booking (400)', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/workers/me/bookings/${bookingId}/start`)
        .set('Authorization', `Bearer ${worker1Token}`);
      expect(res.status).toBe(400);
    });

    it('21. Worker cannot complete a pending booking (400)', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/workers/me/bookings/${bookingId}/complete`)
        .set('Authorization', `Bearer ${worker1Token}`);
      expect(res.status).toBe(400);
    });

    it('22. Worker 2 cannot accept Worker 1 booking (404)', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/workers/me/bookings/${bookingId}/accept`)
        .set('Authorization', `Bearer ${worker2Token}`);
      expect(res.status).toBe(404);
    });

    it('23. Worker can accept own pending booking', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/workers/me/bookings/${bookingId}/accept`)
        .set('Authorization', `Bearer ${worker1Token}`);
      expect(res.status).toBe(201);
      expect(res.body.status).toBe(BookingStatus.ACCEPTED);

      // Verify service request transitioned to IN_PROGRESS
      const updatedReq = await prisma.serviceRequest.findUnique({
        where: { id: lifecycleReqId },
      });
      expect(updatedReq?.status).toBe(ServiceRequestStatus.IN_PROGRESS);
    });

    it('24. Worker cannot accept an already accepted booking (400)', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/workers/me/bookings/${bookingId}/accept`)
        .set('Authorization', `Bearer ${worker1Token}`);
      expect(res.status).toBe(400);
    });

    it('25. Worker cannot reject an accepted booking (400)', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/workers/me/bookings/${bookingId}/reject`)
        .set('Authorization', `Bearer ${worker1Token}`);
      expect(res.status).toBe(400);
    });

    it('26. Worker can start accepted booking', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/workers/me/bookings/${bookingId}/start`)
        .set('Authorization', `Bearer ${worker1Token}`);
      expect(res.status).toBe(201);
      expect(res.body.status).toBe(BookingStatus.IN_PROGRESS);
      expect(res.body.startedAt).toBeDefined();
    });

    it('27. Customer cannot cancel an IN_PROGRESS booking (400)', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/customers/me/bookings/${bookingId}/cancel`)
        .set('Authorization', `Bearer ${customerAToken}`);
      expect(res.status).toBe(400);
    });

    it('28. Worker can complete in-progress booking', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/workers/me/bookings/${bookingId}/complete`)
        .set('Authorization', `Bearer ${worker1Token}`)
        .send({ workerNotes: 'Wiring fixed and safety tested.' });
      expect(res.status).toBe(201);
      expect(res.body.status).toBe(BookingStatus.COMPLETED);
      expect(res.body.completedAt).toBeDefined();
      expect(res.body.workerNotes).toBe('Wiring fixed and safety tested.');

      // Verify service request transitioned to CLOSED
      const updatedReq = await prisma.serviceRequest.findUnique({
        where: { id: lifecycleReqId },
      });
      expect(updatedReq?.status).toBe(ServiceRequestStatus.CLOSED);
    });

    it('29. Terminal COMPLETED booking cannot be accepted, rejected, or cancelled (400)', async () => {
      const resAccept = await request(app.getHttpServer())
        .post(`/api/v1/workers/me/bookings/${bookingId}/accept`)
        .set('Authorization', `Bearer ${worker1Token}`);
      expect(resAccept.status).toBe(400);

      const resReject = await request(app.getHttpServer())
        .post(`/api/v1/workers/me/bookings/${bookingId}/reject`)
        .set('Authorization', `Bearer ${worker1Token}`);
      expect(resReject.status).toBe(400);

      const resCancel = await request(app.getHttpServer())
        .post(`/api/v1/customers/me/bookings/${bookingId}/cancel`)
        .set('Authorization', `Bearer ${customerAToken}`);
      expect(resCancel.status).toBe(400);
    });
  });

  describe('Rejection & Cancellation Branches', () => {
    it('30. Worker can reject pending booking, service request remains OPEN', async () => {
      const req = await prisma.serviceRequest.create({
        data: {
          customerId: customerAId,
          skillId: activeSkillId,
          title: `Reject Test Request ${suffix}`,
          status: ServiceRequestStatus.OPEN,
        },
      });

      const createRes = await request(app.getHttpServer())
        .post(`/api/v1/customers/me/service-requests/${req.id}/bookings`)
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({ workerId: worker1Id });

      const rejectRes = await request(app.getHttpServer())
        .post(`/api/v1/workers/me/bookings/${createRes.body.id}/reject`)
        .set('Authorization', `Bearer ${worker1Token}`)
        .send({ workerNotes: 'Schedule conflict' });

      expect(rejectRes.status).toBe(201);
      expect(rejectRes.body.status).toBe(BookingStatus.REJECTED);
      expect(rejectRes.body.workerNotes).toBe('Schedule conflict');

      // Request should remain OPEN
      const refreshedReq = await prisma.serviceRequest.findUnique({ where: { id: req.id } });
      expect(refreshedReq?.status).toBe(ServiceRequestStatus.OPEN);

      // Customer should now be able to book another worker
      const rebookRes = await request(app.getHttpServer())
        .post(`/api/v1/customers/me/service-requests/${req.id}/bookings`)
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({ workerId: worker2Id });
      expect(rebookRes.status).toBe(201);
      expect(rebookRes.body.worker.id).toBe(worker2Id);
    });

    it('31. Customer can cancel pending booking', async () => {
      const req = await prisma.serviceRequest.create({
        data: {
          customerId: customerAId,
          skillId: activeSkillId,
          title: `Cancel Pending Request ${suffix}`,
          status: ServiceRequestStatus.OPEN,
        },
      });

      const createRes = await request(app.getHttpServer())
        .post(`/api/v1/customers/me/service-requests/${req.id}/bookings`)
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({ workerId: worker1Id });

      const cancelRes = await request(app.getHttpServer())
        .post(`/api/v1/customers/me/bookings/${createRes.body.id}/cancel`)
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({ customerNotes: 'Plans changed' });

      expect(cancelRes.status).toBe(201);
      expect(cancelRes.body.status).toBe(BookingStatus.CANCELLED);
      expect(cancelRes.body.cancelledAt).toBeDefined();

      // Cancelled booking cannot be accepted
      const acceptRes = await request(app.getHttpServer())
        .post(`/api/v1/workers/me/bookings/${createRes.body.id}/accept`)
        .set('Authorization', `Bearer ${worker1Token}`);
      expect(acceptRes.status).toBe(400);
    });

    it('32. Customer can cancel accepted booking, service request reverts to OPEN', async () => {
      const req = await prisma.serviceRequest.create({
        data: {
          customerId: customerAId,
          skillId: activeSkillId,
          title: `Cancel Accepted Request ${suffix}`,
          status: ServiceRequestStatus.OPEN,
        },
      });

      const createRes = await request(app.getHttpServer())
        .post(`/api/v1/customers/me/service-requests/${req.id}/bookings`)
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({ workerId: worker1Id });

      await request(app.getHttpServer())
        .post(`/api/v1/workers/me/bookings/${createRes.body.id}/accept`)
        .set('Authorization', `Bearer ${worker1Token}`);

      const cancelRes = await request(app.getHttpServer())
        .post(`/api/v1/customers/me/bookings/${createRes.body.id}/cancel`)
        .set('Authorization', `Bearer ${customerAToken}`);

      expect(cancelRes.status).toBe(201);
      expect(cancelRes.body.status).toBe(BookingStatus.CANCELLED);

      const refreshedReq = await prisma.serviceRequest.findUnique({ where: { id: req.id } });
      expect(refreshedReq?.status).toBe(ServiceRequestStatus.OPEN);
    });
  });

  describe('Customer Access, Privacy & Concurrency', () => {
    it('33. Customer can view own bookings list and detail', async () => {
      const resList = await request(app.getHttpServer())
        .get('/api/v1/customers/me/bookings')
        .set('Authorization', `Bearer ${customerAToken}`);
      expect(resList.status).toBe(200);
      expect(Array.isArray(resList.body)).toBe(true);

      const firstBooking = resList.body[0];
      const resDetail = await request(app.getHttpServer())
        .get(`/api/v1/customers/me/bookings/${firstBooking.id}`)
        .set('Authorization', `Bearer ${customerAToken}`);
      expect(resDetail.status).toBe(200);
      expect(resDetail.body.id).toBe(firstBooking.id);
    });

    it('34. Customer cannot view another customer booking (404)', async () => {
      const resList = await request(app.getHttpServer())
        .get('/api/v1/customers/me/bookings')
        .set('Authorization', `Bearer ${customerAToken}`);
      const firstBooking = resList.body[0];

      const resOther = await request(app.getHttpServer())
        .get(`/api/v1/customers/me/bookings/${firstBooking.id}`)
        .set('Authorization', `Bearer ${customerBToken}`);
      expect(resOther.status).toBe(404);
    });

    it('35. Privacy check: Booking DTO never leaks passwordHash, tokens, or private admin fields', async () => {
      const resList = await request(app.getHttpServer())
        .get('/api/v1/customers/me/bookings')
        .set('Authorization', `Bearer ${customerAToken}`);
      const booking = resList.body[0];

      const raw = JSON.stringify(booking);
      expect(raw).not.toContain('passwordHash');
      expect(raw).not.toContain('refreshTokenHash');
      expect(raw).not.toContain('JWT');
      expect(raw).not.toContain('verificationNotes');
      expect(raw).not.toContain('adminUserId');
    });

    it('36. Concurrency check: simultaneous booking attempts cannot create two active assignments', async () => {
      const req = await prisma.serviceRequest.create({
        data: {
          customerId: customerAId,
          skillId: activeSkillId,
          title: `Concurrent Request ${suffix}`,
          status: ServiceRequestStatus.OPEN,
        },
      });

      // Run two simultaneous booking requests for the same service request
      const [res1, res2] = await Promise.all([
        request(app.getHttpServer())
          .post(`/api/v1/customers/me/service-requests/${req.id}/bookings`)
          .set('Authorization', `Bearer ${customerAToken}`)
          .send({ workerId: worker1Id }),
        request(app.getHttpServer())
          .post(`/api/v1/customers/me/service-requests/${req.id}/bookings`)
          .set('Authorization', `Bearer ${customerAToken}`)
          .send({ workerId: worker2Id }),
      ]);

      const statuses = [res1.status, res2.status].sort();
      // Exactly one must succeed (201) and the other must fail with conflict (409)
      expect(statuses).toEqual([201, 409]);

      // Verify at the database level that exactly one booking exists
      const count = await prisma.booking.count({
        where: {
          serviceRequestId: req.id,
          status: {
            in: [
              BookingStatus.PENDING_WORKER_ACCEPTANCE,
              BookingStatus.ACCEPTED,
              BookingStatus.IN_PROGRESS,
            ],
          },
        },
      });
      expect(count).toBe(1);
    });
  });
});
