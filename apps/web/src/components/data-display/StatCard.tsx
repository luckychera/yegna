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

export function StatCard({ label, value, icon: Icon, tone = 'primary', hint, loading = false }: StatCardProps) {
  return (
    <Card className="flex items-center gap-4 p-4 sm:p-5">
      <span className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl', ICON_TONES[tone])}>
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="text-small text-ink-secondary">{label}</p>
        {loading ? (
          <Skeleton className="mt-1 h-6 w-20" />
        ) : (
          <p className="truncate text-h3 font-bold text-ink">{value}</p>
        )}
        {hint && !loading ? <p className="truncate text-small text-ink-muted">{hint}</p> : null}
      </div>
    </Card>
  );
}
