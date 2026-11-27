import { toast } from 'sonner';

import { useNotificationPreferences, useUpdateNotificationPreference } from '@/features/account/account.hooks';
import { NOTIFICATION_CATEGORIES, type NotificationCategory } from '@/features/account/account.types';
import { ErrorState, ListSkeleton } from '@/components/feedback/states';
import { Card, CardContent } from '@/components/ui/Card';
import { getErrorMessage } from '@/lib/api/errors';
import { cn } from '@/lib/utils/cn';
import { SectionFrame } from './SectionFrame';

const COPY: Record<NotificationCategory, { label: string; description: string }> = {
  announcements: {
    label: 'Announcements',
    description: 'Notices, meetings and events published in your communities.',
  },
  contributions: {
    label: 'Contributions',
    description: 'New contributions and reminders when one is due.',
  },
  payments: {
    label: 'Payments',
    description: 'Results of payments you make, including failures and refunds.',
  },
  memberships: {
    label: 'Memberships',
    description: 'When a community approves, suspends or removes your membership.',
  },
  invitations: {
    label: 'Invitations',
    description: 'Invitations you receive, and replies to invitations you send.',
  },
};

export function NotificationsSection() {
  const preferences = useNotificationPreferences();
  const update = useUpdateNotificationPreference();

  function toggle(category: NotificationCategory, enabled: boolean) {
    update.mutate(
      { category, enabled: !enabled },
      { onError: (error) => toast.error(getErrorMessage(error)) },
    );
  }

  return (
    <SectionFrame
      title="Notification preferences"
      description="These switches control in-app notifications. Email and SMS are not sent."
    >
      {preferences.isPending ? <ListSkeleton rows={5} /> : null}
      {preferences.isError ? <ErrorState error={preferences.error} onRetry={() => void preferences.refetch()} /> : null}
      {preferences.data ? (
        <Card>
          <CardContent className="divide-y divide-line py-2">
            {NOTIFICATION_CATEGORIES.map((category) => {
              const enabled = preferences.data.inApp[category] !== false;
              const pending = update.isPending && update.variables?.category === category;
              const copy = COPY[category];

              return (
                <div key={category} className="flex items-center justify-between gap-4 py-3">
                  <div className="min-w-0">
                    <p id={`${category}-label`} className="font-medium text-ink">
                      {copy.label}
                    </p>
                    <p id={`${category}-hint`} className="text-small text-ink-secondary">
                      {copy.description}
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={enabled}
                    aria-labelledby={`${category}-label`}
                    aria-describedby={`${category}-hint`}
                    aria-busy={pending || undefined}
                    disabled={pending}
                    onClick={() => toggle(category, enabled)}
                    className={cn(
                      'relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-60',
                      enabled ? 'bg-primary' : 'bg-line',
                    )}
                  >
                    <span
                      aria-hidden
                      className={cn(
                        'absolute top-0.5 h-5 w-5 rounded-full bg-surface shadow transition-transform',
                        enabled ? 'translate-x-5' : 'translate-x-0.5',
                      )}
                    />
                  </button>
                </div>
              );
            })}
          </CardContent>
        </Card>
      ) : null}
    </SectionFrame>
  );
}
