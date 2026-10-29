import type { ReactNode } from 'react';

import { useMediaQuery } from '@/hooks/useMediaQuery';

import { cn } from '@/lib/utils/cn';

export interface Column<T> {
  key: string;
  header: string;
  cell: (row: T) => ReactNode;
  className?: string;
  /** Column that becomes the card title on mobile (defaults to the first column). */
  primary?: boolean;
  /** Rendered at the bottom of the mobile card instead of as a label/value row. */
  actions?: boolean;
  hideOnMobile?: boolean;
}

interface DataTableProps<T> {
  caption: string;
  columns: Column<T>[];
  rows: T[];
  getRowKey: (row: T) => string;
}

/** A real table from tablet width up; stacked cards on phones so nothing is squeezed or clipped. */
export function DataTable<T>({ caption, columns, rows, getRowKey }: DataTableProps<T>) {
  const isWide = useMediaQuery('(min-width: 768px)');
  const primary = columns.find((column) => column.primary) ?? columns[0];
  const actions = columns.find((column) => column.actions);
  const details = columns.filter((column) => column !== primary && column !== actions && !column.hideOnMobile);

  if (isWide) {
    return (
      <div className="overflow-x-auto rounded-card border border-line bg-surface shadow-card">
        <table className="w-full text-left text-body">
          <caption className="sr-only">{caption}</caption>
          <thead className="bg-surface-soft text-small text-ink-secondary">
            <tr>
              {columns.map((column) => (
                <th key={column.key} scope="col" className={cn('px-4 py-3 font-medium whitespace-nowrap', column.className)}>
                  {column.actions ? <span className="sr-only">{column.header}</span> : column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((row) => (
              <tr key={getRowKey(row)} className="transition-colors hover:bg-surface-soft/60">
                {columns.map((column) => (
                  <td key={column.key} className={cn('px-4 py-3 align-middle', column.className)}>
                    {column.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <ul className="space-y-3" aria-label={caption}>
        {rows.map((row) => (
          <li key={getRowKey(row)} className="space-y-3 rounded-card border border-line bg-surface p-4 shadow-card">
            <div className="font-medium text-ink">{primary.cell(row)}</div>
            <dl className="space-y-1.5">
              {details.map((column) => (
                <div key={column.key} className="flex items-center justify-between gap-3">
                  <dt className="text-small text-ink-secondary">{column.header}</dt>
                  <dd className="text-right text-body text-ink">{column.cell(row)}</dd>
                </div>
              ))}
            </dl>
            {actions ? <div className="flex flex-wrap justify-end gap-2 pt-1">{actions.cell(row)}</div> : null}
          </li>
        ))}
    </ul>
  );
}
