import { Calendar, ChartColumn, Pencil, Users } from 'lucide-react';
import { useState } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router';
import { toast } from 'sonner';

import { StatusBadge } from '@/components/data-display/StatusBadge';
import { EmptyState, ErrorState, ListSkeleton } from '@/components/feedback/states';
import { Alert } from '@/components/ui/Alert';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { buttonVariants } from '@/components/ui/button-variants';
import { Card, CardContent } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/Dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { CommunityContributionsPanel } from '@/features/contributions/components/CommunityContributionsPanel';
import { CommunityInvitationsPanel } from '@/features/invitations/components/CommunityInvitationsPanel';
import { MembersPanel } from '@/features/memberships/components/MembersPanel';
import { CommunityPaymentsPanel } from '@/features/payments/components/CommunityPaymentsPanel';
import { runAction } from '@/lib/api/action';
import { formatDate } from '@/lib/formatting/date';
import { humanize } from '@/lib/formatting/text';
import { PERMISSIONS } from '@/lib/permissions';
import { CommunityFormDialog } from '../components/CommunityFormDialog';
import { useCommunityInfo } from '../community-summary';
import { useJoinCommunity, useLeaveCommunity, useUpdateCommunity } from '../community.hooks';
import { communityTypeLabel, type CommunitySummary } from '../community.types';

