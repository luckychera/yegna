/**
 * LIVE CONTRACT TEST: the web app's real API modules against a real backend, no mocks.
 *
 * Prerequisites (see README): a running backend whose CHAPA_BASE_URL points at the fake Chapa
 * server this file starts (default port 5099), FAYDA_MODE=mock, and a database where the three
 * mock Fayda IDs (100000000001-3) have not been registered yet.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { authApi } from '@/features/auth/auth.api';
import { communityApi } from '@/features/communities/community.api';
import { contributionApi } from '@/features/contributions/contribution.api';
import { invitationApi } from '@/features/invitations/invitation.api';
import { membershipApi } from '@/features/memberships/membership.api';
import { notificationApi } from '@/features/notifications/notification.api';
import { paymentApi } from '@/features/payments/payment.api';
import { reportApi } from '@/features/reports/report.api';
import { api } from '@/lib/api/client';
import { ApiError } from '@/lib/api/errors';
import { request } from '@/lib/api/http';
import { refreshSession } from '@/lib/auth/refresh';
import { tokenStore } from '@/lib/auth/token-store';
import { startFakeChapa, type FakeChapa } from './fake-chapa';

const stamp = Date.now().toString(36);
const PASSWORD = 'Secret123';
const FAKE_CHAPA_PORT = Number(process.env.FAKE_CHAPA_PORT ?? 5099);

interface TestUser {
  label: string;
  id: string;
  email: string;
  access: string;
  refresh: string;
}

let chapa: FakeChapa;
let admin: TestUser;
let member: TestUser;
let invitee: TestUser;
let communityId = '';
let membershipId = '';
let contributionId = '';

/** Runs `fn` as `user`, then remembers any rotated tokens. */
async function as<T>(user: TestUser, fn: () => Promise<T>): Promise<T> {
  tokenStore.setTokens(user.access, user.refresh);

  try {
    return await fn();
  } finally {
    user.access = tokenStore.getAccessToken() ?? user.access;
    user.refresh = tokenStore.getRefreshToken() ?? user.refresh;
  }
}

async function register(label: string, type: 'fin' | 'fan', faydaIdentifier: string): Promise<TestUser> {
  const email = `${label}-${stamp}@yegna.test`;
  const payload = await authApi.register({
    faydaIdentifier,
    faydaIdentifierType: type,
    email,
    password: PASSWORD,
    firstName: label.charAt(0).toUpperCase() + label.slice(1),
    lastName: 'Tester',
  });

  return { label, id: payload.user.id, email, access: payload.accessToken, refresh: payload.refreshToken };
}

async function expectApiError(promise: Promise<unknown>, status: number, code?: string) {
  const error = await promise.then(
    () => null,
    (caught: unknown) => caught,
  );

  expect(error).toBeInstanceOf(ApiError);
  expect((error as ApiError).status).toBe(status);

  if (code) expect((error as ApiError).code).toBe(code);
}

function isoDate(offsetDays: number): string {
  return new Date(Date.now() + offsetDays * 86_400_000).toISOString().slice(0, 10);
}

beforeAll(async () => {
  chapa = await startFakeChapa(FAKE_CHAPA_PORT);
});

afterAll(async () => {
  await chapa.close();
});

describe('live contract: accounts and identity', () => {
  it('registers three people through the single-call Fayda contract and signs them in', async () => {
    admin = await register('admin', 'fin', '100000000001');
    member = await register('member', 'fan', '100000000002');
    invitee = await register('invitee', 'fin', '100000000003');

    for (const user of [admin, member, invitee]) {
      expect(user.id).toMatch(/^[0-9a-f-]{36}$/);
      expect(user.access.split('.')).toHaveLength(3);
    }
  });

  it('GET /users/me returns the profile and a verified Fayda status without the ID number', async () => {
    const me = await as(admin, () => authApi.getMe());

    expect(me.user.email).toBe(admin.email);
    expect(me.profile?.firstName).toBe('Admin');
    expect(me.profile?.fullName).toBe('Admin Tester');
    expect(me.identity?.verificationStatus).toBe('verified');
    expect(JSON.stringify(me)).not.toContain('100000000001');
  });

  it('rejects wrong credentials and duplicate registration with the expected codes', async () => {
    await expectApiError(authApi.login({ email: admin.email }, 'Wrong-password-1'), 401, 'INVALID_CREDENTIALS');
    await expectApiError(
      authApi.register({ faydaIdentifier: '100000000001', faydaIdentifierType: 'fin', email: admin.email, password: PASSWORD, firstName: 'Dup', lastName: 'Licate' }),
      409,
    );

    const again = await authApi.login({ email: admin.email }, PASSWORD);

    expect(again.accessToken).toBeTruthy();
  });
});

