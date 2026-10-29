export type ReportPeriod = 'current' | 'month' | 'quarter' | 'year' | 'custom';

export interface ReportPeriodParams {
  period: ReportPeriod;
  startDate?: string;
  endDate?: string;
}

export interface ContributionStats {
  total_contributions: number;
  pending_contributions: number;
  paid_contributions: number;
  overdue_contributions: number;
  waived_contributions: number;
  cancelled_contributions: number;
  total_expected: string;
  total_paid: string;
  total_outstanding: string;
}

export interface PaymentStats {
  total_payments: number;
  pending_payments: number;
  processing_payments: number;
  successful_payments: number;
  failed_payments: number;
  cancelled_payments: number;
  refunded_payments: number;
  successful_amount: string;
  refunded_amount: string;
}

export interface CommunityOverviewReport {
  community: { id: string; name: string; community_type: string; status: string; created_at: string };
  memberships: {
    total_memberships: number;
    active_memberships: number;
    pending_memberships: number;
    suspended_memberships: number;
    left_memberships: number;
  };
  contributions: { total_contributions: number; total_expected: string; total_paid: string };
  payments: { total_payments: number; successful_payment_amount: string };
}

export interface MembershipReport {
  summary: {
    total_members: number;
    active_members: number;
    pending_members: number;
    suspended_members: number;
    left_members: number;
  };
  roles: { role_id: string; role_name: string; member_count: number }[];
}

export interface ContributionReport {
  period: { type: string; startDate: string | null; endDate: string | null };
  summary: ContributionStats;
}

export interface PaymentReport {
  period: { type: string; startDate: string | null; endDate: string | null };
  summary: PaymentStats;
}

export interface FinancialSummaryReport {
  period: { type: string; startDate: string | null; endDate: string | null };
  contributions: ContributionStats;
  payments: PaymentStats;
  ledger: { total_ledger_entries: number; total_credits: string; total_debits: string };
}
