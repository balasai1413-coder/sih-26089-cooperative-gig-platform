import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  BookingStatus,
  CooperativeStatus,
  NotificationType,
  Prisma,
  ServiceRequestStatus,
  SkillVerificationStatus,
  UserRole,
  WorkerAvailability,
} from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AuthenticatedUser } from '../auth/auth.types';
import { CreateBookingDto } from './dto/create-booking.dto';
import {
  CustomerCancelBookingDto,
  WorkerCompleteBookingDto,
  WorkerRejectBookingDto,
} from './dto/booking-action.dto';

const bookingInclude = {
  serviceRequest: {
    select: {
      id: true,
      title: true,
      description: true,
      location: true,
      status: true,
      preferredDateTime: true,
      skill: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  },
  worker: {
    select: {
      id: true,
      fullName: true,
      profilePhotoUrl: true,
      location: true,
      yearsExperience: true,
      user: {
        select: {
          id: true,
          mobile: true,
        },
      },
    },
  },
  cooperative: {
    select: {
      id: true,
      name: true,
    },
  },
  customer: {
    select: {
      id: true,
      userId: true,
    },
  },
  review: {
    select: {
      id: true,
      rating: true,
      comment: true,
    },
  },
} satisfies Prisma.BookingInclude;

type BookingWithRelations = Prisma.BookingGetPayload<{ include: typeof bookingInclude }>;

@Injectable()
export class BookingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  /**
   * Create a notification for a booking event.
   * This is server-side only and catches errors gracefully.
   */
  private async createBookingNotification(
    recipientUserId: string,
    type: NotificationType,
    title: string,
    message: string,
    eventKey: string,
    metadata?: Prisma.InputJsonValue | null,
  ): Promise<void> {
    try {
      await this.notificationsService.createNotification({
        recipientUserId,
        type,
        title,
        message,
        eventKey,
        metadata,
      });
    } catch (error) {
      // Log but don't fail the booking operation if notification creation fails
      console.error(`Failed to create notification (${eventKey}):`, error);
    }
  }

  /**
   * Resolves customer id from authenticated user token.
   * Prevents client-supplied customerId forgery.
   */
  private async resolveCustomerId(user: AuthenticatedUser): Promise<string> {
    const customer = await this.prisma.customer.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });
    if (!customer) {
      throw new NotFoundException('Customer profile is not available');
    }
    return customer.id;
  }

  /**
   * Resolves worker id from authenticated user token.
   * Prevents client-supplied workerId forgery.
   */
  private async resolveWorkerId(user: AuthenticatedUser): Promise<string> {
    const worker = await this.prisma.worker.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });
    if (!worker) {
      throw new NotFoundException('Worker profile is not available');
    }
    return worker.id;
  }

  /**
   * Transforms persisted booking record into safe DTO response.
   * Strictly suppresses passwordHash, refreshTokenHash, private verification notes,
   * admin identifiers, and sensitive authentication internals.
   */
  private toSafeDto(booking: BookingWithRelations) {
    const coop = booking.cooperative;
    return {
      id: booking.id,
      status: booking.status,
      // Step 9 — server-determined payable amount in minor units (read-only).
      priceAmount: booking.priceAmount,
      scheduledAt: booking.scheduledAt,
      startedAt: booking.startedAt,
      completedAt: booking.completedAt,
      cancelledAt: booking.cancelledAt,
      customerNotes: booking.customerNotes,
      workerNotes: booking.workerNotes,
      createdAt: booking.createdAt,
      updatedAt: booking.updatedAt,
      serviceRequest: {
        id: booking.serviceRequest.id,
        title: booking.serviceRequest.title,
        description: booking.serviceRequest.description,
        location: booking.serviceRequest.location,
        status: booking.serviceRequest.status,
        preferredDateTime: booking.serviceRequest.preferredDateTime,
        skill: booking.serviceRequest.skill
          ? {
              id: booking.serviceRequest.skill.id,
              name: booking.serviceRequest.skill.name,
            }
          : null,
      },
      worker: {
        id: booking.worker.id,
        fullName: booking.worker.fullName,
        profilePhotoUrl: booking.worker.profilePhotoUrl,
        location: booking.worker.location,
        yearsExperience: booking.worker.yearsExperience,
        cooperative: coop ? { id: coop.id, name: coop.name } : null,
      },
      customer: {
        id: booking.customer.id,
      },
      review: booking.review
        ? {
            id: booking.review.id,
            rating: booking.review.rating,
            comment: booking.review.comment,
          }
        : null,
    };
  }

  /**
   * Customer creates a booking from an eligible worker match.
   * Independently validates worker eligibility on the server side:
   *  - Worker must exist, be active, with role WORKER
   *  - Worker availability cannot be UNAVAILABLE
   *  - Worker must hold an open membership in an ACTIVE cooperative
   *  - The responsible cooperative is snapshotted on the booking at creation
   *  - Worker must have a VERIFIED WorkerSkill for the request's skill
   *  - Request must be OPEN and belong to the authenticated customer
   *  - Concurrency & duplicate active booking protection enforced via transaction + unique constraint
   */
  async createBooking(user: AuthenticatedUser, requestId: string, dto: CreateBookingDto) {
    const customerId = await this.resolveCustomerId(user);

    // 1. Fetch service request owned by customer
    const request = await this.prisma.serviceRequest.findUnique({
      where: { id: requestId },
      include: {
        skill: { select: { id: true, name: true, active: true } },
      },
    });

    if (!request || request.customerId !== customerId) {
      throw new NotFoundException('Service request is not available');
    }

    if (request.status !== ServiceRequestStatus.OPEN) {
      throw new BadRequestException('Bookings can only be created for OPEN service requests');
    }

    if (!request.skillId || !request.skill || !request.skill.active) {
      throw new BadRequestException('The requested service skill is not currently available');
    }

    // 2. Validate worker eligibility server-side independently
    const worker = await this.prisma.worker.findUnique({
      where: { id: dto.workerId },
      select: {
        id: true,
        availability: true,
        user: {
          select: {
            id: true,
            role: true,
            isActive: true,
          },
        },
        memberships: {
          where: {
            leftAt: null,
            cooperative: { status: CooperativeStatus.ACTIVE },
          },
          select: {
            id: true,
            cooperative: { select: { id: true, name: true, status: true } },
          },
        },
        skills: {
          where: {
            skillId: request.skillId,
            verificationStatus: SkillVerificationStatus.VERIFIED,
          },
          select: {
            id: true,
            verificationStatus: true,
          },
        },
      },
    });

    if (!worker || !worker.user.isActive || worker.user.role !== UserRole.WORKER) {
      throw new BadRequestException('Worker is not eligible for assignment');
    }

    if (worker.availability === WorkerAvailability.UNAVAILABLE) {
      throw new BadRequestException('Worker is currently unavailable');
    }

    if (worker.memberships.length === 0) {
      throw new BadRequestException('Worker does not belong to an active cooperative');
    }

    if (worker.skills.length === 0) {
      throw new BadRequestException('Worker is not verified for the required skill');
    }

    // A worker may belong to more than one cooperative. The match UI supplies
    // its displayed cooperative id; other clients can omit it only when there
    // is exactly one active membership. This prevents an arbitrary membership
    // from becoming a permanent historical ownership snapshot.
    const membership = dto.cooperativeId
      ? worker.memberships.find((item) => item.cooperative.id === dto.cooperativeId)
      : worker.memberships.length === 1
        ? worker.memberships[0]
        : undefined;
    if (!membership) {
      throw new BadRequestException(
        dto.cooperativeId
          ? 'Worker is not an active member of the selected cooperative'
          : 'Select the cooperative responsible for this booking',
      );
    }

    // 3. Atomically check and create booking to prevent duplicate assignments & race conditions
    try {
      const created = await this.prisma.$transaction(async (tx) => {
        // Active bookings are PENDING_WORKER_ACCEPTANCE, ACCEPTED, or IN_PROGRESS
        const existingActive = await tx.booking.findFirst({
          where: {
            serviceRequestId: request.id,
            status: {
              in: [
                BookingStatus.PENDING_WORKER_ACCEPTANCE,
                BookingStatus.ACCEPTED,
                BookingStatus.IN_PROGRESS,
              ],
            },
          },
          select: { id: true },
        });

        if (existingActive) {
          throw new ConflictException('An active booking already exists for this service request');
        }

        return tx.booking.create({
          data: {
            serviceRequestId: request.id,
            customerId,
            workerId: worker.id,
            cooperativeId: membership.cooperative.id,
            status: BookingStatus.PENDING_WORKER_ACCEPTANCE,
            scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : null,
            customerNotes: dto.customerNotes ?? null,
          },
          include: bookingInclude,
        });
      });

      // Notify worker that a booking was created
      await this.createBookingNotification(
        worker.user.id,
        NotificationType.BOOKING_CREATED,
        'New Booking',
        `A new booking has been created for ${request.title}. Please review and accept or reject.`,
        `booking:${created.id}:created`,
        { bookingId: created.id, serviceRequestId: request.id },
      );

      return this.toSafeDto(created);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002' // Unique constraint violation on unique_active_booking_per_request
      ) {
        throw new ConflictException('An active booking already exists for this service request');
      }
      throw error;
    }
  }

  /**
   * Retrieve bookings for authenticated customer.
   */
  async listCustomerBookings(user: AuthenticatedUser) {
    const customerId = await this.resolveCustomerId(user);
    const bookings = await this.prisma.booking.findMany({
      where: { customerId },
      orderBy: { createdAt: 'desc' },
      include: bookingInclude,
    });
    return bookings.map((b) => this.toSafeDto(b));
  }

  /**
   * Retrieve single booking for authenticated customer.
   * Returns 404 for non-existent or other customers' bookings.
   */
  async getCustomerBooking(user: AuthenticatedUser, bookingId: string) {
    const customerId = await this.resolveCustomerId(user);
    const booking = await this.prisma.booking.findFirst({
      where: { id: bookingId, customerId },
      include: bookingInclude,
    });
    if (!booking) {
      throw new NotFoundException('Booking is not available');
    }
    return this.toSafeDto(booking);
  }

  /**
   * Customer cancels an active booking (PENDING_WORKER_ACCEPTANCE or ACCEPTED).
   * Terminal states (COMPLETED, REJECTED, CANCELLED) and IN_PROGRESS cannot be cancelled by customer.
   */
  async cancelBooking(user: AuthenticatedUser, bookingId: string, dto?: CustomerCancelBookingDto) {
    const customerId = await this.resolveCustomerId(user);
    const booking = await this.prisma.booking.findFirst({
      where: { id: bookingId, customerId },
      include: bookingInclude,
    });

    if (!booking) {
      throw new NotFoundException('Booking is not available');
    }

    if (
      booking.status !== BookingStatus.PENDING_WORKER_ACCEPTANCE &&
      booking.status !== BookingStatus.ACCEPTED
    ) {
      throw new BadRequestException(`Cannot cancel booking in ${booking.status} status`);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      // If booking was ACCEPTED, serviceRequest was IN_PROGRESS; revert back to OPEN so customer can re-book
      if (booking.status === BookingStatus.ACCEPTED) {
        await tx.serviceRequest.update({
          where: { id: booking.serviceRequestId },
          data: { status: ServiceRequestStatus.OPEN },
        });
      }

      return tx.booking.update({
        where: { id: booking.id },
        data: {
          status: BookingStatus.CANCELLED,
          cancelledAt: new Date(),
          customerNotes: dto?.customerNotes ?? booking.customerNotes,
        },
        include: bookingInclude,
      });
    });

    // Notify worker that booking was cancelled
    await this.createBookingNotification(
      booking.worker.user.id,
      NotificationType.BOOKING_CANCELLED,
      'Booking Cancelled',
      `The booking for ${booking.serviceRequest.title} has been cancelled by the customer.`,
      `booking:${updated.id}:cancelled`,
      { bookingId: updated.id },
    );

    return this.toSafeDto(updated);
  }

  /**
   * Retrieve assignments/bookings for authenticated worker.
   */
  async listWorkerBookings(user: AuthenticatedUser) {
    const workerId = await this.resolveWorkerId(user);
    const bookings = await this.prisma.booking.findMany({
      where: { workerId },
      orderBy: { createdAt: 'desc' },
      include: bookingInclude,
    });
    return bookings.map((b) => this.toSafeDto(b));
  }

  /**
   * Retrieve single assignment for authenticated worker.
   * Returns 404 for non-existent or other workers' bookings.
   */
  async getWorkerBooking(user: AuthenticatedUser, bookingId: string) {
    const workerId = await this.resolveWorkerId(user);
    const booking = await this.prisma.booking.findFirst({
      where: { id: bookingId, workerId },
      include: bookingInclude,
    });
    if (!booking) {
      throw new NotFoundException('Booking is not available');
    }
    return this.toSafeDto(booking);
  }

  /**
   * Worker accepts assignment: PENDING_WORKER_ACCEPTANCE -> ACCEPTED.
   * Service request transitions to IN_PROGRESS.
   */
  async acceptBooking(user: AuthenticatedUser, bookingId: string) {
    const workerId = await this.resolveWorkerId(user);
    const booking = await this.prisma.booking.findFirst({
      where: { id: bookingId, workerId },
      include: bookingInclude,
    });

    if (!booking) {
      throw new NotFoundException('Booking is not available');
    }

    if (booking.status !== BookingStatus.PENDING_WORKER_ACCEPTANCE) {
      throw new BadRequestException(`Cannot accept booking in ${booking.status} status`);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.serviceRequest.update({
        where: { id: booking.serviceRequestId },
        data: { status: ServiceRequestStatus.IN_PROGRESS },
      });

      return tx.booking.update({
        where: { id: booking.id },
        data: { status: BookingStatus.ACCEPTED },
        include: bookingInclude,
      });
    });

    // Notify customer that booking was accepted
    await this.createBookingNotification(
      booking.customer.userId,
      NotificationType.BOOKING_ACCEPTED,
      'Booking Accepted',
      `${booking.worker.fullName || 'Your worker'} has accepted your booking for ${booking.serviceRequest.title}.`,
      `booking:${updated.id}:accepted`,
      { bookingId: updated.id, workerId: booking.workerId },
    );

    return this.toSafeDto(updated);
  }

  /**
   * Worker rejects assignment: PENDING_WORKER_ACCEPTANCE -> REJECTED.
   * Service request remains OPEN so another worker can be matched/booked.
   */
  async rejectBooking(user: AuthenticatedUser, bookingId: string, dto?: WorkerRejectBookingDto) {
    const workerId = await this.resolveWorkerId(user);
    const booking = await this.prisma.booking.findFirst({
      where: { id: bookingId, workerId },
      include: bookingInclude,
    });

    if (!booking) {
      throw new NotFoundException('Booking is not available');
    }

    if (booking.status !== BookingStatus.PENDING_WORKER_ACCEPTANCE) {
      throw new BadRequestException(`Cannot reject booking in ${booking.status} status`);
    }

    const updated = await this.prisma.booking.update({
      where: { id: booking.id },
      data: {
        status: BookingStatus.REJECTED,
        workerNotes: dto?.workerNotes ?? null,
      },
      include: bookingInclude,
    });

    // Notify customer that booking was rejected
    await this.createBookingNotification(
      booking.customer.userId,
      NotificationType.BOOKING_REJECTED,
      'Booking Rejected',
      `${booking.worker.fullName || 'Your assigned worker'} has rejected your booking for ${booking.serviceRequest.title}. You can try booking another worker.`,
      `booking:${updated.id}:rejected`,
      { bookingId: updated.id, workerId: booking.workerId },
    );

    return this.toSafeDto(updated);
  }

  /**
   * Worker starts service: ACCEPTED -> IN_PROGRESS.
   * Sets startedAt timestamp.
   */
  async startBooking(user: AuthenticatedUser, bookingId: string) {
    const workerId = await this.resolveWorkerId(user);
    const booking = await this.prisma.booking.findFirst({
      where: { id: bookingId, workerId },
      include: bookingInclude,
    });

    if (!booking) {
      throw new NotFoundException('Booking is not available');
    }

    if (booking.status !== BookingStatus.ACCEPTED) {
      throw new BadRequestException(`Cannot start service in ${booking.status} status`);
    }

    const updated = await this.prisma.booking.update({
      where: { id: booking.id },
      data: {
        status: BookingStatus.IN_PROGRESS,
        startedAt: new Date(),
      },
      include: bookingInclude,
    });

    // Notify customer that service has started
    await this.createBookingNotification(
      booking.customer.userId,
      NotificationType.BOOKING_STARTED,
      'Service Started',
      `${booking.worker.fullName || 'Your worker'} has started working on your booking for ${booking.serviceRequest.title}.`,
      `booking:${updated.id}:started`,
      { bookingId: updated.id },
    );

    return this.toSafeDto(updated);
  }

  /**
   * Worker completes service: IN_PROGRESS -> COMPLETED.
   * Sets completedAt timestamp.
   * Service request transitions to CLOSED.
   */
  async completeBooking(
    user: AuthenticatedUser,
    bookingId: string,
    dto?: WorkerCompleteBookingDto,
  ) {
    const workerId = await this.resolveWorkerId(user);
    const booking = await this.prisma.booking.findFirst({
      where: { id: bookingId, workerId },
      include: bookingInclude,
    });

    if (!booking) {
      throw new NotFoundException('Booking is not available');
    }

    if (booking.status !== BookingStatus.IN_PROGRESS) {
      throw new BadRequestException(`Cannot complete service in ${booking.status} status`);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.serviceRequest.update({
        where: { id: booking.serviceRequestId },
        data: { status: ServiceRequestStatus.CLOSED },
      });

      return tx.booking.update({
        where: { id: booking.id },
        data: {
          status: BookingStatus.COMPLETED,
          completedAt: new Date(),
          workerNotes: dto?.workerNotes ?? booking.workerNotes,
        },
        include: bookingInclude,
      });
    });

    // Notify customer that service is completed
    await this.createBookingNotification(
      booking.customer.userId,
      NotificationType.BOOKING_COMPLETED,
      'Booking Completed',
      `${booking.worker.fullName || 'Your worker'} has completed your booking for ${booking.serviceRequest.title}. Please leave a review.`,
      `booking:${updated.id}:completed`,
      { bookingId: updated.id },
    );

    return this.toSafeDto(updated);
  }
}
