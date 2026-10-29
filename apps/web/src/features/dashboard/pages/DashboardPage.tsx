import { ArrowRight, Bell, CreditCard, HandCoins, Users } from 'lucide-react';
import { Link } from 'react-router';

import { useAuth } from '@/app/providers/useAuth';
import { StatCard } from '@/components/data-display/StatCard';
import { StatusBadge } from '@/components/data-display/StatusBadge';
import { contributionDisplayStatus } from '@/components/data-display/status-config';
import { EmptyState, ErrorState, ListSkeleton } from '@/components/feedback/states';
import { Button } from '@/components/ui/Button';
import { buttonVariants } from '@/components/ui/button-variants';
import { Avatar } from '@/components/ui/Avatar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { useMyCommunities } from '@/features/communities/community.hooks';
import { useMyContributions } from '@/features/contributions/contribution.hooks';
import { isPayable } from '@/features/contributions/contribution.types';
import { useNotifications, useUnreadCount } from '@/features/notifications/notification.hooks';
import { notificationVisual } from '@/features/notifications/notification-visuals';
import { useMyPayments } from '@/features/payments/payment.hooks';
import { formatDueLabel, formatRelative, greetingFor } from '@/lib/formatting/date';
import { formatMoney } from '@/lib/formatting/money';
import { pickSummary } from '@/lib/formatting/summary';
import { cn } from '@/lib/utils/cn';

export function DashboardPage() {
  const { profile } = useAuth();
  const firstName = profile?.profile?.firstName ?? profile?.profile?.displayName ?? '';

  const communities = useMyCommunities({ status: 'active', limit: 1 });
  const payments = useMyPayments({ limit: 1 });
  const contributions = useMyContributions({ limit: 100 });
  const unread = useUnreadCount();
  const activity = useNotifications({ limit: 5 });

  const paid = pickSummary(payments.data?.summary);
  const due = pickSummary(contributions.data?.summary);
  const currency = paid?.currency ?? due?.currency ?? 'ETB';

  const upcoming = (contributions.data?.items ?? [])
    .filter(isPayable)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .slice(0, 5);

  const hasNoCommunities = communities.isSuccess && communities.data.pagination.total === 0;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-h2 font-semibold text-ink sm:text-h1 sm:font-bold">
          {greetingFor()}
          {firstName ? `, ${firstName}` : ''}
        </h1>
        <p className="mt-1 text-body text-ink-secondary">Here&apos;s what&apos;s happening in your communities.</p>
      </header>

      <section aria-label="Summary" className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="My Communities"
          icon={Users}
          value={String(communities.data?.pagination.total ?? 0)}
          loading={communities.isPending}
        />
        <StatCard
          label="Total Contributions"
          icon={HandCoins}
          tone="info"
          value={formatMoney(paid?.totalPaid ?? 0, currency)}
          hint="Paid so far"
          loading={payments.isPending}
        />
        <StatCard
          label="Amount Due"
          icon={CreditCard}
          tone="warning"
          value={formatMoney(due?.outstandingAmount ?? 0, currency)}
          hint={due && due.overdueCount > 0 ? `${due.overdueCount} overdue` : 'Outstanding contributions'}
          loading={contributions.isPending}
        />
        <StatCard
          label="Notifications"
          icon={Bell}
          tone="danger"
          value={String(unread.data ?? 0)}
          hint="Unread"
          loading={unread.isPending}
        />
      </section>

      {hasNoCommunities ? (
        <EmptyState
          title="No communities yet"
          description="Join or create a community to get started."
          action={
            <Link to="/communities" className={buttonVariants({})}>
              Explore Communities
            </Link>
          }
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
              <Link to="/notifications" className="text-label font-medium text-primary hover:underline">
                View all
              </Link>
            </CardHeader>
            <CardContent>
              {activity.isPending ? <ListSkeleton rows={3} /> : null}
              {activity.isError ? <ErrorState error={activity.error} onRetry={() => void activity.refetch()} /> : null}
              {activity.isSuccess && activity.data.items.length === 0 ? (
                <p className="py-6 text-center text-body text-ink-secondary">No activity yet.</p>
              ) : null}
              {activity.isSuccess && activity.data.items.length > 0 ? (
                <ul className="divide-y divide-line">
                  {activity.data.items.map((item) => {
                    const { icon: Icon, tone } = notificationVisual(item.type);

                    return (
                      <li key={item.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                        <span
                          className={cn(
                            'flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
                            tone === 'success' && 'bg-success-soft text-success-ink',
                            tone === 'warning' && 'bg-warning-soft text-warning-ink',
                            tone === 'danger' && 'bg-danger-soft text-danger-ink',
                            tone === 'info' && 'bg-info-soft text-info-ink',
                            tone === 'neutral' && 'bg-surface-soft text-ink-secondary',
                          )}
                        >
                          <Icon className="h-4 w-4" aria-hidden />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className={cn('text-body text-ink', !item.readAt && 'font-semibold')}>{item.title}</p>
                          <p className="truncate text-small text-ink-secondary">{item.message}</p>
                        </div>
                        <time className="shrink-0 text-small text-ink-muted" dateTime={item.createdAt}>
                          {formatRelative(item.createdAt)}
                        </time>
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Upcoming Contributions</CardTitle>
              <Link to="/contributions" className="text-label font-medium text-primary hover:underline">
                View all
              </Link>
            </CardHeader>
            <CardContent>
              {contributions.isPending ? <ListSkeleton rows={3} /> : null}
              {contributions.isError ? (
                <ErrorState error={contributions.error} onRetry={() => void contributions.refetch()} />
              ) : null}
              {contributions.isSuccess && upcoming.length === 0 ? (
                <p className="py-6 text-center text-body text-ink-secondary">You&apos;re all caught up. Nothing is due.</p>
              ) : null}
              {upcoming.length > 0 ? (
                <ul className="divide-y divide-line">
                  {upcoming.map((item) => (
                    <li key={item.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                      <Avatar name={item.community.name} src={item.community.logoUrl} shape="rounded" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-body font-medium text-ink">{item.community.name}</p>
                        <p className="text-small text-ink-secondary">{formatDueLabel(item.dueDate)}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className="text-body font-semibold text-ink">
                          {formatMoney(item.outstandingAmount, item.currency)}
                        </span>
                        <StatusBadge kind="contribution" status={contributionDisplayStatus(item)} />
                      </div>
                    </li>
                  ))}
                </ul>
              ) : null}
              {upcoming.length > 0 ? (
                <Link to="/contributions" className="mt-4 block">
                  <Button variant="outline" fullWidth>
                    Go to contributions
                    <ArrowRight className="h-4 w-4" aria-hidden />
                  </Button>
                </Link>
              ) : null}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
