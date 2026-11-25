import type { LucideIcon } from 'lucide-react';

import { Card } from '@/components/ui/Card';
import { Skeleton } from '@/components/feedback/states';
import { cn } from '@/lib/utils/cn';

const ICON_TONES = {
  primary: 'bg-primary-soft text-primary',
  info: 'bg-info-soft text-info-ink',
  warning: 'bg-warning-soft text-warning-ink',
  danger: 'bg-danger-soft text-danger-ink',
  success: 'bg-success-soft text-success-ink',
} as const;

interface StatCardProps {
  label: string;
  value: string;
  icon: LucideIcon;
  tone?: keyof typeof ICON_TONES;
  hint?: string;
  loading?: boolean;
}

export function StatCard({
  label,
  value,
  icon: Icon,
  tone = 'primary',
  hint,
  loading = false,
}: StatCardProps) {
  return (
    <Card className="group relative isolate flex items-center gap-4 overflow-hidden p-4 transition-all duration-300 hover:-translate-y-1 hover:border-primary/20 hover:shadow-pop motion-reduce:transform-none motion-reduce:transition-none sm:p-5">
      <span
        aria-hidden
        className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-primary/5 blur-2xl transition-colors duration-500 group-hover:bg-primary/10"
      />

      <span
        className={cn(
          'relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl transition-transform duration-300 group-hover:scale-105',
          'motion-reduce:transform-none motion-reduce:transition-none',
          ICON_TONES[tone],
        )}
      >
        <Icon className="h-5 w-5" aria-hidden />
      </span>

      <div className="relative min-w-0 flex-1">
        <p className="text-small font-medium text-ink-secondary">{label}</p>

        {loading ? (
          <Skeleton className="mt-2 h-7 w-24" />
        ) : (
          <p className="mt-1 truncate text-h3 font-bold tracking-tight text-ink tabular-nums">
            {value}
          </p>
        )}

        {hint && !loading ? (
          <p className="mt-1 truncate text-small text-ink-muted">{hint}</p>
        ) : null}
      </div>
    </Card>
  );
}
