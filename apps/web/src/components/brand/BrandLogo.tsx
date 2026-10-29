import { cn } from '@/lib/utils/cn';

interface BrandLogoProps {
  tone?: 'dark' | 'light';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZES = {
  sm: 'h-7 w-auto',
  md: 'h-9 w-auto',
  lg: 'h-12 w-auto',
} as const;

export function BrandLogo({ tone = 'dark', size = 'md', className }: BrandLogoProps) {
  return (
    <img
      src="/logo.png"
      alt="Yegna"
      className={cn(
        'inline-block object-contain object-left',
        SIZES[size],
        tone === 'light' && 'brightness-0 invert',
        className,
      )}
    />
  );
}
