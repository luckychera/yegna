import { Pin } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';

import { EmptyState, ErrorState, ListSkeleton } from '@/components/feedback/states';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { ConfirmDialog, Dialog } from '@/components/ui/Dialog';
import { formatDateTime, formatRelative } from '@/lib/formatting/date';
import { runAction } from '@/lib/api/action';
import { useAnnouncement, useCommunityAnnouncements, useMarkAnnouncementRead, useRemoveAnnouncement } from '../announcement.hooks';
import { ANNOUNCEMENT_CATEGORY_LABELS, type Announcement } from '../announcement.types';
import { AnnouncementFormDialog } from './AnnouncementFormDialog';

function AnnouncementBody({ announcement }: { announcement: Announcement }) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={announcement.category === 'notice' ? 'warning' : 'neutral'}>
          {ANNOUNCEMENT_CATEGORY_LABELS[announcement.category]}
        </Badge>
        {announcement.isPinned ? <Badge tone="info" icon={Pin}>Pinned</Badge> : null}
        {!announcement.isRead ? <Badge tone="info">Unread</Badge> : null}
      </div>
      <p className="whitespace-pre-line text-body text-ink">{announcement.body}</p>
      <dl className="grid gap-2 border-t border-line pt-3 text-small text-ink-secondary sm:grid-cols-2">
        <div>
          <dt>Published</dt>
          <dd className="font-medium text-ink">{formatDateTime(announcement.publishedAt)}</dd>
        </div>
        <div>
          <dt>Author</dt>
          <dd className="font-medium text-ink">{announcement.author.name}</dd>
        </div>
        {announcement.eventAt ? (
          <div>
            <dt>When</dt>
            <dd className="font-medium text-ink">{formatDateTime(announcement.eventAt)}</dd>
          </div>
        ) : null}
        {announcement.location ? (
          <div>
            <dt>Where</dt>
            <dd className="font-medium text-ink">{announcement.location}</dd>
          </div>
        ) : null}
      </dl>
    </div>
  );
}

export function CommunityAnnouncementsPanel({ communityId, canManage }: { communityId: string; canManage: boolean }) {
  const [params, setParams] = useSearchParams();
  const selectedId = params.get('announcement');
  const list = useCommunityAnnouncements(communityId);
  const fromList = list.data?.announcements.find((item) => item.id === selectedId) ?? null;
  const fetched = useAnnouncement(communityId, selectedId && !fromList && list.isSuccess ? selectedId : null);
  const selected = fromList ?? fetched.data ?? null;
  const markRead = useMarkAnnouncementRead();
  const remove = useRemoveAnnouncement(communityId);
  const marked = useRef<string | null>(null);
  const [editing, setEditing] = useState<Announcement | null>(null);
  const [creating, setCreating] = useState(false);
  const [removing, setRemoving] = useState(false);

  useEffect(() => {
    if (!selected || selected.isRead || marked.current === selected.id) return;

    marked.current = selected.id;
    markRead.mutate({ communityId, id: selected.id });
  }, [selected, communityId, markRead]);

  function closeDetail() {
    const next = new URLSearchParams(params);
    next.delete('announcement');
    setParams(next, { replace: true });
  }

  function openDetail(id: string) {
    const next = new URLSearchParams(params);
    next.set('tab', 'announcements');
    next.set('announcement', id);
    setParams(next, { replace: true });
  }

  async function confirmRemove() {
    if (!selected) return;

    const ok = await runAction(() => remove.mutateAsync(selected.id), 'Announcement removed');

    if (ok) {
      setRemoving(false);
      closeDetail();
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-body text-ink-secondary">
          {list.data && list.data.unreadCount > 0
            ? `${list.data.unreadCount} unread`
            : 'Notices, meetings and reminders for this community.'}
        </p>
        {canManage ? <Button onClick={() => setCreating(true)}>New announcement</Button> : null}
      </div>

      {list.isPending ? <ListSkeleton rows={3} /> : null}
      {list.isError ? <ErrorState error={list.error} onRetry={() => void list.refetch()} /> : null}
      {list.isSuccess && list.data.announcements.length === 0 ? (
        <EmptyState
          title="No announcements yet"
          description={canManage ? 'Publish a notice, meeting or reminder for members.' : 'Announcements from this community will appear here.'}
        />
      ) : null}
      {list.data && list.data.announcements.length > 0 ? (
        <ul className="space-y-3">
          {list.data.announcements.map((item) => (
            <li key={item.id}>
              <button type="button" onClick={() => openDetail(item.id)} className="w-full text-left">
                <Card className="transition-colors hover:border-primary/40">
                  <CardContent className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone="neutral">{ANNOUNCEMENT_CATEGORY_LABELS[item.category]}</Badge>
                      {item.isPinned ? <Badge tone="info" icon={Pin}>Pinned</Badge> : null}
                      {!item.isRead ? <Badge tone="info">Unread</Badge> : null}
                    </div>
                    <p className="text-body font-semibold text-ink">{item.title}</p>
                    <p className="line-clamp-2 text-body text-ink-secondary">{item.body}</p>
                    <p className="text-small text-ink-muted">
                      {item.author.name} · {formatRelative(item.publishedAt)}
                    </p>
                  </CardContent>
                </Card>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {list.data && list.data.announcements.length === 50 ? (
        <p className="text-small text-ink-secondary">Showing the 50 most recent announcements.</p>
      ) : null}

      <Dialog
        open={Boolean(selectedId)}
        onOpenChange={(open) => {
          if (!open) closeDetail();
        }}
        title={selected?.title ?? 'Announcement'}
        description={selected ? `Published by ${selected.author.name}` : 'Announcement'}
        className="max-w-lg"
        footer={
          canManage && selected ? (
            <>
              <Button variant="secondary" onClick={() => setEditing(selected)}>
                Edit
              </Button>
              <Button variant="danger" onClick={() => setRemoving(true)}>
                Remove
              </Button>
            </>
          ) : undefined
        }
      >
        {selected ? <AnnouncementBody announcement={selected} /> : null}
        {!selected && (list.isPending || fetched.isLoading) ? <ListSkeleton rows={2} /> : null}
        {!selected && fetched.isError ? <ErrorState error={fetched.error} onRetry={() => void fetched.refetch()} /> : null}
      </Dialog>

      <AnnouncementFormDialog key={creating ? 'create' : 'create-closed'} communityId={communityId} open={creating} onOpenChange={setCreating} />
      <AnnouncementFormDialog
        key={editing?.id ?? 'edit-closed'}
        communityId={communityId}
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
        announcement={editing}
      />
      <ConfirmDialog
        open={removing}
        onOpenChange={(open) => {
          if (!open && !remove.isPending) setRemoving(false);
        }}
        title="Remove this announcement?"
        description="Members will no longer see it, and its notification will be withdrawn. This cannot be undone from the app."
        confirmLabel="Remove announcement"
        tone="danger"
        loading={remove.isPending}
        onConfirm={confirmRemove}
      />
    </div>
  );
}
