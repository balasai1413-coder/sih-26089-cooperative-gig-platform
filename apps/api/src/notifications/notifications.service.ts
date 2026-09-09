import { Injectable } from '@nestjs/common';
import { Notification, NotificationType, Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { AuthenticatedUser } from '../auth/auth.types';

export interface NotificationResponse {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  metadata: Record<string, unknown> | null;
  readAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface CreateNotificationInput {
  recipientUserId: string;
  type: NotificationType;
  title: string;
  message: string;
  eventKey: string;
  metadata?: Prisma.InputJsonValue | null;
}

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a notification with duplicate prevention via eventKey (idempotency key).
   * If the eventKey already exists, returns the existing notification instead of creating a duplicate.
   * This is intentionally server-side only — the client cannot create notifications directly.
   */
  async createNotification(input: CreateNotificationInput): Promise<NotificationResponse> {
    try {
      const notification = await this.prisma.notification.create({
        data: {
          recipientUserId: input.recipientUserId,
          type: input.type,
          title: input.title,
          message: input.message,
          eventKey: input.eventKey,
          metadata: input.metadata ?? undefined,
        },
      });
      return this.formatNotification(notification);
    } catch (error) {
      // Handle unique constraint violation gracefully (idempotency key already exists)
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        // Fetch and return the existing notification
        const existingNotification = await this.prisma.notification.findUnique({
          where: { eventKey: input.eventKey },
        });
        if (existingNotification) {
          return this.formatNotification(existingNotification);
        }
      }
      throw error;
    }
  }

  /**
   * List notifications for the current authenticated user with pagination.
   * Supports filtering by unread status.
   */
  async listNotifications(
    user: AuthenticatedUser,
    page: number = 1,
    limit: number = 20,
    unreadOnly: boolean = false,
  ): Promise<{ data: NotificationResponse[]; total: number; page: number; limit: number }> {
    const skip = (page - 1) * limit;

    const where: Prisma.NotificationWhereInput = {
      recipientUserId: user.id,
      ...(unreadOnly && { readAt: null }),
    };

    const [notifications, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.notification.count({ where }),
    ]);

    return {
      data: notifications.map((n) => this.formatNotification(n)),
      total,
      page,
      limit,
    };
  }

  /**
   * Get a single notification by ID, ensuring the user owns it.
   */
  async getNotification(
    user: AuthenticatedUser,
    notificationId: string,
  ): Promise<NotificationResponse> {
    const notification = await this.prisma.notification.findUnique({
      where: { id: notificationId },
    });

    if (!notification) {
      throw new Error('Notification not found');
    }

    // Verify ownership
    if (notification.recipientUserId !== user.id) {
      throw new Error('Unauthorized');
    }

    return this.formatNotification(notification);
  }

  /**
   * Get unread count for the current user.
   */
  async getUnreadCount(user: AuthenticatedUser): Promise<number> {
    return this.prisma.notification.count({
      where: {
        recipientUserId: user.id,
        readAt: null,
      },
    });
  }

  /**
   * Mark a single notification as read.
   * Ensures the user owns the notification before allowing the update.
   */
  async markAsRead(user: AuthenticatedUser, notificationId: string): Promise<NotificationResponse> {
    const notification = await this.prisma.notification.findUnique({
      where: { id: notificationId },
    });

    if (!notification) {
      throw new Error('Notification not found');
    }

    // Verify ownership
    if (notification.recipientUserId !== user.id) {
      throw new Error('Unauthorized');
    }

    const updated = await this.prisma.notification.update({
      where: { id: notificationId },
      data: { readAt: new Date() },
    });

    return this.formatNotification(updated);
  }

  /**
   * Mark all notifications as read for the current user.
   */
  async markAllAsRead(user: AuthenticatedUser): Promise<{ updated: number }> {
    const result = await this.prisma.notification.updateMany({
      where: {
        recipientUserId: user.id,
        readAt: null,
      },
      data: { readAt: new Date() },
    });

    return { updated: result.count };
  }

  /**
   * Format a Notification model to the API response format.
   */
  private formatNotification(notification: Notification): NotificationResponse {
    return {
      id: notification.id,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      metadata: notification.metadata as Record<string, unknown> | null,
      readAt: notification.readAt ? notification.readAt.toISOString() : null,
      createdAt: notification.createdAt.toISOString(),
      updatedAt: notification.updatedAt.toISOString(),
    };
  }
}