export function CommunityDetailPage() {
  const { communityId = '' } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const hint = (location.state as { community?: CommunitySummary } | null)?.community ?? null;

  const info = useCommunityInfo(communityId, hint?.id === communityId ? hint : null);
  const join = useJoinCommunity();
  const leave = useLeaveCommunity();
  const update = useUpdateCommunity(communityId);

  const [confirm, setConfirm] = useState<'join' | 'leave' | null>(null);
  const [editing, setEditing] = useState(false);

  const can = (permission: string) => info.permissions.includes(permission);

  if (info.isPending) return <ListSkeleton rows={3} />;
  if (info.isError) return <ErrorState error={info.error} onRetry={info.retry} />;

  if (!info.community) {
    return (
      <EmptyState
        title="Community not found"
        description="This community doesn't exist, or you don't have access to it."
        action={
          <Link to="/communities" className={buttonVariants({})}>
            Back to communities
          </Link>
        }
      />
    );
  }

  const { community, membership } = info;
  const status = membership?.status;
  const canJoin = !status || status === 'left' || status === 'rejected';
  const canLeave = status === 'active' || status === 'suspended';

  const tabs = [
    { value: 'about', label: 'About', show: true },
    { value: 'members', label: 'Members', show: can(PERMISSIONS.MEMBERS_VIEW) },
    { value: 'contributions', label: 'Contributions', show: can(PERMISSIONS.CONTRIBUTIONS_VIEW) },
    { value: 'payments', label: 'Payments', show: can(PERMISSIONS.PAYMENTS_VIEW) },
    { value: 'invitations', label: 'Invitations', show: can(PERMISSIONS.MEMBERS_VIEW) },
  ].filter((tab) => tab.show);

  const tab = tabs.find((item) => item.value === params.get('tab'))?.value ?? 'about';

  async function submitConfirm() {
    if (confirm === 'join') {
      const ok = await runAction(() => join.mutateAsync(community.id), (result) => result.message);

      if (ok) setConfirm(null);
    } else if (confirm === 'leave') {
      const ok = await runAction(() => leave.mutateAsync(community.id), `You left ${community.name}`);

      if (ok) {
        setConfirm(null);
        navigate('/communities');
      }
    }
  }

  return (
    <div>
      <Card className="overflow-hidden">
        <div
          className="h-24 bg-gradient-to-r from-primary-dark to-secondary bg-cover bg-center sm:h-32"
          style={community.bannerUrl ? { backgroundImage: `url(${community.bannerUrl})` } : undefined}
          aria-label={community.bannerUrl ? `${community.name} banner` : undefined}
          role={community.bannerUrl ? 'img' : undefined}
        />
        <CardContent className="-mt-10 space-y-4 pt-0 sm:-mt-12">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex items-end gap-4">
              <Avatar name={community.name} src={community.logoUrl} size="xl" shape="rounded" className="border-4 border-surface" />
              <div className="min-w-0 pb-1">
                <h1 className="truncate text-h2 font-bold text-ink">{community.name}</h1>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <Badge tone="neutral">{communityTypeLabel(community.communityType)}</Badge>
                  <StatusBadge kind="community" status={community.status} />
                  {status ? <StatusBadge kind="membership" status={status} /> : null}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {can(PERMISSIONS.REPORTS_VIEW) ? (
                <Link to={`/reports?community=${community.id}`} className={buttonVariants({ variant: 'secondary' })}>
                  <ChartColumn className="h-4 w-4" aria-hidden />
                  Reports
                </Link>
              ) : null}
              {can(PERMISSIONS.COMMUNITY_UPDATE) ? (
                <Button variant="secondary" onClick={() => setEditing(true)}>
                  <Pencil className="h-4 w-4" aria-hidden />
                  Edit
                </Button>
              ) : null}
              {canJoin ? <Button onClick={() => setConfirm('join')}>Join Community</Button> : null}
              {status === 'pending' ? (
                <Button disabled variant="secondary">
                  Request sent
                </Button>
              ) : null}
              {canLeave ? (
                <Button variant="secondary" onClick={() => setConfirm('leave')}>
                  Leave
                </Button>
              ) : null}
            </div>
          </div>

          <dl className="grid grid-cols-3 gap-3 border-t border-line pt-4 text-center sm:max-w-md">
            <div>
              <dt className="text-small text-ink-secondary">Members</dt>
              <dd className="text-h3 font-bold text-ink">{community.memberCount}</dd>
            </div>
            <div>
              <dt className="text-small text-ink-secondary">Type</dt>
              <dd className="text-body font-semibold text-ink">{communityTypeLabel(community.communityType)}</dd>
            </div>
            <div>
              <dt className="text-small text-ink-secondary">Status</dt>
              <dd className="text-body font-semibold text-ink">{humanize(community.status)}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Tabs value={tab} onValueChange={(value) => setParams(value === 'about' ? {} : { tab: value }, { replace: true })} className="mt-6">
        <TabsList aria-label="Community sections">
          {tabs.map((item) => (
            <TabsTrigger key={item.value} value={item.value}>
              {item.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="about">
          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardContent className="space-y-4">
                <h2 className="text-h3 font-semibold text-ink">About this community</h2>
                <p className="whitespace-pre-line text-body text-ink-secondary">{community.description || 'This community has not added a description yet.'}</p>
                <dl className="grid gap-3 border-t border-line pt-4 sm:grid-cols-2">
                  <div className="flex items-center gap-2 text-body text-ink-secondary">
                    <Calendar className="h-4 w-4" aria-hidden />
                    <dt className="sr-only">Founded</dt>
                    <dd>Founded {formatDate(community.createdAt)}</dd>
                  </div>
                  <div className="flex items-center gap-2 text-body text-ink-secondary">
                    <Users className="h-4 w-4" aria-hidden />
                    <dt className="sr-only">Members</dt>
                    <dd>
                      {community.memberCount} {community.memberCount === 1 ? 'member' : 'members'}
                    </dd>
                  </div>
                </dl>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="space-y-3">
                <h2 className="text-h3 font-semibold text-ink">Your membership</h2>
                {membership ? (
                  <>
                    <StatusBadge kind="membership" status={membership.status} />
                    {info.roles.length > 0 ? (
                      <p className="text-body text-ink-secondary">Role: {info.roles.map((role) => humanize(role.name)).join(', ')}</p>
                    ) : null}
                    {status === 'pending' ? <p className="text-body text-ink-secondary">An administrator will review your request.</p> : null}
                    {status === 'suspended' ? <p className="text-body text-ink-secondary">Your membership is suspended. Contact an administrator.</p> : null}
                  </>
                ) : (
                  <p className="text-body text-ink-secondary">You are not a member of this community yet.</p>
                )}
              </CardContent>
            </Card>
          </div>

          {status === 'active' && tabs.length === 1 ? (
            <Alert tone="info" className="mt-4">
              Member lists, contributions and payments for this community are managed by its administrators. Your own contributions and payments are under Contributions and Payments in the menu.
            </Alert>
          ) : null}
        </TabsContent>

        {can(PERMISSIONS.MEMBERS_VIEW) ? (
          <TabsContent value="members">
            <MembersPanel communityId={community.id} canUpdate={can(PERMISSIONS.MEMBERS_UPDATE)} canRemove={can(PERMISSIONS.MEMBERS_REMOVE)} />
          </TabsContent>
        ) : null}

        {can(PERMISSIONS.CONTRIBUTIONS_VIEW) ? (
          <TabsContent value="contributions">
            <CommunityContributionsPanel
              communityId={community.id}
              communityName={community.name}
              canCreate={can(PERMISSIONS.CONTRIBUTIONS_CREATE)}
              canUpdate={can(PERMISSIONS.CONTRIBUTIONS_UPDATE)}
              canViewMembers={can(PERMISSIONS.MEMBERS_VIEW)}
            />
          </TabsContent>
        ) : null}

        {can(PERMISSIONS.PAYMENTS_VIEW) ? (
          <TabsContent value="payments">
            <CommunityPaymentsPanel communityId={community.id} canViewMembers={can(PERMISSIONS.MEMBERS_VIEW)} />
          </TabsContent>
        ) : null}

        {can(PERMISSIONS.MEMBERS_VIEW) ? (
          <TabsContent value="invitations">
            <CommunityInvitationsPanel communityId={community.id} canInvite={can(PERMISSIONS.MEMBERS_INVITE)} canViewMembers />
          </TabsContent>
        ) : null}
      </Tabs>

      <ConfirmDialog
        open={confirm !== null}
        onOpenChange={(open) => {
          if (!open) setConfirm(null);
        }}
        title={confirm === 'leave' ? `Leave ${community.name}?` : `Join ${community.name}?`}
        description={
          confirm === 'leave'
            ? 'You will no longer be a member and will lose access to its members and contributions. You can ask to join again later.'
            : "Some communities need an administrator to approve new members. You'll be notified of the outcome."
        }
        confirmLabel={confirm === 'leave' ? 'Leave community' : 'Join community'}
        tone={confirm === 'leave' ? 'danger' : 'primary'}
        loading={join.isPending || leave.isPending}
        onConfirm={submitConfirm}
      />

      <CommunityFormDialog
        open={editing}
        onOpenChange={setEditing}
        mode="edit"
        initial={{
          name: community.name,
          communityType: community.communityType,
          description: community.description,
          logoUrl: community.logoUrl,
          bannerUrl: community.bannerUrl,
        }}
        onSubmit={async (input) => {
          await update.mutateAsync(input);
          setEditing(false);
          toast.success('Community updated');
        }}
      />
    </div>
  );
}
