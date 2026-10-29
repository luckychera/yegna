import { useState } from 'react';

import { initialsOf } from '@/lib/formatting/text';
import { cn } from '@/lib/utils/cn';

interface AvatarProps {
  /** Used only to derive initials. Avatars are decorative: the name is always shown as text beside them. */
  name: string;
  src?: string | null;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  shape?: 'circle' | 'rounded';
  className?: string;
}

const SIZES = {
  sm: 'h-8 w-8 text-small',
  md: 'h-10 w-10 text-label',
  lg: 'h-14 w-14 text-h3',
  xl: 'h-20 w-20 text-h2',
} as const;

export function Avatar({ name, src, size = 'md', shape = 'circle', className }: AvatarProps) {
  const [failed, setFailed] = useState(false);
  const showImage = Boolean(src) && !failed;

  return (
    <span
      aria-hidden
      className={cn(
        'inline-flex shrink-0 items-center justify-center overflow-hidden bg-primary-soft font-semibold text-primary',
        shape === 'circle' ? 'rounded-full' : 'rounded-xl',
        SIZES[size],
        className,
      )}
    >
      {showImage ? (
        <img src={src ?? undefined} alt="" className="h-full w-full object-cover" onError={() => setFailed(true)} />
      ) : (
        <span>{initialsOf(name)}</span>
      )}
    </span>
  );
}
