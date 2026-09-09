'use client';

import { useCallback, useEffect, useState } from 'react';
import { Notification } from '@/types/notification';
import { notificationsApi } from '@/lib/api/notifications';
import { NotificationItem } from './notification-item';
import { cn } from '@/lib/utils';

interface NotificationCenterProps {
  accessToken: string;
  onNotificationClick?: (notification: Notification) => void;
  className?: string;
}

export function NotificationCenter({
  accessToken,
  onNotificationClick,
  className,
}: NotificationCenterProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [filterUnreadOnly, setFilterUnreadOnly] = useState(false);
  const [markingAllRead, setMarkingAllRead] = useState(false);
  const limit = 20;

  const fetchNotifications = useCallback(
    async (pageNum: number, unreadOnly: boolean) => {
      try {
        setLoading(true);
        const result = await notificationsApi.list(accessToken, pageNum, limit, unreadOnly);
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
    // Reset to page 1 when filter changes
    setPage(1);
  }, [filterUnreadOnly]);

  useEffect(() => {
    fetchNotifications(page, filterUnreadOnly);
  }, [fetchNotifications, page, filterUnreadOnly]);

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

  const handleMarkAllAsRead = async () => {
    try {
      setMarkingAllRead(true);
      await notificationsApi.markAllAsRead(accessToken);
      // Refetch to get updated list
      await fetchNotifications(1, filterUnreadOnly);
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    } finally {
      setMarkingAllRead(false);
    }
  };

  const unreadCount = notifications.filter((n) => !n.readAt).length;

  return (
    <div className={cn('flex flex-col h-full bg-white', className)}>
      {/* Header */}
      <div className="flex justify-between items-center p-6 border-b border-gray-200">
        <div>
          <h1 className="text-2xl font-bold">Notifications</h1>
          <p className="text-sm text-gray-600 mt-1">
            {total} notification{total !== 1 ? 's' : ''}
            {unreadCount > 0 && ` · ${unreadCount} unread`}
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllAsRead}
            disabled={markingAllRead}
            className="px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-800 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {markingAllRead ? 'Marking...' : 'Mark all as read'}
          </button>
        )}
      </div>

      {/* Filter */}
      <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
        <label className="flex items-center text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={filterUnreadOnly}
            onChange={(e) => {
              setFilterUnreadOnly(e.target.checked);
              setPage(1);
            }}
            className="rounded border-gray-300"
          />
          <span className="ml-2 text-gray-700">Show unread only</span>
        </label>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-6 text-center text-gray-500">Loading notifications...</div>
        ) : error ? (
          <div className="p-6 text-center text-red-500">{error}</div>
        ) : notifications.length === 0 ? (
          <div className="p-6 text-center text-gray-500">
            {filterUnreadOnly ? 'No unread notifications' : 'No notifications yet'}
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {notifications.map((notification) => (
              <NotificationItem
                key={notification.id}
                notification={notification}
                onRead={handleMarkAsRead}
                onClick={onNotificationClick}
              />
            ))}
          </div>
        )}
      </div>

      {/* Pagination */}
      {!loading && total > limit && (
        <div className="p-4 border-t border-gray-200 flex justify-between items-center bg-gray-50">
          <button
            onClick={() => setPage(Math.max(1, page - 1))}
            disabled={page === 1}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          <span className="text-sm text-gray-600">
            Page {page} of {Math.ceil(total / limit)}
          </span>
          <button
            onClick={() => setPage(page + 1)}
            disabled={page >= Math.ceil(total / limit)}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
