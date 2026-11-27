import { z } from 'zod';

const httpUrl = z
  .string()
  .trim()
  .refine((value) => value === '' || /^https?:\/\//i.test(value), 'Enter an http or https URL.')
  .refine((value) => {
    if (value === '') return true;

    try {
      const url = new URL(value);

      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
      return false;
    }
  }, 'Enter a valid image URL.');

/** Mirrors PATCH /users/me. Email, phone and Fayda identity are not editable here. */
export const profileSchema = z.object({
  firstName: z.string().trim().min(1, 'Enter your first name.').max(100, 'Use at most 100 characters.'),
  middleName: z.string().trim().max(100, 'Use at most 100 characters.'),
  lastName: z.string().trim().min(1, 'Enter your last name.').max(100, 'Use at most 100 characters.'),
  displayName: z.string().trim().max(200, 'Use at most 200 characters.'),
  avatarUrl: httpUrl,
  preferredLanguage: z.string().trim().regex(/^[a-z]{2}(-[A-Z]{2})?$/, 'Choose a language.'),
  timezone: z.string().trim().min(1, 'Choose a time zone.').max(64, 'Use at most 64 characters.'),
});

export type ProfileFormValues = z.infer<typeof profileSchema>;
