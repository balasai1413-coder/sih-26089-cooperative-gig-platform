import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BookingStatus, NotificationType, Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AuthenticatedUser } from '../auth/auth.types';
import { CreateReviewDto } from './dto/create-review.dto';

export interface ReviewResponse {
  id: string;
  bookingId: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  updatedAt: string;
  customer: { id: string };
  worker: { id: string; fullName: string | null };
}

export interface ReputationResponse {
  averageRating: number | null;
  totalReviews: number;
  ratingDistribution: {
    '1': number;
    '2': number;
    '3': number;
    '4': number;
    '5': number;
  };
}

const reviewInclude = {
  customer: {
    select: {
      id: true,
      user: {
        select: {
          mobile: true,
          email: true,
          passwordHash: false,
          refreshTokenHash: false,
        },
      },
    },
  },
  worker: {
    select: {
      id: true,
      fullName: true,
    },
  },
} satisfies Prisma.ReviewInclude;

type ReviewWithRelations = Prisma.ReviewGetPayload<{ include: typeof reviewInclude }>;

@Injectable()
export class ReviewsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  /**
   * Create a notification for a review event.
   * This is server-side only and catches errors gracefully.
   */
  private async createReviewNotification(
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
      // Log but don't fail the review operation if notification creation fails
      console.error(`Failed to create notification (${eventKey}):`, error);
    }
  }

  private toSafeDto(review: ReviewWithRelations): ReviewResponse {
    return {
      id: review.id,
      bookingId: review.bookingId,
      rating: review.rating,
      comment: review.comment,
      createdAt: review.createdAt.toISOString(),
      updatedAt: review.updatedAt.toISOString(),
      customer: { id: review.customer.id },
      worker: { id: review.worker.id, fullName: review.worker.fullName },
    };
  }

  async createReview(
    customerUser: AuthenticatedUser,
    bookingId: string,
    dto: CreateReviewDto,
  ): Promise<ReviewResponse> {
    const customer = await this.prisma.customer.findUnique({
      where: { userId: customerUser.id },
      select: { id: true },
    });
    if (!customer) {
      throw new NotFoundException('Customer profile is not available');
    }
    const customerId = customer.id;

    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      select: {
        id: true,
        customerId: true,
        workerId: true,
        status: true,
      },
    });

    if (!booking) {
      throw new NotFoundException('Booking is not available');
    }

    if (booking.customerId !== customerId) {
      throw new NotFoundException('Booking is not available');
    }

    if (booking.status !== BookingStatus.COMPLETED) {
      throw new BadRequestException('Reviews can only be created for COMPLETED bookings');
    }

    if (!booking.workerId) {
      throw new BadRequestException('Booking does not have an assigned worker');
    }

    const existingReview = await this.prisma.review.findUnique({
      where: { bookingId: booking.id },
      select: { id: true },
    });

    if (existingReview) {
      throw new ConflictException('A review already exists for this booking');
    }

    const review = await this.prisma.review.create({
      data: {
        bookingId: booking.id,
        customerId,
        workerId: booking.workerId,
        rating: dto.rating,
        comment: dto.comment ?? null,
      },
      include: reviewInclude,
    });

    // Fetch worker user ID and send notification
    const worker = await this.prisma.worker.findUnique({
      where: { id: booking.workerId },
      select: { user: { select: { id: true } } },
    });
    if (worker) {
      await this.createReviewNotification(
        worker.user.id,
        NotificationType.REVIEW_RECEIVED,
        'New Review Received',
        `You have received a ${dto.rating}-star review from a customer.`,
        `review:${review.id}:received`,
        { reviewId: review.id, rating: dto.rating },
      );
    }

    return this.toSafeDto(review);
  }

  async listCustomerReviews(customerUser: AuthenticatedUser): Promise<ReviewResponse[]> {
    const customer = await this.prisma.customer.findUnique({
      where: { userId: customerUser.id },
      select: { id: true },
    });
    if (!customer) {
      throw new NotFoundException('Customer profile is not available');
    }

    const reviews = await this.prisma.review.findMany({
      where: { customerId: customer.id },
      orderBy: { createdAt: 'desc' },
      include: reviewInclude,
    });

    return reviews.map((r) => this.toSafeDto(r));
  }

  async getCustomerReview(
    customerUser: AuthenticatedUser,
    reviewId: string,
  ): Promise<ReviewResponse> {
    const customer = await this.prisma.customer.findUnique({
      where: { userId: customerUser.id },
      select: { id: true },
    });
    if (!customer) {
      throw new NotFoundException('Customer profile is not available');
    }

    const review = await this.prisma.review.findFirst({
      where: { id: reviewId, customerId: customer.id },
      include: reviewInclude,
    });

    if (!review) {
      throw new NotFoundException('Review is not available');
    }

    return this.toSafeDto(review);
  }

  async listWorkerReviews(workerUser: AuthenticatedUser): Promise<ReviewResponse[]> {
    const worker = await this.prisma.worker.findUnique({
      where: { userId: workerUser.id },
      select: { id: true },
    });
    if (!worker) {
      throw new NotFoundException('Worker profile is not available');
    }

    const reviews = await this.prisma.review.findMany({
      where: { workerId: worker.id },
      orderBy: { createdAt: 'desc' },
      include: reviewInclude,
    });

    return reviews.map((r) => this.toSafeDto(r));
  }

  async getWorkerReputation(workerUserId: string): Promise<ReputationResponse> {
    const worker = await this.prisma.worker.findUnique({
      where: { userId: workerUserId },
      select: { id: true },
    });
    if (!worker) {
      throw new NotFoundException('Worker profile is not available');
    }

    const reviews = await this.prisma.review.findMany({
      where: { workerId: worker.id },
      select: { rating: true },
    });

    const totalReviews = reviews.length;

    if (totalReviews === 0) {
      return {
        averageRating: null,
        totalReviews: 0,
        ratingDistribution: { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 },
      };
    }

    const sum = reviews.reduce((acc, r) => acc + r.rating, 0);
    const averageRating = Math.round((sum / totalReviews) * 10) / 10;

    const distribution: ReputationResponse['ratingDistribution'] = {
      '1': 0,
      '2': 0,
      '3': 0,
      '4': 0,
      '5': 0,
    };
    for (const r of reviews) {
      distribution[r.rating as 1 | 2 | 3 | 4 | 5]++;
    }

    return {
      averageRating,
      totalReviews,
      ratingDistribution: distribution,
    };
  }
}
