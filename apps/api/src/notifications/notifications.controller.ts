import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Authorize } from '../auth/decorators/authorize.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { NotificationsService } from './notifications.service';
import { ListNotificationsQueryDto, MarkAsReadDto, MarkAllAsReadDto } from './dto/notification.dto';

@Controller('notifications')
@Authorize({ roles: [UserRole.CUSTOMER, UserRole.WORKER, UserRole.COOPERATIVE_ADMIN] })
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  /**
   * GET /api/v1/notifications
   * List current user's notifications with pagination and unread filtering.
   */
  @Get()
  async listNotifications(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListNotificationsQueryDto,
  ) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const unreadOnly = query.unreadOnly ?? false;

    return this.notificationsService.listNotifications(user, page, limit, unreadOnly);
  }

  /**
   * GET /api/v1/notifications/unread-count
   * Get the count of unread notifications for the current user.
   */
  @Get('unread-count')
  async getUnreadCount(@CurrentUser() user: AuthenticatedUser) {
    const count = await this.notificationsService.getUnreadCount(user);
    return { unreadCount: count };
  }

  /**
   * PATCH /api/v1/notifications/read-all
   * Mark all unread notifications as read for the current user.
   */
  @Patch('read-all')
<<<<<<< Updated upstream
  async markAllAsRead(@CurrentUser() user: AuthenticatedUser, @Body() _dto: MarkAllAsReadDto) {
    void _dto;
=======
  async markAllAsRead(@CurrentUser() user: AuthenticatedUser, @Body() dto: MarkAllAsReadDto) {
    void dto;
>>>>>>> Stashed changes
    return this.notificationsService.markAllAsRead(user);
  }

  /**
   * GET /api/v1/notifications/:notificationId
   * Get a single notification by ID. User can only access their own notifications.
   */
  @Get(':notificationId')
  async getNotification(
    @CurrentUser() user: AuthenticatedUser,
    @Param('notificationId', ParseUUIDPipe) notificationId: string,
  ) {
    try {
      return await this.notificationsService.getNotification(user, notificationId);
    } catch (error) {
      if (error instanceof Error && error.message === 'Notification not found') {
        throw new NotFoundException('Notification not found');
      }
      if (error instanceof Error && error.message === 'Unauthorized') {
        throw new UnauthorizedException('You do not have access to this notification');
      }
      throw error;
    }
  }

  /**
   * PATCH /api/v1/notifications/:notificationId/read
   * Mark a single notification as read.
   */
  @Patch(':notificationId/read')
  async markAsRead(
    @CurrentUser() user: AuthenticatedUser,
    @Param('notificationId', ParseUUIDPipe) notificationId: string,
    @Body() dto: MarkAsReadDto,
  ) {
<<<<<<< Updated upstream
    void _dto;
=======
    void dto;
>>>>>>> Stashed changes
    try {
      return await this.notificationsService.markAsRead(user, notificationId);
    } catch (error) {
      if (error instanceof Error && error.message === 'Notification not found') {
        throw new NotFoundException('Notification not found');
      }
      if (error instanceof Error && error.message === 'Unauthorized') {
        throw new UnauthorizedException('You do not have access to this notification');
      }
      throw error;
    }
  }
}
