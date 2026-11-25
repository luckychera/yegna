import { BellOff, CheckCheck } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router';

import { EmptyState, ErrorState, ListSkeleton } from '@/components/feedback/states';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { runAction } from '@/lib/api/action';
import { formatRelative } from '@/lib/formatting/date';
import { cn } from '@/lib/utils/cn';
import { useMarkAllNotificationsRead, useMarkNotificationRead, useNotifications, useUnreadCount } from '../notification.hooks';
import { notificationTarget, notificationVisual } from '../notification-visuals';
import type { AppNotification } from '../notification.types';

const PAGE_SIZE = 20;

const TONE_STYLES = {
  success: 'bg-success-soft text-success-ink',
  warning: 'bg-warning-soft text-warning-ink',
  danger: 'bg-danger-soft text-danger-ink',
  info: 'bg-info-soft text-info-ink',
  neutral: 'bg-surface-soft text-ink-secondary',
} as const;

export function NotificationsPage() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [pages, setPages] = useState(1);

  const limit = PAGE_SIZE * pages;
  const query = useNotifications({ unreadOnly: filter === 'unread' || undefined, limit });
  const unread = useUnreadCount();
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();

  const items = query.data?.items ?? [];
  const hasMore = items.length === limit;
  const unreadTotal = unread.data ?? 0;

  async function open(notification: AppNotification) {
    if (!notification.readAt) {
      try {
        await markRead.mutateAsync(notification.id);
      } catch {
        // Opening the related page should not be blocked by a failed "mark as read".
      }
    }

    const target = notificationTarget(notification.type, notification.communityId);

    if (target) navigate(target);
  }

  return (
    <div>
      <PageHeader
        title="Notifications"
        description="Updates about your communities, contributions and payments."
        actions={
          <Button
            variant="secondary"
            disabled={unreadTotal === 0}
            loading={markAll.isPending}
            onClick={() => void runAction(() => markAll.mutateAsync(), 'All notifications marked as read')}
          >
            <CheckCheck className="h-4 w-4" aria-hidden />
            Mark all as read
          </Button>
        }
      />

      <Tabs
        value={filter}
        onValueChange={(value) => {
          setFilter(value as 'all' | 'unread');
          setPages(1);
        }}
      >
        <TabsList aria-label="Notification filter">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="unread">Unread{unreadTotal > 0 ? ` (${unreadTotal})` : ''}</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="mt-5">
        {query.isPending ? <ListSkeleton /> : null}
        {query.isError ? <ErrorState error={query.error} onRetry={() => void query.refetch()} /> : null}
        {query.isSuccess && items.length === 0 ? (
          <EmptyState
            icon={<BellOff className="h-6 w-6" aria-hidden />}
            title={filter === 'unread' ? "You're all caught up" : 'No notifications yet'}
            description={filter === 'unread' ? 'You have no unread notifications.' : 'Updates about your communities will appear here.'}
          />
        ) : null}

        {query.isSuccess && items.length > 0 ? (
          <>
            <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface shadow-card">
              {items.map((item) => {
                const { icon: Icon, tone } = notificationVisual(item.type);
                const isUnread = !item.readAt;

                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => void open(item)}
                      className={cn(
                        'flex w-full items-start gap-3 px-4 py-4 text-left transition-colors hover:bg-surface-soft',
                        isUnread && 'bg-primary-soft/40',
                      )}
                    >
                      <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-full', TONE_STYLES[tone])}>
                        <Icon className="h-5 w-5" aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className={cn('block text-body text-ink', isUnread && 'font-semibold')}>
                          {item.title}
                          {isUnread ? <span className="sr-only"> (unread)</span> : null}
                        </span>
                        <span className="block text-body text-ink-secondary">{item.message}</span>
                      </span>
                      <span className="flex shrink-0 flex-col items-end gap-1">
                        <time className="text-small text-ink-muted" dateTime={item.createdAt}>
                          {formatRelative(item.createdAt)}
                        </time>
                        {isUnread ? <span aria-hidden className="h-2 w-2 rounded-full bg-primary" /> : null}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
            {hasMore ? (
              <div className="mt-4 text-center">
                <Button variant="secondary" loading={query.isFetching} onClick={() => setPages((value) => value + 1)}>
                  Load more
                </Button>
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  );
}
