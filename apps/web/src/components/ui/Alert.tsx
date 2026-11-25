import { AlertCircle, CheckCircle2, Info, TriangleAlert } from 'lucide-react';
import type { ReactNode } from 'react';

import { cn } from '@/lib/utils/cn';

const STYLES = {
  info: { box: 'bg-info-soft text-info-ink', Icon: Info },
  success: { box: 'bg-success-soft text-success-ink', Icon: CheckCircle2 },
  warning: { box: 'bg-warning-soft text-warning-ink', Icon: TriangleAlert },
  danger: { box: 'bg-danger-soft text-danger-ink', Icon: AlertCircle },
} as const;

interface AlertProps {
  tone?: keyof typeof STYLES;
  title?: string;
  children: ReactNode;
  className?: string;
}

export function Alert({ tone = 'info', title, children, className }: AlertProps) {
  const { box, Icon } = STYLES[tone];

  return (
    <div role={tone === 'danger' ? 'alert' : 'status'} className={cn('flex gap-3 rounded-xl p-3.5 text-body', box, className)}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <div className="min-w-0 space-y-0.5">
        {title ? <p className="font-semibold">{title}</p> : null}
        <div>{children}</div>
      </div>
    </div>
  );
}
