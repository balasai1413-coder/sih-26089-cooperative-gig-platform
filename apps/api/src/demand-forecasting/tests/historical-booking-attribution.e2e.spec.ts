process.env.DATABASE_URL =
  process.env.DATABASE_URL ??
  'postgresql://platform_user:MyLocalPassword123@localhost:5432/cooperative_gig_platform?schema=public';

import {
  BookingStatus,
  ServiceRequestStatus,
  UserRole,
  WorkerAvailability,
} from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { BaselineForecastingStrategy } from '../baseline-forecasting.strategy';
import { HistoricalDemandService } from '../historical-demand.service';

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfUtcDay(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

describe('Historical cooperative booking attribution (real database)', () => {
  const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const createdUserIds: string[] = [];
  const createdCooperativeIds: string[] = [];
  const createdServiceRequestIds: string[] = [];
  const createdBookingIds: string[] = [];
  let prisma: PrismaService;
  let historicalDemand: HistoricalDemandService;
  let cooperativeAId: string;
  let cooperativeBId: string;
  let workerId: string;
  let customerId: string;
  let skillId: string;
  let acceptedRequestId: string;
  let inProgressRequestId: string;
  let completedRequestId: string;
  let rejectedRequestId: string;
  let cancelledRequestId: string;

  const today = startOfUtcDay(new Date());
  const dayAgo = (days: number) => new Date(today.getTime() - days * DAY_MS);

  async function createUser(role: UserRole) {
    const user = await prisma.user.create({
      data: {
        mobile: `96${createdUserIds.length}${suffix}`.slice(0, 15),
        passwordHash: 'test-hash-not-a-real-password',
        role,
      },
    });
    createdUserIds.push(user.id);
    return user;
  }

  async function createRequestAndBooking(
    daysAgo: number,
    bookingStatus: BookingStatus,
    requestStatus: ServiceRequestStatus,
  ) {
    const occurredAt = dayAgo(daysAgo);
    const serviceRequest = await prisma.serviceRequest.create({
      data: {
        customerId,
        skillId,
        title: `Forecast history ${bookingStatus} ${daysAgo} ${suffix}`,
        status: requestStatus,
        location: 'Sector 17',
        createdAt: occurredAt,
      },
    });
    createdServiceRequestIds.push(serviceRequest.id);
    const booking = await prisma.booking.create({
      data: {
        serviceRequestId: serviceRequest.id,
        customerId,
        workerId,
        cooperativeId: cooperativeAId,
        status: bookingStatus,
        createdAt: occurredAt,
      },
    });
    createdBookingIds.push(booking.id);
    return serviceRequest.id;
  }

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    historicalDemand = new HistoricalDemandService(prisma);

    const adminA = await createUser(UserRole.COOPERATIVE_ADMIN);
    const adminB = await createUser(UserRole.COOPERATIVE_ADMIN);
    const customerUser = await createUser(UserRole.CUSTOMER);
    const workerUser = await createUser(UserRole.WORKER);
    const customer = await prisma.customer.create({ data: { userId: customerUser.id } });
    const worker = await prisma.worker.create({
      data: {
        userId: workerUser.id,
        fullName: `Forecast worker ${suffix}`,
        availability: WorkerAvailability.AVAILABLE,
      },
    });
    customerId = customer.id;
    workerId = worker.id;

    const cooperativeA = await prisma.cooperative.create({
      data: { name: `Forecast Cooperative A ${suffix}`, adminUserId: adminA.id },
    });
    const cooperativeB = await prisma.cooperative.create({
      data: { name: `Forecast Cooperative B ${suffix}`, adminUserId: adminB.id },
    });
    cooperativeAId = cooperativeA.id;
    cooperativeBId = cooperativeB.id;
    createdCooperativeIds.push(cooperativeA.id, cooperativeB.id);

    const skill = await prisma.skill.create({ data: { name: `Forecast skill ${suffix}` } });
    skillId = skill.id;

    await prisma.cooperativeMembership.create({
      data: { cooperativeId: cooperativeAId, workerId, joinedAt: dayAgo(50) },
    });

    acceptedRequestId = await createRequestAndBooking(
      21,
      BookingStatus.ACCEPTED,
      ServiceRequestStatus.IN_PROGRESS,
    );
    inProgressRequestId = await createRequestAndBooking(
      20,
      BookingStatus.IN_PROGRESS,
      ServiceRequestStatus.IN_PROGRESS,
    );
    completedRequestId = await createRequestAndBooking(
      19,
      BookingStatus.COMPLETED,
      ServiceRequestStatus.CLOSED,
    );
    rejectedRequestId = await createRequestAndBooking(
      18,
      BookingStatus.REJECTED,
      ServiceRequestStatus.OPEN,
    );
    cancelledRequestId = await createRequestAndBooking(
      17,
      BookingStatus.CANCELLED,
      ServiceRequestStatus.OPEN,
    );

    // Enough real, spread-out qualifying history to produce a READY response.
    for (let daysAgo = 40; daysAgo >= 27; daysAgo -= 1) {
      await createRequestAndBooking(daysAgo, BookingStatus.COMPLETED, ServiceRequestStatus.CLOSED);
    }

    await prisma.cooperativeMembership.update({
      where: { cooperativeId_workerId: { cooperativeId: cooperativeAId, workerId } },
      data: { leftAt: dayAgo(1) },
    });
    await prisma.cooperativeMembership.create({
      data: { cooperativeId: cooperativeBId, workerId, joinedAt: dayAgo(1) },
    });
  });

  afterAll(async () => {
    await prisma.booking.deleteMany({ where: { id: { in: createdBookingIds } } });
    await prisma.serviceRequest.deleteMany({ where: { id: { in: createdServiceRequestIds } } });
    await prisma.cooperativeMembership.deleteMany({ where: { workerId } });
    await prisma.cooperative.deleteMany({ where: { id: { in: createdCooperativeIds } } });
    await prisma.customer.deleteMany({ where: { id: customerId } });
    await prisma.worker.deleteMany({ where: { id: workerId } });
    await prisma.skill.deleteMany({ where: { id: skillId } });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    await prisma.$disconnect();
  });

  const historyFor = (cooperativeId: string) =>
    historicalDemand.getDemandRecords({
      cooperativeId,
      startDate: dayAgo(56),
      endDate: today,
    });

  it('keeps accepted, in-progress, and completed demand with Cooperative A after membership changes', async () => {
    const records = await historyFor(cooperativeAId);
    const ids = records.map((record) => record.serviceRequestId);

    expect(ids).toEqual(
      expect.arrayContaining([acceptedRequestId, inProgressRequestId, completedRequestId]),
    );
    expect(ids).not.toContain(rejectedRequestId);
    expect(ids).not.toContain(cancelledRequestId);
  });

  it('does not attribute Cooperative A booking history to Cooperative B after the worker joins B', async () => {
    const recordsForA = await historyFor(cooperativeAId);
    const recordsForB = await historyFor(cooperativeBId);

    expect(recordsForA.map((record) => record.serviceRequestId)).toContain(completedRequestId);
    expect(recordsForB).toEqual([]);
  });

  it('uses real snapshotted history to produce a READY deterministic baseline forecast', async () => {
    const records = await historyFor(cooperativeAId);
    const strategy = new BaselineForecastingStrategy();
    const forecastStart = new Date(today.getTime() + DAY_MS);
    const forecastEnd = new Date(forecastStart.getTime() + 6 * DAY_MS);
    const input = {
      records,
      historicalEnd: today,
      forecastStart,
      forecastEnd,
      dimensions: { skill: null, category: null, location: null },
    };

    const first = strategy.forecast(input);
    const second = strategy.forecast(input);

    expect(first.status).toBe('READY');
    expect(first.predictedDemand).not.toBeNull();
    expect(first).toEqual(second);
  });
});
