'use client';

import { formatDistanceToNow } from 'date-fns';
import { Notification } from '@/types/notification';
import { cn } from '@/lib/utils';

interface NotificationItemProps {
  notification: Notification;
  onRead?: (notificationId: string) => void;
  onClick?: (notification: Notification) => void;
}

const notificationTypeLabels: Record<string, string> = {
  BOOKING_CREATED: '📅 Booking',
  BOOKING_ACCEPTED: '✅ Booking Accepted',
  BOOKING_REJECTED: '❌ Booking Rejected',
  BOOKING_STARTED: '▶️ Service Started',
  BOOKING_COMPLETED: '✓ Service Completed',
  BOOKING_CANCELLED: '🚫 Booking Cancelled',
  PAYMENT_SUCCESS: '💰 Payment Successful',
  PAYMENT_FAILED: '⚠️ Payment Failed',
  REVIEW_RECEIVED: '⭐ Review Received',
};

export function NotificationItem({ notification, onRead, onClick }: NotificationItemProps) {
  const handleClick = () => {
    if (!notification.readAt && onRead) {
      onRead(notification.id);
    }
    onClick?.(notification);
  };

  const isUnread = !notification.readAt;
  const timeAgo = formatDistanceToNow(new Date(notification.createdAt), {
    addSuffix: true,
  });

  return (
    <div
      onClick={handleClick}
      className={cn(
        'p-4 border-b border-gray-200 hover:bg-gray-50 cursor-pointer transition-colors',
        isUnread && 'bg-blue-50',
      )}
    >
      <div className="flex justify-between items-start gap-2">
        <div className="flex-1">
          <h4 className={cn('text-sm font-medium', isUnread && 'font-semibold')}>
            {notificationTypeLabels[notification.type] || notification.title}
          </h4>
          <p className="text-sm text-gray-700 mt-1">{notification.message}</p>
          <p className="text-xs text-gray-500 mt-2">{timeAgo}</p>
        </div>
        {isUnread && <div className="flex-shrink-0 w-2 h-2 bg-blue-500 rounded-full mt-1" />}
      </div>
    </div>
  );
}
