import { describe, expect, it } from 'vitest';

import { formatDateOnly, formatDueLabel, formatRelative, greetingFor } from './date';
import { formatMoney } from './money';
import { initialsOf, fullName } from './text';

describe('formatMoney', () => {
  it('uses one ETB format with thousands separators', () => {
    expect(formatMoney('12500.00')).toBe('ETB 12,500');
    expect(formatMoney(2000)).toBe('ETB 2,000');
  });

  it('shows decimals only when the amount has them', () => {
    expect(formatMoney('1250.5')).toBe('ETB 1,250.50');
  });

  it('is safe for missing or invalid amounts', () => {
    expect(formatMoney(null)).toBe('ETB 0');
    expect(formatMoney('not-a-number')).toBe('ETB 0');
  });

  it('supports other currencies', () => {
    expect(formatMoney('50', 'USD')).toBe('USD 50');
  });
});

describe('dates', () => {
  const now = new Date('2026-04-29T12:00:00.000Z');

  it('renders calendar dates without shifting the day', () => {
    expect(formatDateOnly('2026-10-29T00:00:00.000Z')).toBe('Oct 29, 2026');
    expect(formatDateOnly(null)).toBe('—');
  });

  it('describes relative times in friendly language', () => {
    expect(formatRelative('2026-04-29T11:59:30.000Z', now)).toBe('Just now');
    expect(formatRelative('2026-04-29T10:00:00.000Z', now)).toBe('2 hours ago');
    expect(formatRelative('2026-04-28T10:00:00.000Z', now)).toBe('Yesterday');
    expect(formatRelative('2026-04-20T10:00:00.000Z', now)).toBe('Apr 20, 2026');
  });

  it('labels due dates in Ethiopian calendar days', () => {
    expect(formatDueLabel('2026-04-29T00:00:00.000Z', now)).toBe('Due today');
    expect(formatDueLabel('2026-04-30T00:00:00.000Z', now)).toBe('Due tomorrow');
    expect(formatDueLabel('2026-05-02T00:00:00.000Z', now)).toBe('Due in 3 days');
    expect(formatDueLabel('2026-04-27T00:00:00.000Z', now)).toBe('Overdue by 2 days');
  });

  it('greets by the time of day in Ethiopia', () => {
    expect(greetingFor(new Date('2026-04-29T05:00:00.000Z'))).toBe('Good morning'); // 08:00 EAT
    expect(greetingFor(new Date('2026-04-29T11:00:00.000Z'))).toBe('Good afternoon'); // 14:00 EAT
    expect(greetingFor(new Date('2026-04-29T17:00:00.000Z'))).toBe('Good evening'); // 20:00 EAT
  });
});

describe('text helpers', () => {
  it('builds initials and names', () => {
    expect(initialsOf('Abebe Kebede')).toBe('AK');
    expect(initialsOf('')).toBe('?');
    expect(fullName({ displayName: 'Abebe K.', firstName: 'Abebe', lastName: 'Kebede' })).toBe('Abebe K.');
    expect(fullName({ firstName: 'Abebe', lastName: 'Kebede' })).toBe('Abebe Kebede');
  });
});
