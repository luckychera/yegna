import { CircleAlert, Inbox, ShieldX, WifiOff } from 'lucide-react';
import type { ReactNode } from 'react';

import { getErrorMessage, isApiError } from '@/lib/api/errors';
import { cn } from '@/lib/utils/cn';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn('animate-pulse rounded-lg bg-line/70', className)} />;
}

export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div role="status" aria-label="Loading" className="space-y-3">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="flex items-center gap-3 rounded-card border border-line bg-surface p-4">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-1/3" />
            <Skeleton className="h-3 w-2/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function CardGridSkeleton({ cards = 4 }: { cards?: number }) {
  return (
    <div role="status" aria-label="Loading" className="grid gap-4 sm:grid-cols-2">
      {Array.from({ length: cards }, (_, index) => (
        <div key={index} className="space-y-3 rounded-card border border-line bg-surface p-5">
          <div className="flex items-center gap-3">
            <Skeleton className="h-12 w-12 rounded-xl" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-3 w-1/3" />
            </div>
          </div>
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-4/5" />
        </div>
      ))}
    </div>
  );
}

export function PageLoading({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="flex min-h-[40dvh] items-center justify-center text-ink-secondary">
      <Spinner className="mr-2 h-5 w-5" label={label} />
      <span aria-hidden>{label}…</span>
    </div>
  );
}

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ title, description, icon, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center rounded-card border border-dashed border-line bg-surface px-6 py-12 text-center', className)}>
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary-soft text-primary">
        {icon ?? <Inbox className="h-6 w-6" aria-hidden />}
      </div>
      <h3 className="text-h3 font-semibold text-ink">{title}</h3>
      {description ? <p className="mt-1 max-w-sm text-body text-ink-secondary">{description}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

interface ErrorStateProps {
  error: unknown;
  onRetry?: () => void;
  title?: string;
  className?: string;
}

/** One consistent failure screen: distinguishes permission, missing, offline and generic errors. */
export function ErrorState({ error, onRetry, title, className }: ErrorStateProps) {
  const status = isApiError(error) ? error.status : null;
  const offline = isApiError(error) && error.status === 0;
  const denied = status === 403;
  const Icon = denied ? ShieldX : offline ? WifiOff : CircleAlert;

  const heading =
    title ??
    (denied ? 'Permission denied' : status === 404 ? 'Not found' : offline ? 'Connection problem' : 'Something went wrong');

  return (
    <div
      role="alert"
      className={cn('flex flex-col items-center rounded-card border border-line bg-surface px-6 py-12 text-center', className)}
    >
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-danger-soft text-danger-ink">
        <Icon className="h-6 w-6" aria-hidden />
      </div>
      <h3 className="text-h3 font-semibold text-ink">{heading}</h3>
      <p className="mt-1 max-w-sm text-body text-ink-secondary">{getErrorMessage(error)}</p>
      {onRetry && !denied ? (
        <Button variant="secondary" className="mt-5" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </div>
  );
}
