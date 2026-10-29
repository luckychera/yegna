import { cva, type VariantProps } from 'class-variance-authority';

export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-xl font-medium whitespace-nowrap transition-colors duration-150 select-none disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
  {
    variants: {
      variant: {
        primary: 'bg-primary text-white hover:bg-primary-dark active:bg-primary-dark',
        secondary: 'border border-line bg-surface text-ink hover:bg-surface-soft active:bg-line',
        danger: 'bg-danger text-white hover:bg-danger-ink active:bg-danger-ink',
        ghost: 'text-ink-secondary hover:bg-surface-soft hover:text-ink active:bg-line',
        outline: 'border border-primary bg-transparent text-primary hover:bg-primary-soft',
      },
      size: {
        sm: 'h-8 px-3 text-label',
        md: 'h-10 px-4 text-body',
        lg: 'h-12 px-6 text-body',
        icon: 'h-10 w-10',
      },
      fullWidth: { true: 'w-full', false: '' },
    },
    defaultVariants: { variant: 'primary', size: 'md', fullWidth: false },
  },
);

export type ButtonVariantProps = VariantProps<typeof buttonVariants>;
