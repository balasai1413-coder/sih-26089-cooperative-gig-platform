'use client';

import { useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import { notificationsApi } from '@/lib/api/notifications';
import { cn } from '@/lib/utils';

interface NotificationBellProps {
  accessToken: string;
  onClick?: () => void;
  className?: string;
}

export function NotificationBell({ accessToken, onClick, className }: NotificationBellProps) {
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUnreadCount = async () => {
      try {
        const result = await notificationsApi.getUnreadCount(accessToken);
        setUnreadCount(result.unreadCount);
      } catch (error) {
        console.error('Failed to fetch unread count:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchUnreadCount();

    // Poll for updates every 30 seconds
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, [accessToken]);

  return (
    <button
      onClick={onClick}
      className={cn('relative p-2 text-gray-600 hover:text-gray-900 transition-colors', className)}
      aria-label="Notifications"
    >
      <Bell className="w-5 h-5" />
      {!loading && unreadCount > 0 && (
        <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white transform translate-x-1 -translate-y-1 bg-red-500 rounded-full">
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </button>
  );
}
