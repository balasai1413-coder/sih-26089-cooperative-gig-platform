process.env.DATABASE_URL =
  process.env.DATABASE_URL ??
  'postgresql://platform_user:MyLocalPassword123@localhost:5432/cooperative_gig_platform?schema=public';
process.env.JWT_ACCESS_SECRET =
  process.env.JWT_ACCESS_SECRET ?? 'access-secret-for-step9-tests-at-least-32-chars';
process.env.JWT_REFRESH_SECRET =
  process.env.JWT_REFRESH_SECRET ?? 'refresh-secret-for-step9-tests-at-least-32-ch';

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import {
  BookingStatus,
  PaymentStatus,
  ServiceRequestStatus,
  SkillProficiency,
  SkillVerificationStatus,
  UserRole,
  WorkerAvailability,
} from '@prisma/client';
import request from 'supertest';
import { allowedTransitions } from '../payment.state';
import { AuthModule } from '../../auth/auth.module';
import { AuthenticationGuard } from '../../auth/guards/authentication.guard';
import { OwnershipGuard } from '../../auth/guards/ownership.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { PrismaService } from '../../database/prisma.service';
import { CustomerPaymentsController } from '../customer-payments.controller';
import { NotificationsModule } from '../../notifications/notifications.module';
import { InvoiceService } from '../invoice.service';
import { PAYMENT_PROVIDER } from '../payments.constants';
import { PaymentsService } from '../payments.service';
import { MockPaymentProvider } from '../providers/mock.payment.provider';
import { WorkerPaymentsController } from '../worker-payments.controller';

