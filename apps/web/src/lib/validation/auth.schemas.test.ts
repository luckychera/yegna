import { describe, expect, it } from 'vitest';

import {
  faydaStepSchema,
  normalizeEthiopianPhone,
  passwordSchema,
  toLoginIdentifier,
} from './auth.schemas';

describe('normalizeEthiopianPhone', () => {
  it('normalizes the common ways people type a number', () => {
    for (const input of ['0911234567', '911234567', '251911234567', '+251911234567', '+251 91 123 4567']) {
      expect(normalizeEthiopianPhone(input)).toBe('+251911234567');
    }
  });

  it('rejects numbers that are not Ethiopian mobiles', () => {
    expect(normalizeEthiopianPhone('12345')).toBeNull();
    expect(normalizeEthiopianPhone('0111234567')).toBeNull();
  });
});

describe('toLoginIdentifier', () => {
  it('treats anything with @ as an email, otherwise as a phone', () => {
    expect(toLoginIdentifier('Abebe@Example.com')).toEqual({ email: 'abebe@example.com' });
    expect(toLoginIdentifier('0911234567')).toEqual({ phone: '+251911234567' });
    expect(toLoginIdentifier('not an id')).toBeNull();
  });
});

describe('passwordSchema', () => {
  it('mirrors the backend password rules', () => {
    expect(passwordSchema.safeParse('Abcdef12').success).toBe(true);
    expect(passwordSchema.safeParse('short1A').success).toBe(false);
    expect(passwordSchema.safeParse('alllowercase1').success).toBe(false);
    expect(passwordSchema.safeParse('ALLUPPERCASE1').success).toBe(false);
    expect(passwordSchema.safeParse('NoDigitsHere').success).toBe(false);
  });
});

describe('faydaStepSchema', () => {
  it('accepts a 12 to 16 digit number for either ID type (the provider decides the exact format)', () => {
    expect(faydaStepSchema.safeParse({ faydaIdentifierType: 'fin', faydaIdentifier: '100000000001' }).success).toBe(true);
    expect(faydaStepSchema.safeParse({ faydaIdentifierType: 'fan', faydaIdentifier: '100000000002' }).success).toBe(true);
    expect(faydaStepSchema.safeParse({ faydaIdentifierType: 'fan', faydaIdentifier: '1234567890123456' }).success).toBe(true);
  });

  it('rejects values that cannot be a Fayda number', () => {
    for (const faydaIdentifier of ['12345', '12345678901', '12345678901234567', '1000000000ab', '1000 0000 0001']) {
      expect(faydaStepSchema.safeParse({ faydaIdentifierType: 'fin', faydaIdentifier }).success).toBe(false);
    }
  });
});
