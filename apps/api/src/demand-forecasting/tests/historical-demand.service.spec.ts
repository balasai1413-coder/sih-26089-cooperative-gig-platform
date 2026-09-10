import { BookingStatus, ServiceRequestStatus } from '@prisma/client';
import { HistoricalDemandService } from '../historical-demand.service';

describe('HistoricalDemandService', () => {
  it('uses unique, non-cancelled requests with qualifying cooperative bookings', async () => {
    const findMany = jest.fn(async () => [
      {
        id: 'request-1',
        createdAt: new Date('2026-08-01T00:00:00.000Z'),
        location: 'Sector 17',
        skill: { id: 'skill-1', name: 'Electrical', category: { id: 'category-1', name: 'Home' } },
      },
    ]);
    const service = new HistoricalDemandService({
      serviceRequest: { findMany },
    } as never);

    const records = await service.getDemandRecords({
      cooperativeId: '11111111-1111-4111-8111-111111111111',
      startDate: new Date('2026-08-01T00:00:00.000Z'),
      endDate: new Date('2026-09-01T00:00:00.000Z'),
      skillId: '22222222-2222-4222-8222-222222222222',
      categoryId: '33333333-3333-4333-8333-333333333333',
      location: 'Sector 17',
    });

    expect(records).toEqual([
      expect.objectContaining({ serviceRequestId: 'request-1', location: 'Sector 17' }),
    ]);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: { not: ServiceRequestStatus.CANCELLED },
          skillId: '22222222-2222-4222-8222-222222222222',
          skill: { categoryId: '33333333-3333-4333-8333-333333333333' },
          location: { equals: 'Sector 17', mode: 'insensitive' },
          bookings: {
            some: expect.objectContaining({
              cooperativeId: '11111111-1111-4111-8111-111111111111',
              status: {
                in: [BookingStatus.ACCEPTED, BookingStatus.IN_PROGRESS, BookingStatus.COMPLETED],
              },
            }),
          },
        }),
      }),
    );
  });
});