describe('Payments and Invoicing Step9', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;
  let mockProvider: MockPaymentProvider;
  const suffix = Date.now().toString(36);
  const createdUserIds: string[] = [];
  const createdSkillIds: string[] = [];
  let mobileSeq = 0;
  let customerAToken = '';
  let customerBToken = '';
  let workerToken = '';
  let completedBookingId = '';
  let openBookingId = '';
  let otherBookingId = '';

  const nextMobile = (): string => {
    mobileSeq += 1;
    return `941${String(mobileSeq).padStart(4, '0')}${suffix}`.slice(0, 13);
  };

  const createUserWithRole = async (role: UserRole) => {
    const user = await prisma.user.create({
      data: { mobile: nextMobile(), passwordHash: 'x-hash', role, isActive: true },
    });
    createdUserIds.push(user.id);
    return user;
  };

  const mintToken = (userId: string, role: UserRole): string =>
    jwtService.sign({ sub: userId, role, type: 'access' });

  beforeAll(async () => {
    mockProvider = new MockPaymentProvider('step9-mock-secret');
    const moduleRef = await Test.createTestingModule({
      imports: [
        AuthModule,
        JwtModule.register({ secret: process.env.JWT_ACCESS_SECRET }),
        NotificationsModule,
      ],
      controllers: [CustomerPaymentsController, WorkerPaymentsController],
      providers: [
        PaymentsService,
        InvoiceService,
        { provide: PAYMENT_PROVIDER, useValue: mockProvider },
      ],
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
  }, 60000);
  const seedData = async () => {
    const customerA = await createUserWithRole(UserRole.CUSTOMER);
    const customerB = await createUserWithRole(UserRole.CUSTOMER);
    const workerUser = await createUserWithRole(UserRole.WORKER);
    customerAToken = mintToken(customerA.id, UserRole.CUSTOMER);
    customerBToken = mintToken(customerB.id, UserRole.CUSTOMER);
    workerToken = mintToken(workerUser.id, UserRole.WORKER);
    const customerARecord = await prisma.customer.create({ data: { userId: customerA.id } });
    const customerBRecord = await prisma.customer.create({ data: { userId: customerB.id } });
    const worker = await prisma.worker.create({
      data: {
        userId: workerUser.id,
        fullName: 'Step9 Worker',
        availability: WorkerAvailability.AVAILABLE,
      },
    });
    const skill = await prisma.skill.create({
      data: { name: `Step9 plumbing ${suffix}`, description: 'plumbing fixture' },
    });
    createdSkillIds.push(skill.id);
    await prisma.workerSkill.create({
      data: {
        workerId: worker.id,
        skillId: skill.id,
        proficiency: SkillProficiency.INTERMEDIATE,
        verificationStatus: SkillVerificationStatus.VERIFIED,
      },
    });
    const makeBooking = async (customerId: string, status: BookingStatus, price: number) => {
      const sr = await prisma.serviceRequest.create({
        data: {
          customerId,
          skillId: skill.id,
          title: 'Fix tap step9',
          description: 'Need a plumber to fix a leaking tap urgently step9 detail.',
          status: ServiceRequestStatus.OPEN,
        },
      });
      return prisma.booking.create({
        data: {
          serviceRequestId: sr.id,
          customerId,
          workerId: worker.id,
          status,
          priceAmount: price,
        },
      });
    };
    completedBookingId = (await makeBooking(customerARecord.id, BookingStatus.COMPLETED, 50000)).id;
    openBookingId = (await makeBooking(customerARecord.id, BookingStatus.ACCEPTED, 75000)).id;
    otherBookingId = (await makeBooking(customerBRecord.id, BookingStatus.COMPLETED, 90000)).id;
  };
  it('creates a payment with a server-calculated amount', async () => {
    await seedData();
    const res = await request(app.getHttpServer())
      .post(`/api/v1/customers/me/bookings/${completedBookingId}/payments`)
      .set('Authorization', `Bearer ${customerAToken}`)
      .send({ idempotencyKey: `pay-a-${suffix}` })
      .expect(201);
    expect(res.body.amount).toBe(50000);
    expect(Number.isInteger(res.body.amount)).toBe(true);
    expect(res.body.providerOrderId).toBeDefined();
    expect(res.body.status).toBe('PROCESSING');
    expect(res.body.providerPaymentId).toBeUndefined();
    expect(JSON.stringify(res.body)).not.toMatch(/secret|passwordHash|refreshToken/i);
  });

  it('rejects a client-supplied amount field', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/customers/me/bookings/${completedBookingId}/payments`)
      .set('Authorization', `Bearer ${customerAToken}`)
      .send({ idempotencyKey: `pay-bad-${suffix}`, amount: 1 })
      .expect(400);
  });

  it('requires a completed booking and own booking', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/customers/me/bookings/${openBookingId}/payments`)
      .set('Authorization', `Bearer ${customerAToken}`)
      .send({ idempotencyKey: `pay-open-${suffix}` })
      .expect(400);
    await request(app.getHttpServer())
      .post(`/api/v1/customers/me/bookings/${otherBookingId}/payments`)
      .set('Authorization', `Bearer ${customerAToken}`)
      .send({ idempotencyKey: `pay-other-${suffix}` })
      .expect(404);
  });

  it('handles duplicate idempotency safely and rejects conflicting reuse', async () => {
    const key = `pay-idem-${suffix}`;
    const first = await request(app.getHttpServer())
      .post(`/api/v1/customers/me/bookings/${completedBookingId}/payments`)
      .set('Authorization', `Bearer ${customerAToken}`)
      .send({ idempotencyKey: key })
      .expect(201);
    const second = await request(app.getHttpServer())
      .post(`/api/v1/customers/me/bookings/${completedBookingId}/payments`)
      .set('Authorization', `Bearer ${customerAToken}`)
      .send({ idempotencyKey: key })
      .expect(201);
    expect(second.body.id).toBe(first.body.id);
    await request(app.getHttpServer())
      .post(`/api/v1/customers/me/bookings/${openBookingId}/payments`)
      .set('Authorization', `Bearer ${customerAToken}`)
      .send({ idempotencyKey: key })
      .expect(409);
  });

  it('verifies a payment only with a valid signature', async () => {
    const created = await request(app.getHttpServer())
      .post(`/api/v1/customers/me/bookings/${completedBookingId}/payments`)
      .set('Authorization', `Bearer ${customerAToken}`)
      .send({ idempotencyKey: `pay-verify-${suffix}` })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/v1/customers/me/payments/${created.body.id}/verify`)
      .set('Authorization', `Bearer ${customerAToken}`)
      .send({
        providerOrderId: created.body.providerOrderId,
        providerPaymentId: 'pay_123',
        providerSignature: '00'.repeat(32),
      })
      .expect(400);
    const valid = mockProvider.validSignatureFor({
      providerOrderId: created.body.providerOrderId,
      providerPaymentId: 'pay_123',
    });
    const verified = await request(app.getHttpServer())
      .post(`/api/v1/customers/me/payments/${created.body.id}/verify`)
      .set('Authorization', `Bearer ${customerAToken}`)
      .send({
        providerOrderId: created.body.providerOrderId,
        providerPaymentId: 'pay_123',
        providerSignature: valid,
      })
      .expect(201);
    expect(verified.body.status).toBe('SUCCESS');
    await request(app.getHttpServer())
      .get(`/api/v1/customers/me/payments/${created.body.id}`)
      .set('Authorization', `Bearer ${customerBToken}`)
      .expect(404);
    await request(app.getHttpServer())
      .get(`/api/v1/customers/me/payments/${created.body.id}`)
      .set('Authorization', `Bearer ${workerToken}`)
      .expect(403);
  });
  it('creates unique server-generated invoices with immutable snapshots', async () => {
    const first = await request(app.getHttpServer())
      .post(`/api/v1/customers/me/bookings/${completedBookingId}/payments`)
      .set('Authorization', `Bearer ${customerAToken}`)
      .send({ idempotencyKey: `pay-inv-a-${suffix}` })
      .expect(201);
    const second = await request(app.getHttpServer())
      .post(`/api/v1/customers/me/bookings/${completedBookingId}/payments`)
      .set('Authorization', `Bearer ${customerAToken}`)
      .send({ idempotencyKey: `pay-inv-b-${suffix}` })
      .expect(201);
    const validA = mockProvider.validSignatureFor({
      providerOrderId: first.body.providerOrderId,
      providerPaymentId: 'pay_invoice_a',
    });
    const validB = mockProvider.validSignatureFor({
      providerOrderId: second.body.providerOrderId,
      providerPaymentId: 'pay_invoice_b',
    });
    await request(app.getHttpServer())
      .post(`/api/v1/customers/me/payments/${first.body.id}/verify`)
      .set('Authorization', `Bearer ${customerAToken}`)
      .send({
        providerOrderId: first.body.providerOrderId,
        providerPaymentId: 'pay_invoice_a',
        providerSignature: validA,
      })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/v1/customers/me/payments/${second.body.id}/verify`)
      .set('Authorization', `Bearer ${customerAToken}`)
      .send({
        providerOrderId: second.body.providerOrderId,
        providerPaymentId: 'pay_invoice_b',
        providerSignature: validB,
      })
      .expect(201);
    const invoices = await request(app.getHttpServer())
      .get('/api/v1/customers/me/invoices')
      .set('Authorization', `Bearer ${customerAToken}`)
      .expect(200);
    expect(invoices.body.length).toBeGreaterThanOrEqual(2);
    const numbers = invoices.body.map((i: { invoiceNumber: string }) => i.invoiceNumber);
    expect(new Set(numbers).size).toBe(numbers.length);
    for (const invoice of invoices.body) {
      expect(invoice.invoiceNumber).toMatch(/^INV-\d{4}-\d{6}$/);
      expect(Number.isInteger(invoice.subtotal)).toBe(true);
      expect(Number.isInteger(invoice.totalAmount)).toBe(true);
    }
    const target = invoices.body.find(
      (i: { bookingId: string }) => i.bookingId === completedBookingId,
    );
    const before = target.totalAmount;
    await prisma.booking.update({
      where: { id: completedBookingId },
      data: { priceAmount: 99999 },
    });
    const reread = await request(app.getHttpServer())
      .get(`/api/v1/customers/me/invoices/${target.id}`)
      .set('Authorization', `Bearer ${customerAToken}`)
      .expect(200);
    expect(reread.body.totalAmount).toBe(before);
    await prisma.booking.update({
      where: { id: completedBookingId },
      data: { priceAmount: 50000 },
    });
    await request(app.getHttpServer())
      .get(`/api/v1/customers/me/invoices/${target.id}`)
      .set('Authorization', `Bearer ${customerBToken}`)
      .expect(404);
  });

  it('gives workers limited payment visibility', async () => {
    const mine = await request(app.getHttpServer())
      .get('/api/v1/workers/me/payments')
      .set('Authorization', `Bearer ${workerToken}`)
      .expect(200);
    expect(Array.isArray(mine.body)).toBe(true);
    expect(mine.body.length).toBeGreaterThanOrEqual(1);
    expect(JSON.stringify(mine.body[0])).not.toMatch(/providerPaymentId|providerSignature|secret/i);
    await request(app.getHttpServer())
      .get('/api/v1/customers/me/payments')
      .set('Authorization', `Bearer ${workerToken}`)
      .expect(403);
    await request(app.getHttpServer())
      .post(`/api/v1/customers/me/bookings/${completedBookingId}/payments`)
      .set('Authorization', `Bearer ${workerToken}`)
      .send({ idempotencyKey: `pay-worker-${suffix}` })
      .expect(403);
  });

  it('exposes the payment transition map and provider crypto behavior', async () => {
    expect(allowedTransitions(PaymentStatus.PENDING)).toEqual(
      expect.arrayContaining([PaymentStatus.PROCESSING]),
    );
    expect(allowedTransitions(PaymentStatus.SUCCESS)).toEqual([PaymentStatus.REFUNDED]);
    expect(allowedTransitions(PaymentStatus.FAILED)).toEqual([]);
    const good = mockProvider.validSignatureFor({
      providerOrderId: 'order_state_map',
      providerPaymentId: 'pay_state_map',
    });
    expect(
      mockProvider.verifySignature({
        providerOrderId: 'order_state_map',
        providerPaymentId: 'pay_state_map',
        providerSignature: good,
      }),
    ).toBe(true);
    expect(
      mockProvider.verifySignature({
        providerOrderId: 'order_state_map',
        providerPaymentId: 'pay_state_map',
        providerSignature: '00'.repeat(32),
      }),
    ).toBe(false);
  });

  afterAll(async () => {
    if (prisma && createdUserIds.length > 0) {
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    }
    if (prisma && createdSkillIds.length > 0) {
      await prisma.skill.deleteMany({ where: { id: { in: createdSkillIds } } });
    }
    if (app) {
      await app.close();
    }
  });
});
