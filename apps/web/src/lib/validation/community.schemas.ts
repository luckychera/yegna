import { z } from 'zod';

import { COMMUNITY_TYPES } from '@/features/communities/community.types';

export const communitySchema = z.object({
  name: z.string().trim().min(2, 'Enter a community name.').max(200, 'Use at most 200 characters.'),
  communityType: z.enum(COMMUNITY_TYPES),
  description: z.string().trim().max(2000, 'Use at most 2000 characters.'),
  logoUrl: z
    .string()
    .trim()
    .refine((value) => value === '' || /^https?:\/\/\S+$/i.test(value), 'Enter a full web address starting with http:// or https://.'),
  bannerUrl: z
    .string()
    .trim()
    .refine((value) => value === '' || /^https?:\/\/\S+$/i.test(value), 'Enter a full web address starting with http:// or https://.'),
});

export type CommunityFormValues = z.infer<typeof communitySchema>;
