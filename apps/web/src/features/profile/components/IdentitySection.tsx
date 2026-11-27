import { useIdentityDetails } from '@/features/account/account.hooks';
import { ErrorState, Skeleton } from '@/components/feedback/states';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Card, CardContent } from '@/components/ui/Card';
import { formatDate } from '@/lib/formatting/date';
import { identifierTypeLabel, identityStatus } from '../identity-status';
import { SectionFrame } from './SectionFrame';

function Row({ label, children }: { label: string; children: string }) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-line py-3 last:border-b-0 sm:flex-row sm:items-center sm:justify-between">
      <dt className="text-body text-ink-secondary">{label}</dt>
      <dd className="text-body font-medium text-ink">{children}</dd>
    </div>
  );
}

export function IdentitySection() {
  const identity = useIdentityDetails();

  return (
    <SectionFrame
      title="Identity verification"
      description="Your Fayda number is stored only to verify this account. It is never shown, not even in part, and it is not your membership number."
    >
      {identity.isPending ? <Skeleton className="h-40 w-full" /> : null}
      {identity.isError ? <ErrorState error={identity.error} onRetry={() => void identity.refetch()} /> : null}
      {identity.isSuccess && !identity.data ? (
        <Card>
          <CardContent className="space-y-3">
            <Badge tone="neutral">Not verified</Badge>
            <p className="text-body text-ink-secondary">No Fayda verification is on file for this account.</p>
          </CardContent>
        </Card>
      ) : null}
      {identity.data ? (
        <Card>
          <CardContent className="space-y-4">
            <Badge tone={identityStatus(identity.data.verificationStatus).tone}>
              {identityStatus(identity.data.verificationStatus).label}
            </Badge>
            {identity.data.verificationMode === 'mock' ? (
              <Alert tone="warning" title="Development verification">
                This account was checked with the development identity provider, not the government Fayda service. A
                configured deployment uses the live check instead.
              </Alert>
            ) : null}
            {identity.data.verificationMode === 'live' ? (
              <Alert tone="success" title="Fayda service">
                This account was checked with the Fayda identity service.
              </Alert>
            ) : null}
            {identity.data.verificationMode === null ? (
              <Alert tone="info">How this verification was performed was not recorded.</Alert>
            ) : null}
            <dl>
              <Row label="Provider">{identity.data.provider === 'fayda' ? 'Fayda' : identity.data.provider}</Row>
              <Row label="Identifier type">{identifierTypeLabel(identity.data.identifierType)}</Row>
              <Row label="Verified on">{identity.data.verifiedAt ? formatDate(identity.data.verifiedAt) : 'Not yet'}</Row>
            </dl>
          </CardContent>
        </Card>
      ) : null}
    </SectionFrame>
  );
}
