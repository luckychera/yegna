import { Bell, LogOut, Menu, Settings, User } from 'lucide-react';
import { Link, useNavigate } from 'react-router';
import { toast } from 'sonner';

import { useAuth } from '@/app/providers/useAuth';
import { Avatar } from '@/components/ui/Avatar';
import { IconButton } from '@/components/ui/Button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { useUnreadCount } from '@/features/notifications/notification.hooks';
import { fullName } from '@/lib/formatting/text';

export function TopBar({ onOpenMenu }: { onOpenMenu: () => void }) {
  const { profile, logout } = useAuth();
  const navigate = useNavigate();
  const unread = useUnreadCount().data ?? 0;

  const name = fullName({
    displayName: profile?.profile?.displayName,
    firstName: profile?.profile?.firstName,
    lastName: profile?.profile?.lastName,
  });

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-line bg-surface/95 px-4 backdrop-blur sm:px-6 lg:px-8">
      <IconButton label="Open menu" onClick={onOpenMenu} className="lg:hidden">
        <Menu className="h-5 w-5" aria-hidden />
      </IconButton>
      <Link to="/dashboard" className="lg:hidden" aria-label="Yegna home">
        <BrandLogo size="md" />
      </Link>

      <div className="ml-auto flex items-center gap-1">
        <Link
          to="/notifications"
          aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
          className="relative flex h-10 w-10 items-center justify-center rounded-xl text-ink-secondary hover:bg-surface-soft hover:text-ink"
        >
          <Bell className="h-5 w-5" aria-hidden />
          {unread > 0 ? (
            <span
              aria-hidden
              className="absolute top-1.5 right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-semibold text-white"
            >
              {unread > 9 ? '9+' : unread}
            </span>
          ) : null}
        </Link>

        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label="Account menu"
            className="flex items-center rounded-full p-0.5 focus-visible:outline-2 focus-visible:outline-primary"
          >
            <Avatar name={name} src={profile?.profile?.avatarUrl} size="md" />
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuLabel>{name}</DropdownMenuLabel>
            <DropdownMenuItem icon={<User className="h-4 w-4" aria-hidden />} onSelect={() => navigate('/profile')}>
              Profile
            </DropdownMenuItem>
            <DropdownMenuItem icon={<Settings className="h-4 w-4" aria-hidden />} onSelect={() => navigate('/settings')}>
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              tone="danger"
              icon={<LogOut className="h-4 w-4" aria-hidden />}
              onSelect={() => {
                void logout().then(() => toast.success('You have been signed out'));
              }}
            >
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
