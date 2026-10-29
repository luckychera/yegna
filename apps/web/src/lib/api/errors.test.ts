import { describe, expect, it } from 'vitest';

import { ApiError, ERROR_CODES, getErrorMessage } from './errors';

describe('getErrorMessage', () => {
  it('uses friendly copy for known backend codes', () => {
    expect(getErrorMessage(new ApiError('x', 401, 'INVALID_CREDENTIALS'))).toMatch(/incorrect/i);
    expect(getErrorMessage(new ApiError('x', 409, 'COMMUNITY_NOT_JOINABLE'))).toMatch(/not accepting new members/i);
  });

  it('never leaks raw server details for 5xx errors', () => {
    const message = getErrorMessage(new ApiError('ECONNREFUSED 127.0.0.1:5432', 500, 'INTERNAL_SERVER_ERROR'));

    expect(message).toBe('Something went wrong while connecting to Yegna. Please try again.');
    expect(message).not.toMatch(/ECONNREFUSED|5432/);
  });

  it('explains permission, not-found and rate-limit failures', () => {
    expect(getErrorMessage(new ApiError('x', 403, 'FORBIDDEN'))).toBe("You don't have permission to perform this action.");
    expect(getErrorMessage(new ApiError('x', 404, 'NOT_FOUND'))).toMatch(/couldn't find/i);
    expect(getErrorMessage(new ApiError('x', 429, 'RATE_LIMIT', 30))).toMatch(/30 seconds/);
    expect(getErrorMessage(new ApiError('x', 429, 'RATE_LIMIT'))).toMatch(/Too many requests/);
  });

  it('describes network failures and timeouts', () => {
    expect(getErrorMessage(new ApiError('x', 0, ERROR_CODES.NETWORK))).toMatch(/internet connection/i);
    expect(getErrorMessage(new ApiError('x', 0, ERROR_CODES.TIMEOUT))).toMatch(/taking too long/i);
  });

  it('shows the backend message for validation and conflict errors', () => {
    expect(getErrorMessage(new ApiError('Amount exceeds the remaining balance', 400, 'PAYMENT_EXCEEDS_BALANCE'))).toBe(
      'Amount exceeds the remaining balance',
    );
  });

  it('falls back for non-API errors', () => {
    expect(getErrorMessage(new Error('boom'))).toBe('Something went wrong. Please try again.');
  });
});
