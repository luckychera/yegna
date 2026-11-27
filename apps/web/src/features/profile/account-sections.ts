import { Bell, CreditCard, IdCard, Shield, User, UserRound, Users, type LucideIcon } from 'lucide-react';

export const ACCOUNT_SECTIONS = [
  { id: 'overview', label: 'Overview', icon: UserRound },
  { id: 'personal', label: 'Personal information', icon: User },
  { id: 'identity', label: 'Identity verification', icon: IdCard },
  { id: 'memberships', label: 'Memberships', icon: Users },
  { id: 'cards', label: 'Membership cards', icon: CreditCard },
  { id: 'security', label: 'Security', icon: Shield },
  { id: 'notifications', label: 'Notifications', icon: Bell },
] as const satisfies readonly { id: string; label: string; icon: LucideIcon }[];

export type AccountSectionId = (typeof ACCOUNT_SECTIONS)[number]['id'];

export function accountSection(value: string | null): AccountSectionId {
  return ACCOUNT_SECTIONS.some((section) => section.id === value) ? (value as AccountSectionId) : 'overview';
}

export function accountSectionPath(id: AccountSectionId): string {
  return id === 'overview' ? '/profile' : `/profile?section=${id}`;
}
