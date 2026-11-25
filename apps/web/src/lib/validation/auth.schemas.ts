import { z } from 'zod';

// Mirrors the backend password rules so users get instant feedback.
export const passwordSchema = z
  .string()
  .min(8, 'Use at least 8 characters.')
  .max(128, 'Use at most 128 characters.')
  .regex(/[A-Z]/, 'Include at least one uppercase letter.')
  .regex(/[a-z]/, 'Include at least one lowercase letter.')
  .regex(/[0-9]/, 'Include at least one number.');

/** Normalizes Ethiopian phone numbers to +2519XXXXXXXX / +2517XXXXXXXX, or null if invalid. */
export function normalizeEthiopianPhone(input: string): string | null {
  const digits = input.replace(/[\s()-]/g, '');

  if (/^\+251[79]\d{8}$/.test(digits)) return digits;
  if (/^251[79]\d{8}$/.test(digits)) return `+${digits}`;
  if (/^0[79]\d{8}$/.test(digits)) return `+251${digits.slice(1)}`;
  if (/^[79]\d{8}$/.test(digits)) return `+251${digits}`;

  return null;
}

export type LoginIdentifier = { email: string } | { phone: string };

/** Login accepts one field: anything with "@" is an email, otherwise it must be a phone number. */
export function toLoginIdentifier(input: string): LoginIdentifier | null {
  const value = input.trim();

  if (value.includes('@')) {
    return z.email().safeParse(value).success ? { email: value.toLowerCase() } : null;
  }

  const phone = normalizeEthiopianPhone(value);

  return phone ? { phone } : null;
}

export const loginSchema = z.object({
  identifier: z
    .string()
    .trim()
    .min(1, 'Enter your email or phone number.')
    .refine((value) => toLoginIdentifier(value) !== null, 'Enter a valid email or Ethiopian phone number.'),
  password: z.string().min(1, 'Enter your password.'),
});

export type LoginFormValues = z.infer<typeof loginSchema>;

export const accountStepSchema = z
  .object({
    email: z.email('Enter a valid email address.'),
    phone: z
      .string()
      .trim()
      .refine((value) => value === '' || normalizeEthiopianPhone(value) !== null, 'Enter a valid Ethiopian phone number.'),
    password: passwordSchema,
    confirmPassword: z.string().min(1, 'Confirm your password.'),
  })
  .refine((values) => values.password === values.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match.',
  });

export type AccountStepValues = z.infer<typeof accountStepSchema>;

export const personalStepSchema = z.object({
  firstName: z.string().trim().min(1, 'Enter your first name.').max(100),
  middleName: z.string().trim().max(100),
  lastName: z.string().trim().min(1, 'Enter your last name.').max(100),
});

export type PersonalStepValues = z.infer<typeof personalStepSchema>;

// The backend applies no format rule of its own (the identity provider decides), so the form only
// checks that the value looks like a Fayda number: digits only, 12 to 16 long.
export const faydaStepSchema = z.object({
  faydaIdentifierType: z.enum(['fin', 'fan']),
  faydaIdentifier: z
    .string()
    .trim()
    .min(1, 'Enter your Fayda ID number.')
    .regex(/^\d{12,16}$/, 'Enter the 12 to 16 digit number on your Fayda ID.'),
});

export type FaydaStepValues = z.infer<typeof faydaStepSchema>;

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password.'),
    newPassword: passwordSchema,
    confirmPassword: z.string().min(1, 'Confirm your new password.'),
  })
  .refine((values) => values.newPassword === values.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match.',
  });

export type ChangePasswordValues = z.infer<typeof changePasswordSchema>;
