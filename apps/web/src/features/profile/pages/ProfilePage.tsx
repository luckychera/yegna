import { useSearchParams } from 'react-router';

import { useAuth } from '@/app/providers/useAuth';
import { PageHeader } from '@/components/layout/PageHeader';
import { PageLoading } from '@/components/feedback/states';
import { accountSection } from '../account-sections';
import { AccountNav } from '../components/AccountNav';
import { CardsSection } from '../components/CardsSection';
import { IdentitySection } from '../components/IdentitySection';
import { MembershipsSection } from '../components/MembershipsSection';
import { NotificationsSection } from '../components/NotificationsSection';
import { OverviewSection } from '../components/OverviewSection';
import { PersonalSection } from '../components/PersonalSection';
import { SecuritySection } from '../components/SecuritySection';

export function ProfilePage() {
  const { profile, status } = useAuth();
  const [params] = useSearchParams();
  const section = accountSection(params.get('section'));

  if (status === 'loading' || !profile) {
    return <PageLoading label="Loading your account" />;
  }

  return (
    <div>
      <PageHeader
        title="Account"
        description="Your name, identity, memberships and sign-in. Community roles stay with each community."
      />
      <div className="grid items-start gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
        <AccountNav section={section} />
        <div className="min-w-0">
          {section === 'overview' ? <OverviewSection profile={profile} /> : null}
          {section === 'personal' ? <PersonalSection profile={profile} /> : null}
          {section === 'identity' ? <IdentitySection /> : null}
          {section === 'memberships' ? <MembershipsSection /> : null}
          {section === 'cards' ? <CardsSection /> : null}
          {section === 'security' ? <SecuritySection /> : null}
          {section === 'notifications' ? <NotificationsSection /> : null}
        </div>
      </div>
    </div>
  );
}
