import { Link } from 'react-router';

import { cn } from '@/lib/utils/cn';
import { ACCOUNT_SECTIONS, accountSectionPath, type AccountSectionId } from '../account-sections';

export function AccountNav({ section }: { section: AccountSectionId }) {
  return (
    <nav aria-label="Account sections" className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
      {ACCOUNT_SECTIONS.map((item) => {
        const Icon = item.icon;
        const current = item.id === section;

        return (
          <Link
            key={item.id}
            to={accountSectionPath(item.id)}
            aria-current={current ? 'page' : undefined}
            className={cn(
              'flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-body font-medium whitespace-nowrap transition-colors',
              current ? 'bg-primary-soft text-primary' : 'text-ink-secondary hover:bg-surface-soft hover:text-ink',
            )}
          >
            <Icon className="h-4 w-4" aria-hidden />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
