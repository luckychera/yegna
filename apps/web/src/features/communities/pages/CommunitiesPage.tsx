import { Plus, Users } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';

import { CardGridSkeleton, EmptyState, ErrorState } from '@/components/feedback/states';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/Dialog';
import { FilterSelect, SearchInput } from '@/components/ui/Field';
import { Pagination } from '@/components/ui/Pagination';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { runAction } from '@/lib/api/action';
import { CommunityCard, type CommunityCardModel } from '../components/CommunityCard';
import { CommunityFormDialog } from '../components/CommunityFormDialog';
import {
  useCommunityDirectory,
  useCreateCommunity,
  useJoinCommunity,
  useMyCommunities,
} from '../community.hooks';
import { COMMUNITY_TYPES, COMMUNITY_TYPE_LABELS, type CommunitySummary } from '../community.types';

const PAGE_SIZE = 12;
type Tab = 'all' | 'mine' | 'joined' | 'popular';
const TABS: { value: Tab; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'mine', label: 'My Communities' },
  { value: 'joined', label: 'Joined' },
  { value: 'popular', label: 'Popular' },
];

export function CommunitiesPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const tab = (TABS.find((item) => item.value === params.get('tab'))?.value ?? 'all') as Tab;

  const [search, setSearch] = useState('');
  const [type, setType] = useState('');
  const [offset, setOffset] = useState(0);
  const [creating, setCreating] = useState(false);
  const [joinTarget, setJoinTarget] = useState<CommunitySummary | null>(null);

  const q = useDebouncedValue(search.trim(), 300);
  const isDirectory = tab === 'all' || tab === 'popular';

  const directory = useCommunityDirectory({
    q: q || undefined,
    type: type || undefined,
    sort: tab === 'popular' ? 'popular' : 'newest',
    limit: PAGE_SIZE,
    offset,
  });
  // "My" tabs list the user's own memberships (the API has no search there, so filtering is local).
  const mine = useMyCommunities({ status: tab === 'joined' ? 'active' : undefined, limit: 100 });

  const create = useCreateCommunity();
  const join = useJoinCommunity();

  const query = isDirectory ? directory : mine;

  const models = useMemo<CommunityCardModel[]>(() => {
    if (isDirectory) {
      return (directory.data?.items ?? []).map((item) => ({ community: item, membership: item.myMembership }));
    }

    const needle = q.toLowerCase();

    return (mine.data?.items ?? [])
      .filter(
        (item) =>
          (!type || item.community.communityType === type) &&
          (!needle ||
            item.community.name.toLowerCase().includes(needle) ||
            (item.community.description ?? '').toLowerCase().includes(needle)),
      )
      .map((item) => ({ community: item.community, membership: { id: item.membership.id, status: item.membership.status } }));
  }, [isDirectory, directory.data, mine.data, q, type]);

  const pageModels = isDirectory ? models : models.slice(offset, offset + PAGE_SIZE);
  const total = isDirectory ? (directory.data?.pagination.total ?? 0) : models.length;
  const filtering = Boolean(q || type);

  function changeTab(next: string) {
    setParams(next === 'all' ? {} : { tab: next });
    setOffset(0);
  }

  async function confirmJoin() {
    if (!joinTarget) return;

    const ok = await runAction(() => join.mutateAsync(joinTarget.id), (result) => result.message);

    if (ok) setJoinTarget(null);
  }

  return (
    <div>
      <PageHeader
        title="Communities"
        description="Discover and join communities that match your goals."
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" aria-hidden />
            Create Community
          </Button>
        }
      />

      <div className="mb-5 flex flex-col gap-3 sm:flex-row">
        <SearchInput
          label="Search communities"
          placeholder="Search communities…"
          value={search}
          onChange={(value) => {
            setSearch(value);
            setOffset(0);
          }}
          className="flex-1"
        />
        <FilterSelect
          label="Filter by type"
          value={type}
          onChange={(event) => {
            setType(event.target.value);
            setOffset(0);
          }}
          className="sm:w-48"
        >
          <option value="">All types</option>
          {COMMUNITY_TYPES.map((value) => (
            <option key={value} value={value}>
              {COMMUNITY_TYPE_LABELS[value]}
            </option>
          ))}
        </FilterSelect>
      </div>

      <Tabs value={tab} onValueChange={changeTab}>
        <TabsList aria-label="Community views">
          {TABS.map((item) => (
            <TabsTrigger key={item.value} value={item.value}>
              {item.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="mt-5" aria-live="polite">
        {query.isPending ? <CardGridSkeleton /> : null}
        {query.isError ? <ErrorState error={query.error} onRetry={() => void query.refetch()} /> : null}

        {query.isSuccess && pageModels.length === 0 ? (
          <EmptyState
            icon={<Users className="h-6 w-6" aria-hidden />}
            title={filtering ? 'No communities match your search' : tab === 'all' || tab === 'popular' ? 'No communities yet' : 'No communities here yet'}
            description={
              filtering
                ? 'Try a different search or clear the filters.'
                : tab === 'all' || tab === 'popular'
                  ? 'Be the first: create a community to get started.'
                  : 'Join or create a community to get started.'
            }
            action={
              filtering ? (
                <Button
                  variant="secondary"
                  onClick={() => {
                    setSearch('');
                    setType('');
                  }}
                >
                  Clear filters
                </Button>
              ) : tab === 'all' || tab === 'popular' ? (
                <Button onClick={() => setCreating(true)}>Create Community</Button>
              ) : (
                <Button onClick={() => changeTab('all')}>Explore Communities</Button>
              )
            }
          />
        ) : null}

        {query.isSuccess && pageModels.length > 0 ? (
          <>
            <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {pageModels.map((model) => (
                <li key={model.community.id}>
                  <CommunityCard
                    model={model}
                    joining={join.isPending && joinTarget?.id === model.community.id}
                    onJoin={setJoinTarget}
                  />
                </li>
              ))}
            </ul>
            <Pagination limit={PAGE_SIZE} offset={offset} total={total} onChange={setOffset} />
          </>
        ) : null}
      </div>

      <CommunityFormDialog
        open={creating}
        onOpenChange={setCreating}
        mode="create"
        onSubmit={async (input) => {
          const community = await create.mutateAsync(input);

          setCreating(false);
          navigate(`/communities/${community.id}`);
        }}
      />

      <ConfirmDialog
        open={joinTarget !== null}
        onOpenChange={(open) => {
          if (!open) setJoinTarget(null);
        }}
        title={`Join ${joinTarget?.name ?? 'this community'}?`}
        description="Some communities need an administrator to approve new members. You'll be notified of the outcome."
        confirmLabel="Join community"
        loading={join.isPending}
        onConfirm={confirmJoin}
      />
    </div>
  );
}
