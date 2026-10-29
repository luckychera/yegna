/**
 * The single error type thrown by the API layer. Components never see raw fetch,
 * network or backend internals: they get a status, a stable code and a safe message.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly retryAfterSeconds: number | null;

  constructor(message: string, status: number, code: string, retryAfterSeconds: number | null = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export const ERROR_CODES = {
  NETWORK: 'NETWORK_ERROR',
  TIMEOUT: 'REQUEST_TIMEOUT',
  INVALID_RESPONSE: 'INVALID_RESPONSE',
} as const;

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

/** Friendly copy for specific backend error codes. Anything not listed falls back to status rules. */
const CODE_MESSAGES: Record<string, string> = {
  INVALID_CREDENTIALS: 'The email, phone number or password is incorrect.',
  ACCOUNT_NOT_ACTIVE: 'This account is not active. Please contact support.',
  ACCOUNT_ALREADY_EXISTS: 'An account with that email or phone number already exists.',
  FAYDA_VERIFICATION_FAILED:
    "We couldn't verify that Fayda ID. Check the number and ID type, then try again.",
  IDENTIFIER_TYPE_MISMATCH: 'That ID number does not match the selected ID type.',
  INVALID_CURRENT_PASSWORD: 'Your current password is incorrect.',
  PASSWORD_REUSE: 'Choose a password you have not used before.',
  COMMUNITY_NOT_JOINABLE: 'This community is not accepting new members right now.',
  COMMUNITY_ACCESS_DENIED: "You don't have access to this community.",
  PERMISSION_DENIED: "You don't have permission to perform this action.",
  INVITATION_EXPIRED: 'This invitation has expired.',
  PAYMENT_VERIFICATION_UNAVAILABLE:
    "We couldn't confirm your payment with the payment provider yet. Please try again shortly.",
  PAYMENT_VERIFICATION_MISMATCH:
    'The payment confirmation did not match this payment. Please contact support.',
  CHECKOUT_IN_PROGRESS: 'Your payment is still being prepared. Please try again in a moment.',
  OPEN_PAYMENT_EXISTS:
    'You already have a payment in progress for this contribution. Complete it, or check its status on the Payments page.',
  PAYMENT_NEEDS_REVIEW:
    'Your payment was received by the payment provider but could not be applied to this contribution automatically. Please contact your community administrator and quote your payment reference.',
  CONTRIBUTION_ALREADY_SETTLED: 'This contribution has already been paid in full.',
  CONTRIBUTION_NOT_PAYABLE: 'This contribution can no longer receive payments.',
};

export function getErrorMessage(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (!isApiError(error)) {
    return fallback;
  }

  const byCode = CODE_MESSAGES[error.code];

  if (byCode) {
    return byCode;
  }

  if (error.code === ERROR_CODES.NETWORK) {
    return "We couldn't reach Yegna. Check your internet connection and try again.";
  }

  if (error.code === ERROR_CODES.TIMEOUT) {
    return 'Yegna is taking too long to respond. Please try again.';
  }

  switch (true) {
    case error.status === 401:
      return 'Your session has expired. Please sign in again.';
    case error.status === 403:
      return "You don't have permission to perform this action.";
    case error.status === 404:
      return "We couldn't find what you were looking for.";
    case error.status === 429:
      return error.retryAfterSeconds
        ? `Too many requests. Please wait ${error.retryAfterSeconds} seconds and try again.`
        : 'Too many requests. Please wait a moment and try again.';
    case error.status >= 500 || error.status === 0:
      return 'Something went wrong while connecting to Yegna. Please try again.';
    default:
      // 400 / 409 / 422: the backend message is written for users and safe to show.
      return error.message || fallback;
  }
}
