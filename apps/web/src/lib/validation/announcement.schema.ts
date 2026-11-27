import { z } from 'zod';

import { ANNOUNCEMENT_CATEGORIES } from '@/features/announcements/announcement.types';

/** Mirrors the announcement create and update validation on the API. */
export const announcementSchema = z.object({
  title: z.string().trim().min(3, 'Use at least 3 characters.').max(160, 'Use at most 160 characters.'),
  body: z.string().trim().min(1, 'Write the announcement.').max(5000, 'Use at most 5000 characters.'),
  category: z.enum(ANNOUNCEMENT_CATEGORIES),
  eventAt: z.string().refine((value) => value === '' || !Number.isNaN(Date.parse(value)), 'Enter a valid date and time.'),
  location: z.string().trim().max(200, 'Use at most 200 characters.'),
  isPinned: z.boolean(),
});

export type AnnouncementFormValues = z.infer<typeof announcementSchema>;

export function toEventInput(iso: string | null): string {
  if (!iso) return '';

  const date = new Date(iso);

  if (Number.isNaN(date.getTime())) return '';

  const pad = (value: number) => String(value).padStart(2, '0');

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
