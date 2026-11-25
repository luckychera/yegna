import { X } from 'lucide-react';
import { Dialog as RadixDialog } from 'radix-ui';
import type { ReactNode } from 'react';

import { cn } from '@/lib/utils/cn';
import { Button } from './Button';

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children?: ReactNode;
  footer?: ReactNode;
  className?: string;
}

/** Modal with focus trapping, Escape to close and a required accessible title (Radix). */
export function Dialog({ open, onOpenChange, title, description, children, footer, className }: DialogProps) {
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-50 bg-ink/50 backdrop-blur-[1px] data-[state=open]:animate-enter" />
        <RadixDialog.Content
          className={cn(
            'fixed top-1/2 left-1/2 z-50 max-h-[90dvh] w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-card bg-surface p-6 shadow-pop data-[state=open]:animate-enter',
            className,
          )}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <RadixDialog.Title className="text-h3 font-semibold text-ink">{title}</RadixDialog.Title>
              <RadixDialog.Description className={cn('text-body text-ink-secondary', !description && 'sr-only')}>
                {description ?? title}
              </RadixDialog.Description>
            </div>
            <RadixDialog.Close
              aria-label="Close"
              className="-mt-1 -mr-1 flex h-8 w-8 items-center justify-center rounded-full text-ink-secondary hover:bg-surface-soft"
            >
              <X className="h-4 w-4" aria-hidden />
            </RadixDialog.Close>
          </div>
          {children ? <div className="mt-5">{children}</div> : null}
          {footer ? <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">{footer}</div> : null}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: 'danger' | 'primary';
  loading?: boolean;
  onConfirm: () => void | Promise<void>;
}

/** Confirmation that always explains the consequence (used for every destructive action). */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel = 'Cancel',
  tone = 'primary',
  loading = false,
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!loading) onOpenChange(next);
      }}
      title={title}
      description={description}
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button variant={tone === 'danger' ? 'danger' : 'primary'} loading={loading} onClick={() => void onConfirm()}>
            {confirmLabel}
          </Button>
        </>
      }
    />
  );
}
