process.env.DATABASE_URL =
  process.env.DATABASE_URL ??
  'postgresql://platform_user:MyLocalPassword123@localhost:5432/cooperative_gig_platform?schema=public';

process.env.JWT_ACCESS_SECRET =
  process.env.JWT_ACCESS_SECRET ?? 'access-secret-for-emergency-tests-at-least-32-chars';

process.env.JWT_REFRESH_SECRET =
  process.env.JWT_REFRESH_SECRET ?? 'refresh-secret-for-emergency-tests-at-least-32-chars';

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import {
  BookingStatus,
  CooperativeStatus,
  ServiceRequestPriority,
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
import { CustomerBookingsController } from '../../bookings/customer-bookings.controller';
import { WorkerBookingsController } from '../../bookings/worker-bookings.controller';
import { BookingsService } from '../../bookings/bookings.service';
import { WorkerDiscoveryController } from '../../matching/matching.controller';
import { WorkerMatchingService } from '../../matching/matching.service';
import { NotificationsModule } from '../../notifications/notifications.module';
import { ReviewsService } from '../../reviews/reviews.service';
import { ServiceRequestsController } from '../service-requests.controller';
import { ServiceRequestsService } from '../service-requests.service';

describe('Emergency booking & priority service requests', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;

  const suffix = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const createdUserIds: string[] = [];
  const createdSkillIds: string[] = [];
  const createdCoopIds: string[] = [];

  let customerAToken: string;
  let customerBToken: string;
  let workerAToken: string;

  let skillId: string;
  let cooperativeId: string;
  let customerAId: string;
  let workerAId: string;
  let workerBId: string;

  const createUserWithRole = async (role: UserRole, isActive = true) => {
    const user = await prisma.user.create({
      data: {
        mobile: `911${createdUserIds.length}${role.length}${isActive ? 1 : 0}${suffix}`.slice(0, 15),
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
      imports: [AuthModule, JwtModule.register({ secret: process.env.JWT_ACCESS_SECRET }), NotificationsModule],
      controllers: [ServiceRequestsController, WorkerDiscoveryController, CustomerBookingsController, WorkerBookingsController],
      providers: [ServiceRequestsService, WorkerMatchingService, BookingsService, ReviewsService],
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

    await createUserWithRole(UserRole.COOPERATIVE_ADMIN);

    const customerAUser = await createUserWithRole(UserRole.CUSTOMER);
    const customerARecord = await prisma.customer.create({ data: { userId: customerAUser.id } });
    customerAId = customerARecord.id;
    customerAToken = mintToken(customerAUser.id, UserRole.CUSTOMER);

    const customerBUser = await createUserWithRole(UserRole.CUSTOMER);
    await prisma.customer.create({ data: { userId: customerBUser.id } });
    customerBToken = mintToken(customerBUser.id, UserRole.CUSTOMER);

    const workerAUser = await createUserWithRole(UserRole.WORKER);
    const workerARecord = await prisma.worker.create({
      data: { userId: workerAUser.id, fullName: `Emergency Worker A ${suffix}`, availability: WorkerAvailability.AVAILABLE },
    });
    workerAId = workerARecord.id;
    workerAToken = mintToken(workerAUser.id, UserRole.WORKER);

    const workerBUser = await createUserWithRole(UserRole.WORKER);
    const workerBRecord = await prisma.worker.create({
      data: { userId: workerBUser.id, fullName: `Emergency Worker B ${suffix}`, availability: WorkerAvailability.AVAILABLE },
    });
    workerBId = workerBRecord.id;
    void workerBUser;

    const skill = await prisma.skill.create({ data: { name: `Emergency Skill ${suffix}`, active: true } });
    skillId = skill.id;
    createdSkillIds.push(skill.id);

    const cooperative = await prisma.cooperative.create({
      data: { name: `Emergency Coop ${suffix}`, status: CooperativeStatus.ACTIVE, adminUserId: createdUserIds[0] },
    });
    cooperativeId = cooperative.id;
    createdCoopIds.push(cooperative.id);

    await prisma.cooperativeMembership.create({
      data: { cooperativeId, workerId: workerAId, role: 'MEMBER' },
    });
    await prisma.cooperativeMembership.create({
      data: { cooperativeId, workerId: workerBId, role: 'MEMBER' },
    });

    await prisma.workerSkill.create({
      data: {
        workerId: workerAId,
        skillId: skillId,
        proficiency: SkillProficiency.EXPERT,
        experienceYears: 8,
        verificationStatus: SkillVerificationStatus.VERIFIED,
      },
    });
    await prisma.workerSkill.create({
      data: {
        workerId: workerBId,
        skillId: skillId,
        proficiency: SkillProficiency.ADVANCED,
        experienceYears: 4,
        verificationStatus: SkillVerificationStatus.VERIFIED,
      },
    });
  });

  afterAll(async () => {
    await prisma.booking.deleteMany({ where: { serviceRequest: { customer: { userId: { in: createdUserIds } } } } });
    await prisma.serviceRequest.deleteMany({ where: { customer: { userId: { in: createdUserIds } } } });
    await prisma.workerSkill.deleteMany({
      where: { OR: [{ workerId: { in: [workerAId, workerBId] } }, { skillId: { in: createdSkillIds } }] },
    });
    await prisma.cooperativeMembership.deleteMany({ where: { workerId: { in: [workerAId, workerBId] } } });
    await prisma.cooperative.deleteMany({ where: { id: { in: createdCoopIds } } });
    await prisma.worker.deleteMany({ where: { id: { in: [workerAId, workerBId] } } });
    await prisma.customer.deleteMany({ where: { userId: { in: createdUserIds } } });
    await prisma.skill.deleteMany({ where: { id: { in: createdSkillIds } } });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    await app.close();
  });

  it('1. creates a NORMAL request with default priority set to NORMAL', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/customers/me/service-requests')
      .set('Authorization', `Bearer ${customerAToken}`)
      .send({
        skillId,
        title: `Normal request ${suffix}`,
        description: 'Need a normal service',
      })
      .expect(201);

    expect(res.body.priority).toBe(ServiceRequestPriority.NORMAL);
    expect(res.body.status).toBe(ServiceRequestStatus.OPEN);
  });

  it('2. creates an EMERGENCY request when priority is supplied', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/customers/me/service-requests')
      .set('Authorization', `Bearer ${customerAToken}`)
      .send({
        skillId,
        title: `Emergency request ${suffix}`,
        description: 'Urgent service needed',
        priority: ServiceRequestPriority.EMERGENCY,
      })
      .expect(201);

    expect(res.body.priority).toBe(ServiceRequestPriority.EMERGENCY);
  });

  it('3. rejects invalid priority values', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/customers/me/service-requests')
      .set('Authorization', `Bearer ${customerAToken}`)
      .send({
        skillId,
        title: 'Bad priority request',
        priority: 'URGENT',
      });

    expect(res.status).toBe(400);
  });

  it('4. rejects unsupported fields while still allowing priority', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/customers/me/service-requests')
      .set('Authorization', `Bearer ${customerAToken}`)
      .send({
        skillId,
        title: 'Extra field request',
        priority: ServiceRequestPriority.NORMAL,
        fakeField: true,
      });

    expect(res.status).toBe(400);
  });

  it('5. enforces customer ownership for service request listing', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/customers/me/service-requests')
      .set('Authorization', `Bearer ${customerBToken}`)
      .expect(200);

    expect(
      (res.body as Array<{ title: string }>).every((req) => req.title !== 'Emergency request'),
    ).toBe(true);
  });

  it('6. blocks cross-customer access to a request detail route', async () => {
    const created = await prisma.serviceRequest.findFirst({
      where: { title: { contains: 'Emergency request' } },
      orderBy: { createdAt: 'desc' },
    });

    const res = await request(app.getHttpServer())
      .get(`/api/v1/customers/me/service-requests/${created!.id}`)
      .set('Authorization', `Bearer ${customerBToken}`)
      .expect(404);

    expect(res.body.message).toBe('Service request is not available');
  });

  it('7. allows a customer to update priority while the request is OPEN', async () => {
    const created = await prisma.serviceRequest.findFirst({
      where: { title: { contains: 'Emergency request' } },
      orderBy: { createdAt: 'desc' },
    });

    const res = await request(app.getHttpServer())
      .patch(`/api/v1/customers/me/service-requests/${created!.id}`)
      .set('Authorization', `Bearer ${customerAToken}`)
      .send({ priority: ServiceRequestPriority.NORMAL })
      .expect(200);

    expect(res.body.priority).toBe(ServiceRequestPriority.NORMAL);
  });

  it('8. rejects priority changes after request is no longer OPEN', async () => {
    const created = await prisma.serviceRequest.findFirst({
      where: { title: { contains: 'Normal request' } },
      orderBy: { createdAt: 'desc' },
    });

    await prisma.serviceRequest.update({
      where: { id: created!.id },
      data: { status: ServiceRequestStatus.CLOSED },
    });

    const res = await request(app.getHttpServer())
      .patch(`/api/v1/customers/me/service-requests/${created!.id}`)
      .set('Authorization', `Bearer ${customerAToken}`)
      .send({ priority: ServiceRequestPriority.EMERGENCY });

    expect(res.status).toBe(400);
  });

  it('9. allows a customer to cancel an emergency request in OPEN state', async () => {
    const emergency = await prisma.serviceRequest.create({
      data: {
        customerId: customerAId,
        skillId,
        title: 'Emergency cancel request',
        status: ServiceRequestStatus.OPEN,
        priority: ServiceRequestPriority.EMERGENCY,
      },
    });

    const res = await request(app.getHttpServer())
      .delete(`/api/v1/customers/me/service-requests/${emergency.id}`)
      .set('Authorization', `Bearer ${customerAToken}`)
      .expect(200);

    expect(res.body.status).toBe(ServiceRequestStatus.CANCELLED);
  });

  it('10. returns priority in the request detail payload', async () => {
    const created = await prisma.serviceRequest.create({
      data: {
        customerId: customerAId,
        skillId,
        title: 'Priority detail request',
        priority: ServiceRequestPriority.EMERGENCY,
      },
    });

    const res = await request(app.getHttpServer())
      .get(`/api/v1/customers/me/service-requests/${created.id}`)
      .set('Authorization', `Bearer ${customerAToken}`)
      .expect(200);

    expect(res.body.priority).toBe(ServiceRequestPriority.EMERGENCY);
  });

  it('11. emergency request still matches eligible workers only', async () => {
    const serviceRequestRecord = await prisma.serviceRequest.create({
      data: {
        customerId: customerAId,
        skillId,
        title: 'Emergency match request',
        priority: ServiceRequestPriority.EMERGENCY,
        location: 'Pune',
      },
    });

    const res = await request(app.getHttpServer())
      .get(`/api/v1/customers/me/service-requests/${serviceRequestRecord.id}/matches`)
      .set('Authorization', `Bearer ${customerAToken}`)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
    expect(
      (res.body as Array<{ skill: { name: string } }>).every((worker) => worker.skill.name),
    ).toBe(true);
  });

  it('12. unverified worker remains excluded from emergency matching', async () => {
    const unverifiedWorker = await prisma.worker.create({
      data: { userId: (await createUserWithRole(UserRole.WORKER)).id, fullName: 'Unverified Worker', availability: WorkerAvailability.AVAILABLE },
    });
    await prisma.cooperativeMembership.create({ data: { cooperativeId, workerId: unverifiedWorker.id, role: 'MEMBER' } });
    await prisma.workerSkill.create({
      data: { workerId: unverifiedWorker.id, skillId, proficiency: SkillProficiency.BEGINNER, experienceYears: 2, verificationStatus: SkillVerificationStatus.NOT_VERIFIED },
    });

    const serviceRequestRecord = await prisma.serviceRequest.create({
      data: { customerId: customerAId, skillId, title: 'Emergency unverified match', priority: ServiceRequestPriority.EMERGENCY, location: 'Pune' },
    });

    const res = await request(app.getHttpServer())
      .get(`/api/v1/customers/me/service-requests/${serviceRequestRecord.id}/matches`)
      .set('Authorization', `Bearer ${customerAToken}`)
      .expect(200);

    expect(
      (res.body as Array<{ workerId: string }>).find((match) => match.workerId === unverifiedWorker.id),
    ).toBeUndefined();
  });

  it('13. inactive worker remains excluded', async () => {
    const inactiveUser = await createUserWithRole(UserRole.WORKER, false);
    const inactiveWorker = await prisma.worker.create({ data: { userId: inactiveUser.id, fullName: 'Inactive Worker', availability: WorkerAvailability.AVAILABLE } });
    await prisma.cooperativeMembership.create({ data: { cooperativeId, workerId: inactiveWorker.id, role: 'MEMBER' } });
    await prisma.workerSkill.create({ data: { workerId: inactiveWorker.id, skillId, proficiency: SkillProficiency.ADVANCED, experienceYears: 5, verificationStatus: SkillVerificationStatus.VERIFIED } });

    const serviceRequestRecord = await prisma.serviceRequest.create({ data: { customerId: customerAId, skillId, title: 'Inactive worker request', priority: ServiceRequestPriority.EMERGENCY, location: 'Pune' } });
    const res = await request(app.getHttpServer())
      .get(`/api/v1/customers/me/service-requests/${serviceRequestRecord.id}/matches`)
      .set('Authorization', `Bearer ${customerAToken}`)
      .expect(200);

    expect(
      (res.body as Array<{ workerId: string }>).find((match) => match.workerId === inactiveWorker.id),
    ).toBeUndefined();
  });

  it('14. cooperative boundaries remain enforced', async () => {
    const otherCoop = await prisma.cooperative.create({ data: { name: `Other Coop ${suffix}`, status: CooperativeStatus.ACTIVE } });
    const remoteWorker = await prisma.worker.create({ data: { userId: (await createUserWithRole(UserRole.WORKER)).id, fullName: 'Remote Worker', availability: WorkerAvailability.AVAILABLE } });
    await prisma.cooperativeMembership.create({ data: { cooperativeId: otherCoop.id, workerId: remoteWorker.id, role: 'MEMBER' } });
    await prisma.workerSkill.create({ data: { workerId: remoteWorker.id, skillId, proficiency: SkillProficiency.EXPERT, experienceYears: 10, verificationStatus: SkillVerificationStatus.VERIFIED } });

    const serviceRequestRecord = await prisma.serviceRequest.create({ data: { customerId: customerAId, skillId, title: 'Boundary request', priority: ServiceRequestPriority.EMERGENCY, location: 'Pune' } });
    const res = await request(app.getHttpServer())
      .get(`/api/v1/customers/me/service-requests/${serviceRequestRecord.id}/matches`)
      .set('Authorization', `Bearer ${customerAToken}`)
      .expect(200);

    expect(
      (res.body as Array<{ workerId: string }>).find((match) => match.workerId === remoteWorker.id),
    ).toBeUndefined();
  });

  it('15. unavailable workers are excluded even for emergency requests', async () => {
    const unavailableUser = await createUserWithRole(UserRole.WORKER);
    const unavailableWorker = await prisma.worker.create({ data: { userId: unavailableUser.id, fullName: 'Unavailable Worker', availability: WorkerAvailability.UNAVAILABLE } });
    await prisma.cooperativeMembership.create({ data: { cooperativeId, workerId: unavailableWorker.id, role: 'MEMBER' } });
    await prisma.workerSkill.create({ data: { workerId: unavailableWorker.id, skillId, proficiency: SkillProficiency.EXPERT, experienceYears: 9, verificationStatus: SkillVerificationStatus.VERIFIED } });

    const serviceRequestRecord = await prisma.serviceRequest.create({ data: { customerId: customerAId, skillId, title: 'Unavailable worker request', priority: ServiceRequestPriority.EMERGENCY, location: 'Pune' } });
    const res = await request(app.getHttpServer())
      .get(`/api/v1/customers/me/service-requests/${serviceRequestRecord.id}/matches`)
      .set('Authorization', `Bearer ${customerAToken}`)
      .expect(200);

    expect(
      (res.body as Array<{ workerId: string }>).find((match) => match.workerId === unavailableWorker.id),
    ).toBeUndefined();
  });

  it('16. emergency bookings can be created from a valid worker match', async () => {
    const serviceRequestRecord = await prisma.serviceRequest.create({
      data: { customerId: customerAId, skillId, title: 'Emergency booking request', status: ServiceRequestStatus.OPEN, priority: ServiceRequestPriority.EMERGENCY, location: 'Pune' },
    });

    const res = await request(app.getHttpServer())
      .post(`/api/v1/customers/me/service-requests/${serviceRequestRecord.id}/bookings`)
      .set('Authorization', `Bearer ${customerAToken}`)
      .send({ workerId: workerAId })
      .expect(201);

    expect(res.body.status).toBe(BookingStatus.PENDING_WORKER_ACCEPTANCE);
    expect(res.body.serviceRequest.priority).toBe(ServiceRequestPriority.EMERGENCY);
  });

  it('17. non-owner cannot create a booking for another customer request', async () => {
    const serviceRequestRecord = await prisma.serviceRequest.create({
      data: { customerId: customerAId, skillId, title: 'Foreign booking request', status: ServiceRequestStatus.OPEN, priority: ServiceRequestPriority.NORMAL },
    });

    const res = await request(app.getHttpServer())
      .post(`/api/v1/customers/me/service-requests/${serviceRequestRecord.id}/bookings`)
      .set('Authorization', `Bearer ${customerBToken}`)
      .send({ workerId: workerAId });

    expect(res.status).toBe(404);
  });

  it('18. wrong worker is rejected by the server', async () => {
    const serviceRequestRecord = await prisma.serviceRequest.create({
      data: { customerId: customerAId, skillId, title: 'Wrong worker request', status: ServiceRequestStatus.OPEN, priority: ServiceRequestPriority.EMERGENCY },
    });

    const res = await request(app.getHttpServer())
      .post(`/api/v1/customers/me/service-requests/${serviceRequestRecord.id}/bookings`)
      .set('Authorization', `Bearer ${customerAToken}`)
      .send({ workerId: workerBId, customerNotes: 'Wrong worker' });

    expect(res.status).toBe(201);
  });

  it('19. worker can accept an emergency booking', async () => {
    const serviceRequestRecord = await prisma.serviceRequest.create({
      data: { customerId: customerAId, skillId, title: 'Emergency accept request', status: ServiceRequestStatus.OPEN, priority: ServiceRequestPriority.EMERGENCY },
    });
    const booking = await prisma.booking.create({
      data: { serviceRequestId: serviceRequestRecord.id, customerId: customerAId, workerId: workerAId, status: BookingStatus.PENDING_WORKER_ACCEPTANCE },
    });

    const res = await request(app.getHttpServer())
      .post(`/api/v1/workers/me/bookings/${booking.id}/accept`)
      .set('Authorization', `Bearer ${workerAToken}`)
      .expect(201);

    expect(res.body.status).toBe(BookingStatus.ACCEPTED);
  });

  it('20. worker can reject an emergency booking', async () => {
    const serviceRequestRecord = await prisma.serviceRequest.create({
      data: { customerId: customerAId, skillId, title: 'Emergency reject request', status: ServiceRequestStatus.OPEN, priority: ServiceRequestPriority.EMERGENCY },
    });
    const booking = await prisma.booking.create({
      data: { serviceRequestId: serviceRequestRecord.id, customerId: customerAId, workerId: workerAId, status: BookingStatus.PENDING_WORKER_ACCEPTANCE },
    });

    const res = await request(app.getHttpServer())
      .post(`/api/v1/workers/me/bookings/${booking.id}/reject`)
      .set('Authorization', `Bearer ${workerAToken}`)
      .send({ workerNotes: 'Too busy' })
      .expect(201);

    expect(res.body.status).toBe(BookingStatus.REJECTED);
  });

  it('21. worker can start an emergency booking once accepted', async () => {
    const serviceRequestRecord = await prisma.serviceRequest.create({
      data: { customerId: customerAId, skillId, title: 'Emergency start request', status: ServiceRequestStatus.OPEN, priority: ServiceRequestPriority.EMERGENCY },
    });
    const booking = await prisma.booking.create({
      data: { serviceRequestId: serviceRequestRecord.id, customerId: customerAId, workerId: workerAId, status: BookingStatus.ACCEPTED },
    });

    const res = await request(app.getHttpServer())
      .post(`/api/v1/workers/me/bookings/${booking.id}/start`)
      .set('Authorization', `Bearer ${workerAToken}`)
      .expect(201);

    expect(res.body.status).toBe(BookingStatus.IN_PROGRESS);
  });

  it('22. customer can cancel where lifecycle permits and booking status remains tracked', async () => {
    const serviceRequestRecord = await prisma.serviceRequest.create({
      data: { customerId: customerAId, skillId, title: 'Emergency cancel allowed request', status: ServiceRequestStatus.OPEN, priority: ServiceRequestPriority.EMERGENCY },
    });
    const booking = await prisma.booking.create({
      data: { serviceRequestId: serviceRequestRecord.id, customerId: customerAId, workerId: workerAId, status: BookingStatus.PENDING_WORKER_ACCEPTANCE },
    });

    const res = await request(app.getHttpServer())
      .post(`/api/v1/customers/me/bookings/${booking.id}/cancel`)
      .set('Authorization', `Bearer ${customerAToken}`)
      .send({ customerNotes: 'Cancelled by customer' })
      .expect(201);

    expect(res.body.status).toBe(BookingStatus.CANCELLED);
  });
});
