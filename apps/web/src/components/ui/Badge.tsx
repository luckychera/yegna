import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

import { cn } from '@/lib/utils/cn';

export type Tone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

const TONES: Record<Tone, string> = {
  success: 'bg-success-soft text-success-ink',
  warning: 'bg-warning-soft text-warning-ink',
  danger: 'bg-danger-soft text-danger-ink',
  info: 'bg-info-soft text-info-ink',
  neutral: 'bg-surface-soft text-ink-secondary',
};

interface BadgeProps {
  tone?: Tone;
  icon?: LucideIcon;
  children: ReactNode;
  className?: string;
}

/** Status is always conveyed by text (and an icon), never by color alone. */
export function Badge({ tone = 'neutral', icon: Icon, children, className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-small font-medium whitespace-nowrap',
        TONES[tone],
        className,
      )}
    >
      {Icon ? <Icon className="h-3 w-3" aria-hidden /> : null}
      {children}
    </span>
  );
}
