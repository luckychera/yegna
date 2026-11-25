import { LogOut, ShieldCheck } from 'lucide-react';
import { NavLink } from 'react-router';

import { BrandLogo } from '@/components/brand/BrandLogo';
import { Avatar } from '@/components/ui/Avatar';
import { useAuth } from '@/app/providers/useAuth';
import { fullName } from '@/lib/formatting/text';
import { cn } from '@/lib/utils/cn';
import { useNavItems } from './useNavItems';

interface SidebarNavProps {
  onNavigate?: () => void;
}

/** Sidebar content, shared by the desktop sidebar and the mobile drawer. */
export function SidebarNav({ onNavigate }: SidebarNavProps) {
  const items = useNavItems();
  const { profile, logout } = useAuth();

  const name = fullName({
    displayName: profile?.profile?.displayName,
    firstName: profile?.profile?.firstName,
    lastName: profile?.profile?.lastName,
  });
  const verified = profile?.identity?.verificationStatus === 'verified';

  return (
    <div className="flex h-full flex-col bg-sidebar text-white">
      <div className="px-6 pt-6 pb-4">
        <BrandLogo tone="light" size="md" />
      </div>

      <nav aria-label="Main" className="flex-1 space-y-1 overflow-y-auto px-3 py-2">
        {items.map(({ to, label, icon: Icon, badgeCount }) => (
          <NavLink
            key={to}
            to={to}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-xl px-3 py-2.5 text-body font-medium transition-colors',
                isActive ? 'bg-white text-sidebar' : 'text-white/75 hover:bg-white/10 hover:text-white',
              )
            }
          >
            <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden />
            <span className="flex-1">{label}</span>
            {badgeCount > 0 ? (
              <span className="min-w-5 rounded-full bg-danger px-1.5 py-0.5 text-center text-small font-semibold text-white">
                <span aria-hidden>{badgeCount > 99 ? '99+' : badgeCount}</span>
                <span className="sr-only">{badgeCount} new</span>
              </span>
            ) : null}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-white/10 p-4">
        <div className="flex items-center gap-3">
          <Avatar name={name} src={profile?.profile?.avatarUrl} size="md" className="bg-white/15 text-white" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-body font-medium text-white">{name}</p>
            <p className="flex items-center gap-1 truncate text-small text-white/60">
              {verified ? (
                <>
                  <ShieldCheck className="h-3 w-3" aria-hidden /> Fayda verified
                </>
              ) : (
                'Fayda not verified'
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void logout()}
            aria-label="Sign out"
            title="Sign out"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-white/70 hover:bg-white/10 hover:text-white"
          >
            <LogOut className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </div>
    </div>
  );
}
