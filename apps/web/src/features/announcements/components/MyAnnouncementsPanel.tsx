import { Pin } from 'lucide-react';
import { Link } from 'react-router';

import { ErrorState, ListSkeleton } from '@/components/feedback/states';
import { Badge } from '@/components/ui/Badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { formatRelative } from '@/lib/formatting/date';
import { useMyAnnouncements } from '../announcement.hooks';
import { ANNOUNCEMENT_CATEGORY_LABELS } from '../announcement.types';

export function MyAnnouncementsPanel() {
  const announcements = useMyAnnouncements(4);
  const items = announcements.data ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Announcements</CardTitle>
      </CardHeader>
      <CardContent>
        {announcements.isPending ? <ListSkeleton rows={3} /> : null}
        {announcements.isError ? <ErrorState error={announcements.error} onRetry={() => void announcements.refetch()} /> : null}
        {announcements.isSuccess && items.length === 0 ? (
          <p className="py-6 text-center text-body text-ink-secondary">No announcements from your communities yet.</p>
        ) : null}
        {items.length > 0 ? (
          <ul className="divide-y divide-line">
            {items.map((item) => (
              <li key={item.id}>
                <Link
                  to={`/communities/${item.communityId}?tab=announcements&announcement=${item.id}`}
                  className="flex items-start gap-3 rounded-xl px-2 py-3 hover:bg-surface-soft"
                >
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className={item.isRead ? 'text-body text-ink' : 'text-body font-semibold text-ink'}>{item.title}</span>
                      {!item.isRead ? <Badge tone="info">Unread</Badge> : null}
                      {item.isPinned ? <Badge tone="neutral" icon={Pin}>Pinned</Badge> : null}
                    </span>
                    <span className="mt-0.5 block truncate text-small text-ink-secondary">
                      {item.community?.name ?? 'Community'} · {ANNOUNCEMENT_CATEGORY_LABELS[item.category]} · {formatRelative(item.publishedAt)}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
      </CardContent>
    </Card>
  );
}
