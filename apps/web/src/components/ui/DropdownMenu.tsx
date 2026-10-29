import { DropdownMenu as RadixMenu } from 'radix-ui';
import type { ComponentProps, ReactNode } from 'react';

import { cn } from '@/lib/utils/cn';

export const DropdownMenu = RadixMenu.Root;
export const DropdownMenuTrigger = RadixMenu.Trigger;

export function DropdownMenuContent({ className, children, ...props }: ComponentProps<typeof RadixMenu.Content>) {
  return (
    <RadixMenu.Portal>
      <RadixMenu.Content
        align="end"
        sideOffset={6}
        className={cn(
          'z-50 min-w-48 rounded-xl border border-line bg-surface p-1.5 shadow-pop data-[state=open]:animate-enter',
          className,
        )}
        {...props}
      >
        {children}
      </RadixMenu.Content>
    </RadixMenu.Portal>
  );
}

interface ItemProps extends Omit<ComponentProps<typeof RadixMenu.Item>, 'children'> {
  icon?: ReactNode;
  tone?: 'default' | 'danger';
  children: ReactNode;
}

export function DropdownMenuItem({ icon, tone = 'default', className, children, ...props }: ItemProps) {
  return (
    <RadixMenu.Item
      className={cn(
        'flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-body outline-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[highlighted]:bg-surface-soft',
        tone === 'danger' ? 'text-danger-ink' : 'text-ink',
        className,
      )}
      {...props}
    >
      {icon}
      {children}
    </RadixMenu.Item>
  );
}

export function DropdownMenuLabel({ className, ...props }: ComponentProps<typeof RadixMenu.Label>) {
  return <RadixMenu.Label className={cn('px-3 py-1.5 text-small text-ink-secondary', className)} {...props} />;
}

export function DropdownMenuSeparator({ className, ...props }: ComponentProps<typeof RadixMenu.Separator>) {
  return <RadixMenu.Separator className={cn('my-1 h-px bg-line', className)} {...props} />;
}
