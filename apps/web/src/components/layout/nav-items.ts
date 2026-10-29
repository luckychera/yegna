import {
  Bell,
  ChartColumn,
  CreditCard,
  HandCoins,
  LayoutDashboard,
  Mail,
  UserCheck,
  User,
  Users,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Items that only appear when the backend grants the matching permission somewhere. */
  gate?: 'reports';
  badge?: 'notifications' | 'invitations';
  /** Shown in the mobile bottom bar (the rest live under "More"). */
  primaryOnMobile?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, primaryOnMobile: true },
  { to: '/communities', label: 'Communities', icon: Users, primaryOnMobile: true },
  { to: '/memberships', label: 'My Membership', icon: UserCheck },
  { to: '/invitations', label: 'Invitations', icon: Mail, badge: 'invitations' },
  { to: '/contributions', label: 'Contributions', icon: HandCoins, primaryOnMobile: true },
  { to: '/payments', label: 'Payments', icon: CreditCard, primaryOnMobile: true },
  { to: '/notifications', label: 'Notifications', icon: Bell, badge: 'notifications' },
  { to: '/reports', label: 'Reports', icon: ChartColumn, gate: 'reports' },
  { to: '/profile', label: 'Profile', icon: User },
];
