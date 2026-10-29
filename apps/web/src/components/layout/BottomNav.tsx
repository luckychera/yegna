import { Ellipsis } from 'lucide-react';
import { NavLink } from 'react-router';

import { cn } from '@/lib/utils/cn';
import { useNavItems } from './useNavItems';

/** Phone navigation: the four core destinations plus "More" for everything else. */
export function BottomNav({ onOpenMore }: { onOpenMore: () => void }) {
  const items = useNavItems().filter((item) => item.primaryOnMobile);

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      <ul className="mx-auto flex max-w-xl items-stretch justify-around">
        {items.map(({ to, label, icon: Icon, badgeCount }) => (
          <li key={to} className="flex-1">
            <NavLink
              to={to}
              className={({ isActive }) =>
                cn(
                  'relative flex flex-col items-center gap-0.5 px-1 py-2 text-small font-medium',
                  isActive ? 'text-primary' : 'text-ink-secondary',
                )
              }
            >
              <Icon className="h-5 w-5" aria-hidden />
              {label}
              {badgeCount > 0 ? <span className="sr-only">{badgeCount} new</span> : null}
            </NavLink>
          </li>
        ))}
        <li className="flex-1">
          <button
            type="button"
            onClick={onOpenMore}
            className="flex w-full flex-col items-center gap-0.5 px-1 py-2 text-small font-medium text-ink-secondary"
          >
            <Ellipsis className="h-5 w-5" aria-hidden />
            More
          </button>
        </li>
      </ul>
    </nav>
  );
}
