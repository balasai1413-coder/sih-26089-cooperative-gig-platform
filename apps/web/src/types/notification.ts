export type NotificationType =
  | 'BOOKING_CREATED'
  | 'BOOKING_ACCEPTED'
  | 'BOOKING_REJECTED'
  | 'BOOKING_STARTED'
  | 'BOOKING_COMPLETED'
  | 'BOOKING_CANCELLED'
  | 'PAYMENT_SUCCESS'
  | 'PAYMENT_FAILED'
  | 'REVIEW_RECEIVED';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  metadata: Record<string, unknown> | null;
  readAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ListNotificationsResponse {
  data: Notification[];
  total: number;
  page: number;
  limit: number;
}

export interface UnreadCountResponse {
  unreadCount: number;
}

export interface MarkAsReadResponse {
  id: string;
  readAt: string;
}

export interface MarkAllAsReadResponse {
  updated: number;
}
