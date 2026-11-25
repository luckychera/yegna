import { ChevronLeft, ChevronRight } from 'lucide-react';

import { Button } from './Button';

interface PaginationProps {
  limit: number;
  offset: number;
  total: number;
  onChange: (offset: number) => void;
}

export function Pagination({ limit, offset, total, onChange }: PaginationProps) {
  if (total <= limit) {
    return null;
  }

  const from = offset + 1;
  const to = Math.min(offset + limit, total);

  return (
    <nav aria-label="Pagination" className="flex items-center justify-between gap-3 pt-4">
      <p className="text-small text-ink-secondary">
        Showing {from}–{to} of {total}
      </p>
      <div className="flex gap-2">
        <Button variant="secondary" size="sm" disabled={offset === 0} onClick={() => onChange(Math.max(0, offset - limit))}>
          <ChevronLeft className="h-4 w-4" aria-hidden />
          Previous
        </Button>
        <Button variant="secondary" size="sm" disabled={offset + limit >= total} onClick={() => onChange(offset + limit)}>
          Next
          <ChevronRight className="h-4 w-4" aria-hidden />
        </Button>
      </div>
    </nav>
  );
}