describe('live contract: communities and memberships', () => {
  it('creates a community; the creator receives backend permissions', async () => {
    const community = await as(admin, () => communityApi.create({ name: `Contract Equb ${stamp}`, communityType: 'equb', description: 'Live contract test' }));

    communityId = community.id;
    expect(community).toMatchObject({ name: `Contract Equb ${stamp}`, communityType: 'equb', status: 'active', description: 'Live contract test' });

    const mine = await as(admin, () => communityApi.listMine({ status: 'active' }));
    const item = mine.items.find((entry) => entry.community.id === communityId)!;

    expect(item.membership.status).toBe('active');
    expect(item.community.memberCount).toBe(1);
    expect(item.roles.map((role) => role.name)).toContain('admin');
    expect(item.permissions).toEqual(expect.arrayContaining(['members.view', 'members.update', 'members.remove', 'contributions.create', 'reports.view']));
  });

  it('shows the community in the public directory with a member count', async () => {
    const result = await as(member, () => communityApi.list({ q: `Contract Equb ${stamp}`, limit: 5 }));

    expect(result.pagination).toMatchObject({ limit: 5, offset: 0, total: 1 });
    expect(result.items[0]).toMatchObject({ id: communityId, memberCount: 1, myMembership: null });
  });

  it('blocks non-members from the community detail endpoint with 403 (never 500)', async () => {
    await as(member, () => expectApiError(api.get(`/communities/${communityId}`), 403, 'COMMUNITY_ACCESS_DENIED'));
  });

  it('lets a member request to join and an administrator approve them', async () => {
    const joined = await as(member, () => communityApi.join(communityId));

    expect(joined.membership.status).toBe('pending');
    expect(joined.message).toMatch(/request/i);

    const pendingForMember = await as(member, () => communityApi.listMine());

    expect(pendingForMember.items.find((entry) => entry.community.id === communityId)?.permissions).toEqual([]);

    const members = await as(admin, () => membershipApi.list(communityId));
    const row = members.find((entry) => entry.userId === member.id)!;

    expect(row).toMatchObject({ status: 'pending', name: 'Member Tester', email: member.email });
    membershipId = row.id;

    await as(admin, () => membershipApi.act(communityId, membershipId, 'approve'));

    const active = await as(member, () => communityApi.listMine({ status: 'active' }));

    expect(active.items.map((entry) => entry.community.id)).toContain(communityId);
  });
});

