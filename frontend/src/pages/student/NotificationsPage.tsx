import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  CheckCheck,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Sparkles,
} from 'lucide-react';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { NotificationItem } from '../../api/types';
import { Button, Badge, Skeleton, EmptyState, useToast } from '../../components/ui';

export const NotificationsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { clearUnread } = useAuth();
  const { addToast } = useToast();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api.listNotifications({ size: 50 }),
  });

  const markAllMutation = useMutation({
    mutationFn: () => api.markAllNotificationsRead(),
    onSuccess: () => {
      clearUnread();
      addToast({
        title: 'All Notifications Marked Read',
        variant: 'neutral',
      });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const markSingleMutation = useMutation({
    mutationFn: (id: string) => api.markNotificationRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const notifications = data?.items || [];

  // Group notifications by day: Today, Yesterday, Older
  const grouped = React.useMemo(() => {
    const today: NotificationItem[] = [];
    const yesterday: NotificationItem[] = [];
    const older: NotificationItem[] = [];

    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const yest = new Date(now);
    yest.setDate(yest.getDate() - 1);
    const yesterdayStr = yest.toISOString().split('T')[0];

    notifications.forEach((item) => {
      const itemDate = item.created_at.split('T')[0];
      if (itemDate === todayStr) today.push(item);
      else if (itemDate === yesterdayStr) yesterday.push(item);
      else older.push(item);
    });

    return { today, yesterday, older };
  }, [notifications]);

  const handleNotificationClick = (item: NotificationItem) => {
    if (!item.is_read) {
      markSingleMutation.mutate(item.id);
    }
    if (item.link) {
      navigate(item.link);
    }
  };

  const renderNotificationCard = (item: NotificationItem) => (
    <div
      key={item.id}
      onClick={() => handleNotificationClick(item)}
      style={{
        backgroundColor: item.is_read ? 'var(--milk)' : 'var(--oat-100)',
        border: '1.5px solid var(--ink-border)',
        borderRadius: 'var(--radius-card)',
        padding: 'var(--space-4) var(--space-5)',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 'var(--space-4)',
        cursor: 'pointer',
        transition: 'all 0.15s ease',
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 'var(--radius-full)',
          backgroundColor: item.is_read ? 'var(--oat-200)' : 'var(--persimmon-100)',
          color: item.is_read ? 'var(--ink-mute)' : 'var(--persimmon-600)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <Bell size={18} />
      </div>

      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontWeight: 700, color: 'var(--ink)', fontSize: 'var(--text-sm)' }}>
            {item.title}
          </span>
          {!item.is_read && (
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                backgroundColor: 'var(--persimmon-500)',
                display: 'inline-block',
              }}
            />
          )}
        </div>
        <p style={{ margin: '4px 0 0', color: 'var(--ink-soft)', fontSize: 'var(--text-xs)', lineHeight: 'var(--leading-relaxed)' }}>
          {item.body}
        </p>
        <span style={{ fontSize: 11, color: 'var(--ink-mute)', marginTop: 6, display: 'inline-block' }}>
          {new Date(item.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 'var(--text-2xl)', color: 'var(--ink)' }}>
            Notifications & <span className="squiggle-word">Alerts</span>
          </h1>
          <p style={{ margin: '4px 0 0', color: 'var(--ink-soft)', fontSize: 'var(--text-sm)' }}>
            Real-time booking statuses, handover notifications, and return reminders
          </p>
        </div>

        {notifications.some((n) => !n.is_read) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => markAllMutation.mutate()}
            loading={markAllMutation.isPending}
            leftIcon={<CheckCheck size={16} />}
          >
            Mark All Read
          </Button>
        )}
      </div>

      {isLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <Skeleton height={80} borderRadius="var(--radius-card)" />
          <Skeleton height={80} borderRadius="var(--radius-card)" />
        </div>
      ) : notifications.length === 0 ? (
        <EmptyState
          title="All Caught Up"
          description="You don't have any unread notifications or system alerts."
          actionLabel="Go to Dashboard"
          onAction={() => navigate('/dashboard')}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
          {/* Today */}
          {grouped.today.length > 0 && (
            <div>
              <div style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--ink-mute)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 'var(--space-2)' }}>
                Today
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                {grouped.today.map(renderNotificationCard)}
              </div>
            </div>
          )}

          {/* Yesterday */}
          {grouped.yesterday.length > 0 && (
            <div>
              <div style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--ink-mute)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 'var(--space-2)' }}>
                Yesterday
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                {grouped.yesterday.map(renderNotificationCard)}
              </div>
            </div>
          )}

          {/* Older */}
          {grouped.older.length > 0 && (
            <div>
              <div style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--ink-mute)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 'var(--space-2)' }}>
                Older
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                {grouped.older.map(renderNotificationCard)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

