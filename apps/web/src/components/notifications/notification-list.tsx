'use client';

import { useEffect, useState, useCallback } from 'react';
import { Notification } from '@/types/notification';
import { notificationsApi } from '@/lib/api/notifications';
import { NotificationItem } from './notification-item';
import { cn } from '@/lib/utils';

interface NotificationListProps {
  accessToken: string;
  onNotificationClick?: (notification: Notification) => void;
  className?: string;
  compact?: boolean;
}

export function NotificationList({
  accessToken,
  onNotificationClick,
  className,
  compact = false,
}: NotificationListProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = compact ? 5 : 20;

  const fetchNotifications = useCallback(
    async (pageNum: number) => {
      try {
        setLoading(true);
        const result = await notificationsApi.list(accessToken, pageNum, limit, false);
        setNotifications(result.data);
        setTotal(result.total);
        setPage(result.page);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load notifications');
        console.error('Failed to fetch notifications:', err);
      } finally {
        setLoading(false);
      }
    },
    [accessToken, limit],
  );

  useEffect(() => {
    fetchNotifications(page);
  }, [fetchNotifications, page]);

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      await notificationsApi.markAsRead(accessToken, notificationId);
      setNotifications(
        notifications.map((n) =>
          n.id === notificationId ? { ...n, readAt: new Date().toISOString() } : n,
        ),
      );
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  if (loading) {
    return (
      <div className={cn('p-4 text-center text-gray-500', className)}>Loading notifications...</div>
    );
  }

  if (error) {
    return <div className={cn('p-4 text-center text-red-500', className)}>{error}</div>;
  }

  if (notifications.length === 0) {
    return (
      <div className={cn('p-4 text-center text-gray-500', className)}>No notifications yet</div>
    );
  }

  return (
    <div className={cn('divide-y divide-gray-200', className)}>
      {notifications.map((notification) => (
        <NotificationItem
          key={notification.id}
          notification={notification}
          onRead={handleMarkAsRead}
          onClick={onNotificationClick}
        />
      ))}

      {!compact && total > limit && (
        <div className="p-4 text-center">
          <button
            onClick={() => setPage(page + 1)}
            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
          >
            Load more
          </button>
        </div>
      )}
    </div>
  );
}
