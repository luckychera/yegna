import { Loader2 } from 'lucide-react';

import { cn } from '@/lib/utils/cn';

export function Spinner({ className, label }: { className?: string; label?: string }) {
  return (
    <Loader2
      className={cn('h-4 w-4 animate-spin', className)}
      role={label ? 'status' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    />
  );
}
