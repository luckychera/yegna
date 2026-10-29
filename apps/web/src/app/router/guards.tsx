import { ShieldX } from 'lucide-react';
import { Navigate, Outlet, useLocation } from 'react-router';
import type { ReactNode } from 'react';

import { useAuth } from '@/app/providers/useAuth';
import { EmptyState, ErrorState, PageLoading } from '@/components/feedback/states';
import { useAccess } from '@/hooks/useAccess';
import { Button } from '@/components/ui/Button';
import type { Permission } from '@/lib/permissions';

function FullPage({ children }: { children: ReactNode }) {
  return <div className="flex min-h-dvh items-center justify-center bg-background p-6">{children}</div>;
}

/** Keeps signed-out visitors out of the application and remembers where they were going. */
export function ProtectedRoute() {
  const { status, retry } = useAuth();
  const location = useLocation();

  if (status === 'loading') {
    return (
      <FullPage>
        <PageLoading label="Loading Yegna" />
      </FullPage>
    );
  }

  if (status === 'error') {
    return (
      <FullPage>
        <ErrorState
          error={new Error('unavailable')}
          title="We couldn't reach Yegna"
          onRetry={retry}
          className="w-full max-w-md"
        />
      </FullPage>
    );
  }

  if (status === 'unauthenticated') {
    return <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />;
  }

  return <Outlet />;
}

/** Login and registration are not shown to people who are already signed in. */
export function PublicOnlyRoute() {
  const { status } = useAuth();
  const location = useLocation();

  if (status === 'loading') {
    return (
      <FullPage>
        <PageLoading label="Loading Yegna" />
      </FullPage>
    );
  }

  if (status === 'authenticated') {
    const from = (location.state as { from?: string } | null)?.from;

    return <Navigate to={from && from !== '/login' ? from : '/dashboard'} replace />;
  }

  return <Outlet />;
}

export function PermissionDenied() {
  return (
    <EmptyState
      icon={<ShieldX className="h-6 w-6" aria-hidden />}
      title="Permission denied"
      description="You don't have permission to view this page."
      action={
        <Button variant="secondary" onClick={() => window.history.back()}>
          Go back
        </Button>
      }
    />
  );
}

/** Route-level guard driven by backend permission strings (hidden UI is a convenience, not security). */
export function RequirePermission({ permission }: { permission: Permission }) {
  const access = useAccess();

  if (access.isLoading) {
    return <PageLoading />;
  }

  if (access.isError) {
    return <ErrorState error={access.error} onRetry={() => void access.refetch()} />;
  }

  if (!access.hasAny(permission)) {
    return <PermissionDenied />;
  }

  return <Outlet />;
}
