import type { ComponentProps } from 'react';

import { cn } from '@/lib/utils/cn';
import { buttonVariants, type ButtonVariantProps } from './button-variants';
import { Spinner } from './Spinner';

interface ButtonProps extends ComponentProps<'button'>, ButtonVariantProps {
  loading?: boolean;
}

export function Button({
  variant,
  size,
  fullWidth,
  loading = false,
  disabled,
  className,
  children,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(buttonVariants({ variant, size, fullWidth }), className)}
      {...props}
    >
      {loading ? <Spinner /> : null}
      {children}
    </button>
  );
}

interface IconButtonProps extends Omit<ComponentProps<'button'>, 'aria-label'>, ButtonVariantProps {
  /** Required: icon-only buttons need an accessible name. */
  label: string;
}

export function IconButton({ label, variant = 'ghost', size = 'icon', className, children, type = 'button', ...props }: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    >
      {children}
    </button>
  );
}
