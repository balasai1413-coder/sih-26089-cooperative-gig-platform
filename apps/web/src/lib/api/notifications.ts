import { apiRequest } from './client';
import type {
  Notification,
  ListNotificationsResponse,
  UnreadCountResponse,
  MarkAllAsReadResponse,
} from '@/types/notification';

function withToken(accessToken: string, method?: string, body?: unknown) {
  return {
    ...(method ? { method } : {}),
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    accessToken,
  };
}

export const notificationsApi = {
  /**
   * List current user's notifications with optional pagination and filtering.
   */
  list: (accessToken: string, page: number = 1, limit: number = 20, unreadOnly: boolean = false) =>
    apiRequest<ListNotificationsResponse>(
      `/notifications?page=${page}&limit=${limit}${unreadOnly ? '&unreadOnly=true' : ''}`,
      withToken(accessToken),
    ),

  /**
   * Get the count of unread notifications for the current user.
   */
  getUnreadCount: (accessToken: string) =>
    apiRequest<UnreadCountResponse>('/notifications/unread-count', withToken(accessToken)),

  /**
   * Get a single notification by ID (current user only).
   */
  get: (accessToken: string, notificationId: string) =>
    apiRequest<Notification>(`/notifications/${notificationId}`, withToken(accessToken)),

  /**
   * Mark a single notification as read.
   */
  markAsRead: (accessToken: string, notificationId: string) =>
    apiRequest<Notification>(
      `/notifications/${notificationId}/read`,
      withToken(accessToken, 'PATCH', {}),
    ),

  /**
   * Mark all unread notifications as read for the current user.
   */
  markAllAsRead: (accessToken: string) =>
    apiRequest<MarkAllAsReadResponse>(
      '/notifications/read-all',
      withToken(accessToken, 'PATCH', {}),
    ),
};