describe('live contract: contributions and the real payment flow', () => {
  it('lets an administrator create a contribution and the member sees it with exact amounts', async () => {
    await as(admin, () =>
      contributionApi.create(communityId, {
        membershipId,
        contributionPeriodStart: isoDate(0),
        contributionPeriodEnd: isoDate(29),
        dueDate: isoDate(30),
        amount: '1200',
        notes: 'Live contract test',
      }),
    );

    const adminView = await as(admin, () => contributionApi.listForCommunity(communityId));

    expect(adminView[0]).toMatchObject({ memberName: 'Member Tester', amount: '1200.00', status: 'pending' });

    const mine = await as(member, () => contributionApi.listMine({}));
    const item = mine.items[0];

    contributionId = item.id;
    expect(item).toMatchObject({
      amount: '1200.00',
      outstandingAmount: '1200.00',
      paidAmount: '0.00',
      currency: 'ETB',
      status: 'pending',
      isOverdue: false,
      community: { id: communityId },
    });
    expect(mine.summary[0]).toMatchObject({ currency: 'ETB', outstandingAmount: '1200.00', pendingCount: 1, overdueCount: 0 });
  });

  it('a member with NO permissions can pay: checkout, provider confirmation, partial then full', async () => {
    const returnUrl = 'http://localhost:5173/payments/return';

    const first = await as(member, () => paymentApi.checkout({ contributionId, amount: '200', returnUrl }));

    expect(first.payment).toMatchObject({ status: 'pending', amount: '200.00', currency: 'ETB', provider: 'chapa' });
    expect(first.checkoutUrl).toBe(`https://checkout.chapa.co/checkout/payment/YEGNA-PAY-${first.payment.id}`);

    const sent = chapa.initialized.get(`YEGNA-PAY-${first.payment.id}`);

    expect(sent).toEqual({ amount: '200.00', currency: 'ETB' });

    // the customer has not paid yet: the backend must report pending, not fail
    const early = await as(member, () => paymentApi.verify(first.payment.id));

    expect(early.outcome).toBe('pending');

    // the customer pays at Chapa; only now does the backend confirm
    chapa.paid.add(`YEGNA-PAY-${first.payment.id}`);

    const confirmed = await as(member, () => paymentApi.verify(first.payment.id));

    expect(confirmed.outcome).toBe('successful');
    expect(confirmed.payment).toMatchObject({ status: 'successful', checkoutUrl: null });
    expect(confirmed.payment.completedAt).toBeTruthy();

    const partial = await as(member, () => contributionApi.listMine({}));

    expect(partial.items[0]).toMatchObject({ status: 'partially_paid', paidAmount: '200.00', outstandingAmount: '1000.00' });

    const second = await as(member, () => paymentApi.checkout({ contributionId, returnUrl }));

    expect(second.payment.amount).toBe('1000.00');
    chapa.paid.add(`YEGNA-PAY-${second.payment.id}`);
    expect((await as(member, () => paymentApi.verify(second.payment.id))).outcome).toBe('successful');

    const settled = await as(member, () => contributionApi.listMine({}));

    expect(settled.items[0]).toMatchObject({ status: 'paid', paidAmount: '1200.00', outstandingAmount: '0.00' });
  });

  it('lists payments with community context, references and totals', async () => {
    const payments = await as(member, () => paymentApi.listMine({}));

    expect(payments.items).toHaveLength(2);
    expect(payments.items[0]).toMatchObject({ community: { id: communityId }, status: 'successful', checkoutUrl: null });
    expect(payments.summary[0]).toMatchObject({ currency: 'ETB', totalPaid: '1200.00' });
    expect(Number(payments.summary[0].pendingAmount)).toBe(0); // the API returns "0" for an empty sum

    const ledger = await as(admin, () => paymentApi.listForCommunity(communityId));

    expect(ledger.filter((entry) => entry.status === 'successful')).toHaveLength(2);
  });

  it('refuses to pay a settled contribution or someone else\'s contribution', async () => {
    await as(member, () => expectApiError(paymentApi.checkout({ contributionId, returnUrl: 'http://localhost:5173/payments/return' }), 400, 'CONTRIBUTION_ALREADY_SETTLED'));
    await as(invitee, () => expectApiError(paymentApi.checkout({ contributionId, returnUrl: 'http://localhost:5173/payments/return' }), 404, 'CONTRIBUTION_NOT_FOUND'));
  });
});

describe('live contract: notifications', () => {
  it('lists, counts, and marks notifications read', async () => {
    const before = await as(member, () => notificationApi.unreadCount());

    expect(typeof before).toBe('number');

    const list = await as(member, () => notificationApi.list({ limit: 20 }));

    expect(list.pagination).toMatchObject({ limit: 20, offset: 0 });

    for (const item of list.items) {
      expect(item).toMatchObject({ id: expect.any(String), type: expect.any(String), title: expect.any(String), message: expect.any(String) });
    }

    await as(member, () => notificationApi.markAllRead());

    expect(await as(member, () => notificationApi.unreadCount())).toBe(0);
  });
});

describe('live contract: invitations', () => {
  it('delivers an invitation to the invitee, who accepts it by ID', async () => {
    await as(admin, () => api.post(`/communities/${communityId}/invitations`, { invitedUserId: invitee.id }));

    const inbox = await as(invitee, () => invitationApi.listMine({ status: 'pending' }));

    expect(inbox.pagination.total).toBe(1);
    expect(inbox.items[0]).toMatchObject({ status: 'pending', community: { id: communityId, name: `Contract Equb ${stamp}` }, inviter: { name: 'Admin Tester' } });
    expect(JSON.stringify(inbox)).not.toMatch(/token/i);

    await as(invitee, () => invitationApi.accept(inbox.items[0].id));

    const mine = await as(invitee, () => communityApi.listMine({ status: 'active' }));

    expect(mine.items.map((entry) => entry.community.id)).toContain(communityId);

    const adminList = await as(admin, () => invitationApi.listForCommunity(communityId));

    expect(adminList[0]).toMatchObject({ status: 'accepted', invitedUserId: invitee.id });
  });

  it('lets an administrator revoke a pending invitation', async () => {
    await as(invitee, () => communityApi.leave(communityId));
    await as(admin, () => api.post(`/communities/${communityId}/invitations`, { invitedUserId: invitee.id }));

    const pending = (await as(admin, () => invitationApi.listForCommunity(communityId))).find((entry) => entry.status === 'pending')!;

    await as(admin, () => invitationApi.revoke(communityId, pending.id));

    const after = await as(admin, () => invitationApi.listForCommunity(communityId));

    expect(after.find((entry) => entry.id === pending.id)?.status).toBe('revoked');
  });
});

