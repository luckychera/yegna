import type { UserProfile } from '@/features/auth/auth.types';
import type { CommunityListItem, MyCommunity } from '@/features/communities/community.types';
import type { MyContribution } from '@/features/contributions/contribution.types';
import type { MyPayment } from '@/features/payments/payment.types';

export function profileFixture(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    user: {
      id: 'user-1',
      email: 'abebe@example.com',
      phone: '+251911234567',
      status: 'active',
      emailVerifiedAt: null,
      phoneVerifiedAt: null,
      lastLoginAt: null,
      createdAt: '2026-01-15T08:00:00.000Z',
    },
    profile: {
      firstName: 'Abebe',
      middleName: null,
      lastName: 'Kebede',
      displayName: null,
      fullName: 'Abebe Kebede',
      avatarUrl: null,
      preferredLanguage: 'en',
      timezone: 'Africa/Addis_Ababa',
    },
    identity: { provider: 'fayda', verificationStatus: 'verified', verifiedAt: '2026-01-15T08:05:00.000Z' },
    ...overrides,
  };
}

export function communityFixture(overrides: Partial<CommunityListItem> = {}): CommunityListItem {
  return {
    id: 'community-1',
    name: 'Bole Community',
    description: 'A savings and support community.',
    communityType: 'equb',
    status: 'active',
    logoUrl: null,
    memberCount: 48,
    createdAt: '2026-01-01T00:00:00.000Z',
    myMembership: null,
    ...overrides,
  };
}

export function myCommunityFixture(permissions: string[] = [], overrides: Partial<MyCommunity> = {}): MyCommunity {
  const { myMembership: _ignored, ...community } = communityFixture();

  void _ignored;

  return {
    community,
    membership: { id: 'membership-1', status: 'active', membershipNumber: null, joinedAt: '2026-01-02T00:00:00.000Z' },
    roles: [],
    permissions,
    ...overrides,
  };
}

export function contributionFixture(overrides: Partial<MyContribution> = {}): MyContribution {
  return {
    id: 'contribution-1',
    communityId: 'community-1',
    membershipId: 'membership-1',
    community: { id: 'community-1', name: 'Bole Community', logoUrl: null },
    periodStart: '2026-11-01T00:00:00.000Z',
    periodEnd: '2026-11-30T00:00:00.000Z',
    dueDate: '2099-11-30T00:00:00.000Z',
    amount: '1000.00',
    currency: 'ETB',
    status: 'pending',
    isOverdue: false,
    paidAmount: '0.00',
    waivedAmount: '0.00',
    penaltyAmount: '0.00',
    outstandingAmount: '1000.00',
    notes: null,
    createdAt: '2026-10-01T00:00:00.000Z',
    ...overrides,
  };
}

export function paymentFixture(overrides: Partial<MyPayment> = {}): MyPayment {
  return {
    id: 'payment-1',
    communityId: 'community-1',
    contributionId: 'contribution-1',
    community: { id: 'community-1', name: 'Bole Community', logoUrl: null },
    contribution: { id: 'contribution-1', dueDate: '2026-11-30T00:00:00.000Z', periodStart: '2026-11-01T00:00:00.000Z', periodEnd: '2026-11-30T00:00:00.000Z' },
    provider: 'chapa',
    providerReference: 'CH-12345678',
    amount: '1000.00',
    currency: 'ETB',
    status: 'successful',
    paymentMethod: 'telebirr',
    checkoutUrl: null,
    initiatedAt: '2026-11-01T10:00:00.000Z',
    completedAt: '2026-11-01T10:02:00.000Z',
    failedAt: null,
    createdAt: '2026-11-01T10:00:00.000Z',
    ...overrides,
  };
}

export function memberRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'membership-x',
    community_id: 'community-1',
    user_id: 'user-x',
    status: 'active',
    membership_number: null,
    joined_at: '2026-02-01T00:00:00.000Z',
    created_at: '2026-02-01T00:00:00.000Z',
    email: 'member@example.com',
    phone: null,
    first_name: 'Selam',
    last_name: 'Tadesse',
    display_name: null,
    ...overrides,
  };
}

export function notificationRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'n1',
    community_id: null,
    type: 'payment_successful',
    title: 'Payment successful',
    message: 'We received your payment.',
    priority: 'normal',
    entity_type: null,
    entity_id: null,
    read_at: null,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

export function invitationFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: 'inv-1',
    status: 'pending',
    expiresAt: '2099-01-01T00:00:00.000Z',
    acceptedAt: null,
    rejectedAt: null,
    createdAt: new Date().toISOString(),
    community: { id: 'community-1', name: 'Bole Community', logoUrl: null },
    inviter: { name: 'Eyob Tesfaye' },
    ...overrides,
  };
}

/** Every permission string the backend can grant to an administrator. */
export const ADMIN_PERMISSIONS = [
  'community.view',
  'community.update',
  'members.view',
  'members.invite',
  'members.update',
  'members.remove',
  'contributions.view',
  'contributions.create',
  'contributions.update',
  'payments.view',
  'reports.view',
];
