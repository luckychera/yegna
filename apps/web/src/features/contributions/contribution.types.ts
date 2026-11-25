export type ContributionStatus = 'pending' | 'partially_paid' | 'paid' | 'overdue' | 'waived' | 'cancelled';

export interface MyContribution {
  id: string;
  communityId: string;
  membershipId: string;
  community: { id: string; name: string; logoUrl: string | null };
  periodStart: string;
  periodEnd: string;
  dueDate: string;
  amount: string;
  currency: string;
  status: ContributionStatus;
  /** True when unpaid and past due, even if the stored status is still "pending". */
  isOverdue: boolean;
  paidAmount: string;
  waivedAmount: string;
  penaltyAmount: string;
  outstandingAmount: string;
  notes: string | null;
  createdAt: string;
}

export interface ContributionSummary {
  currency: string;
  count: number;
  totalAmount: string;
  paidAmount: string;
  outstandingAmount: string;
  pendingCount: number;
  overdueCount: number;
}

/** A contribution as seen by community admins (GET /communities/:id/contributions). */
export interface CommunityContribution {
  id: string;
  communityId: string;
  membershipId: string;
  memberName: string;
  periodStart: string;
  periodEnd: string;
  dueDate: string;
  amount: string;
  currency: string;
  status: ContributionStatus;
  paidAmount: string;
  waivedAmount: string;
}

export interface CreateContributionInput {
  membershipId: string;
  contributionPeriodStart: string;
  contributionPeriodEnd: string;
  dueDate: string;
  amount: string;
  notes?: string;
}

export function isPayable(contribution: Pick<MyContribution, 'status' | 'outstandingAmount'>): boolean {
  return (
    ['pending', 'partially_paid', 'overdue'].includes(contribution.status) &&
    Number(contribution.outstandingAmount) > 0
  );
}
