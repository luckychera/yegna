import type { Tone } from '@/components/ui/Badge';
import type { FaydaVerificationStatus } from '@/features/auth/auth.types';

const STATUSES: Record<FaydaVerificationStatus | 'none', { label: string; tone: Tone }> = {
  verified: { label: 'Verified', tone: 'success' },
  pending: { label: 'Pending', tone: 'warning' },
  failed: { label: 'Verification failed', tone: 'danger' },
  revoked: { label: 'Revoked', tone: 'danger' },
  none: { label: 'Not verified', tone: 'neutral' },
};

export function identityStatus(status: FaydaVerificationStatus | null | undefined) {
  return STATUSES[status ?? 'none'];
}

export function identifierTypeLabel(type: 'FIN' | 'FAN' | null): string {
  if (type === 'FIN') return 'Fayda Identification Number (FIN)';
  if (type === 'FAN') return 'Fayda Account Number (FAN)';

  return 'Not recorded';
}
