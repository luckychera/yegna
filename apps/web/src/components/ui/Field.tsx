import { Eye, EyeOff, Search, X } from 'lucide-react';
import { useId, useState, type ComponentProps, type ReactNode } from 'react';

import { cn } from '@/lib/utils/cn';

const controlClass =
  'block w-full rounded-xl border bg-surface px-3 text-body text-ink placeholder:text-ink-muted transition-colors focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-primary disabled:cursor-not-allowed disabled:bg-surface-soft disabled:text-ink-muted';

interface FieldShellProps {
  label: string;
  error?: string;
  hint?: string;
  optional?: boolean;
  children: (ids: { id: string; describedBy: string | undefined; invalid: boolean }) => ReactNode;
  className?: string;
}

/** Label + control + hint/error wiring so every form field is accessible by default. */
export function FieldShell({ label, error, hint, optional, children, className }: FieldShellProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ') || undefined;

  return (
    <div className={cn('space-y-1.5', className)}>
      <label htmlFor={id} className="block text-label font-medium text-ink">
        {label}
        {optional ? <span className="ml-1 font-normal text-ink-muted">(optional)</span> : null}
      </label>
      {children({ id, describedBy, invalid: Boolean(error) })}
      {hint && !error ? (
        <p id={hintId} className="text-small text-ink-secondary">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} role="alert" className="text-small text-danger-ink">
          {error}
        </p>
      ) : null}
    </div>
  );
}

interface TextFieldProps extends Omit<ComponentProps<'input'>, 'id'> {
  label: string;
  error?: string;
  hint?: string;
  optional?: boolean;
  containerClassName?: string;
}

export function TextField({ label, error, hint, optional, containerClassName, className, ...props }: TextFieldProps) {
  return (
    <FieldShell label={label} error={error} hint={hint} optional={optional} className={containerClassName}>
      {({ id, describedBy, invalid }) => (
        <input
          id={id}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          className={cn(controlClass, 'h-11', invalid ? 'border-danger' : 'border-line', className)}
          {...props}
        />
      )}
    </FieldShell>
  );
}

export function PasswordField({ label, error, hint, containerClassName, className, ...props }: Omit<TextFieldProps, 'type'>) {
  const [visible, setVisible] = useState(false);

  return (
    <FieldShell label={label} error={error} hint={hint} className={containerClassName}>
      {({ id, describedBy, invalid }) => (
        <div className="relative">
          <input
            id={id}
            type={visible ? 'text' : 'password'}
            aria-invalid={invalid || undefined}
            aria-describedby={describedBy}
            className={cn(controlClass, 'h-11 pr-11', invalid ? 'border-danger' : 'border-line', className)}
            {...props}
          />
          <button
            type="button"
            onClick={() => setVisible((value) => !value)}
            aria-label={visible ? 'Hide password' : 'Show password'}
            aria-pressed={visible}
            className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-xl text-ink-secondary hover:text-ink"
          >
            {visible ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
          </button>
        </div>
      )}
    </FieldShell>
  );
}

interface TextAreaFieldProps extends Omit<ComponentProps<'textarea'>, 'id'> {
  label: string;
  error?: string;
  hint?: string;
  optional?: boolean;
}

export function TextAreaField({ label, error, hint, optional, className, ...props }: TextAreaFieldProps) {
  return (
    <FieldShell label={label} error={error} hint={hint} optional={optional}>
      {({ id, describedBy, invalid }) => (
        <textarea
          id={id}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          className={cn(controlClass, 'min-h-24 py-2.5', invalid ? 'border-danger' : 'border-line', className)}
          {...props}
        />
      )}
    </FieldShell>
  );
}

interface SelectFieldProps extends Omit<ComponentProps<'select'>, 'id'> {
  label: string;
  error?: string;
  hint?: string;
  containerClassName?: string;
}

export function SelectField({ label, error, hint, containerClassName, className, children, ...props }: SelectFieldProps) {
  return (
    <FieldShell label={label} error={error} hint={hint} className={containerClassName}>
      {({ id, describedBy, invalid }) => (
        <select
          id={id}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          className={cn(controlClass, 'h-11', invalid ? 'border-danger' : 'border-line', className)}
          {...props}
        >
          {children}
        </select>
      )}
    </FieldShell>
  );
}

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label: string;
  className?: string;
}

export function SearchInput({ value, onChange, placeholder = 'Search…', label, className }: SearchInputProps) {
  return (
    <div className={cn('relative', className)} role="search">
      <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-ink-muted" aria-hidden />
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={label}
        className={cn(controlClass, 'h-10 border-line pr-9 pl-9 [&::-webkit-search-cancel-button]:hidden')}
      />
      {value ? (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="Clear search"
          className="absolute top-1/2 right-2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-ink-secondary hover:bg-surface-soft"
        >
          <X className="h-3.5 w-3.5" aria-hidden />
        </button>
      ) : null}
    </div>
  );
}

/** Compact select used in filter bars (label is visually hidden but still announced). */
export function FilterSelect({ label, className, children, ...props }: Omit<ComponentProps<'select'>, 'id'> & { label: string }) {
  const id = useId();

  return (
    <div className={className}>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <select id={id} className={cn(controlClass, 'h-10 border-line')} {...props}>
        {children}
      </select>
    </div>
  );
}