describe('live contract: reports', () => {
  it('returns every report shape the dashboard charts read', async () => {
    const overview = await as(admin, () => reportApi.overview(communityId));

    expect(overview.memberships.total_memberships).toBeGreaterThanOrEqual(2);
    expect(overview.contributions).toMatchObject({ total_expected: '1200.00', total_paid: '1200.00' });
    expect(overview.payments.successful_payment_amount).toBe('1200.00');

    const membership = await as(admin, () => reportApi.membership(communityId));

    expect(membership.summary.total_members).toBeGreaterThanOrEqual(2);
    expect(membership.roles.map((role) => role.role_name)).toContain('admin');

    const contributions = await as(admin, () => reportApi.contributions(communityId, { period: 'current' }));

    expect(contributions.summary).toMatchObject({ total_contributions: 1, paid_contributions: 1, total_paid: '1200.00', total_outstanding: '0.00' });

    const payments = await as(admin, () => reportApi.payments(communityId, { period: 'current' }));

    expect(payments.summary).toMatchObject({ total_payments: 2, successful_payments: 2, successful_amount: '1200.00' });

    const financial = await as(admin, () => reportApi.financialSummary(communityId, { period: 'current' }));

    expect(financial.contributions.total_paid).toBe('1200.00');
    expect(financial.payments.successful_payments).toBe(2);
    expect(financial.ledger).toEqual(expect.objectContaining({ total_ledger_entries: expect.any(Number), total_credits: expect.any(String), total_debits: expect.any(String) }));
  });

  it('counts contributions by due date up to today, so a future due date is excluded from "to date" periods', async () => {
    const toDate = await as(admin, () => reportApi.contributions(communityId, { period: 'year' }));

    expect(toDate.summary.total_contributions).toBe(0);
  });

  it('refuses reports to members without the permission (403)', async () => {
    await as(member, () => expectApiError(reportApi.overview(communityId), 403));
  });

  it('rejects a custom range that ends before it starts (400)', async () => {
    await as(admin, () =>
      expectApiError(reportApi.contributions(communityId, { period: 'custom', startDate: isoDate(10), endDate: isoDate(1) }), 400),
    );
  });
});

describe('live contract: leaving and session security', () => {
  it('lets a member leave and hides the community from their default list', async () => {
    await as(member, () => communityApi.leave(communityId));

    const current = await as(member, () => communityApi.listMine());
    const left = await as(member, () => communityApi.listMine({ status: 'left' }));

    expect(current.items.map((entry) => entry.community.id)).not.toContain(communityId);
    expect(left.items.map((entry) => entry.community.id)).toContain(communityId);
  });

  it('rotates the refresh token once for concurrent refreshes (single-flight against the real API)', async () => {
    tokenStore.setTokens(admin.access, admin.refresh);

    const before = tokenStore.getRefreshToken();
    const outcomes = await Promise.all([refreshSession(), refreshSession(), refreshSession()]);

    expect(outcomes).toEqual(['ok', 'ok', 'ok']);
    expect(tokenStore.getRefreshToken()).not.toBe(before);

    // the rotated session works
    expect((await authApi.getMe()).user.id).toBe(admin.id);

    admin.access = tokenStore.getAccessToken()!;
    admin.refresh = tokenStore.getRefreshToken()!;
    admin.id = (await authApi.getMe()).user.id;
    (admin as TestUser & { staleRefresh?: string }).staleRefresh = before ?? '';
  });

  it('REUSING a rotated refresh token is rejected and revokes the whole session (why single-flight matters)', async () => {
    const stale = (admin as TestUser & { staleRefresh?: string }).staleRefresh!;

    await expectApiError(request('/auth/refresh', { method: 'POST', body: { refreshToken: stale } }), 401);

    // the backend treats reuse as theft: the legitimate, newer token no longer works either
    await expectApiError(request('/auth/refresh', { method: 'POST', body: { refreshToken: admin.refresh } }), 401);
  });

  it('signs out by revoking the refresh token', async () => {
    const fresh = await authApi.login({ email: member.email }, PASSWORD);

    await as({ ...member, access: fresh.accessToken, refresh: fresh.refreshToken }, () => authApi.logout(fresh.refreshToken));
    await expectApiError(request('/auth/refresh', { method: 'POST', body: { refreshToken: fresh.refreshToken } }), 401);
  });
});
