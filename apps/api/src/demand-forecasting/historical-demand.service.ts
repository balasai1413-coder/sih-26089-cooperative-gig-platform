import { Injectable } from '@nestjs/common';
import { BookingStatus, Prisma, ServiceRequestStatus } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { HistoricalDemandFilter, HistoricalDemandRecord } from './demand-forecasting.types';

const QUALIFYING_BOOKING_STATUSES = [
  BookingStatus.ACCEPTED,
  BookingStatus.IN_PROGRESS,
  BookingStatus.COMPLETED,
] as const;

/**
 * Retrieves the platform's currently attributable demand history.
 *
 * A service request has no cooperativeId in the current schema. A request is
 * attributed by the immutable cooperative snapshot captured on its booking at
 * assignment time. Rejected and cancelled bookings are deliberately excluded,
 * and `some` keeps a request from being counted twice.
 */
@Injectable()
export class HistoricalDemandService {
  constructor(private readonly prisma: PrismaService) {}

  async getDemandRecords(filter: HistoricalDemandFilter): Promise<HistoricalDemandRecord[]> {
    const where: Prisma.ServiceRequestWhereInput = {
      status: { not: ServiceRequestStatus.CANCELLED },
      createdAt: { gte: filter.startDate, lt: filter.endDate },
      bookings: {
        some: {
          cooperativeId: filter.cooperativeId,
          status: { in: [...QUALIFYING_BOOKING_STATUSES] },
        },
      },
      ...(filter.skillId ? { skillId: filter.skillId } : {}),
      ...(filter.categoryId ? { skill: { categoryId: filter.categoryId } } : {}),
      ...(filter.location
        ? { location: { equals: filter.location, mode: Prisma.QueryMode.insensitive } }
        : {}),
    };

    const requests = await this.prisma.serviceRequest.findMany({
      where,
      select: {
        id: true,
        createdAt: true,
        location: true,
        skill: {
          select: {
            id: true,
            name: true,
            category: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return requests.map((request) => ({
      serviceRequestId: request.id,
      occurredAt: request.createdAt,
      location: request.location,
      skill: request.skill,
    }));
  }
}
