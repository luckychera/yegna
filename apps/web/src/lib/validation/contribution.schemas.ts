import { z } from 'zod';

const AMOUNT_PATTERN = /^\d+(\.\d{1,2})?$/;

export const amountSchema = z
  .string()
  .trim()
  .min(1, 'Enter an amount.')
  .refine((value) => AMOUNT_PATTERN.test(value), 'Use a number with up to 2 decimals.')
  .refine((value) => Number(value) > 0, 'Amount must be greater than zero.');

export const createContributionSchema = z
  .object({
    communityId: z.string().min(1, 'Choose a community.'),
    membershipId: z.string().min(1, 'Choose a member.'),
    contributionPeriodStart: z.string().min(1, 'Choose the period start.'),
    contributionPeriodEnd: z.string().min(1, 'Choose the period end.'),
    dueDate: z.string().min(1, 'Choose a due date.'),
    amount: amountSchema,
    notes: z.string().trim().max(1000, 'Use at most 1000 characters.'),
  })
  .refine((values) => !values.contributionPeriodStart || !values.contributionPeriodEnd || values.contributionPeriodEnd >= values.contributionPeriodStart, {
    path: ['contributionPeriodEnd'],
    message: 'The period must end on or after it starts.',
  });

export type CreateContributionValues = z.infer<typeof createContributionSchema>;

/** Validates a payment amount against the contribution's remaining balance. */
export function payAmountSchema(maxOutstanding: number) {
  return z.object({
    amount: amountSchema.refine((value) => Number(value) <= maxOutstanding, 'That is more than the amount still due.'),
  });
}
