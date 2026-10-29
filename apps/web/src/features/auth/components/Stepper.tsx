import { Check } from 'lucide-react';

import { cn } from '@/lib/utils/cn';

export function Stepper({ steps, current }: { steps: string[]; current: number }) {
  return (
    <ol className="flex items-center" aria-label="Registration progress">
      {steps.map((label, index) => {
        const done = index < current;
        const active = index === current;

        return (
          <li
            key={label}
            aria-current={active ? 'step' : undefined}
            className={cn('flex items-center', index < steps.length - 1 && 'flex-1')}
          >
            <div className="flex flex-col items-center gap-1">
              <span
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-full text-label font-semibold',
                  done || active ? 'bg-primary text-white' : 'bg-surface-soft text-ink-secondary',
                )}
              >
                {done ? <Check className="h-4 w-4" aria-hidden /> : index + 1}
              </span>
              <span className={cn('text-small', active ? 'font-medium text-ink' : 'text-ink-secondary')}>{label}</span>
            </div>
            {index < steps.length - 1 ? (
              <span aria-hidden className={cn('mx-2 mb-5 h-0.5 flex-1', done ? 'bg-primary' : 'bg-line')} />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
