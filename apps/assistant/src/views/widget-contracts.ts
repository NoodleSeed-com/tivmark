import { z } from 'zod';

const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const nonEmptyString = z.string().min(1);

const requesterSchema = z
  .object({
    id: z.string(),
    name: z.string().nullable().optional(),
    email: z.string().nullable().optional(),
  })
  .passthrough();

export const timeOffRequestSchema = z
  .object({
    id: z.string(),
    type: nonEmptyString,
    status: nonEmptyString,
    startDate: dateOnly,
    endDate: dateOnly,
    requestedHalfDays: z.number().int().nonnegative().optional(),
    reason: z.string().nullable().optional(),
    requester: requesterSchema.optional(),
  })
  .passthrough();

export const equipmentRequestSchema = z
  .object({
    id: z.string(),
    category: nonEmptyString,
    item: nonEmptyString,
    quantity: z.number().int().min(1).max(20),
    status: nonEmptyString,
    justification: z.string().nullable().optional(),
    requester: requesterSchema.optional(),
  })
  .passthrough();

export const balanceItemSchema = z
  .object({
    allowanceHalfDays: z.number().nonnegative().nullable(),
    approvedHalfDays: z.number().nonnegative(),
    pendingHalfDays: z.number().nonnegative(),
    remainingHalfDays: z.number().nullable(),
  })
  .passthrough();

export const timeOffRequestsOutputSchema = z.object({
  team: z.string(),
  requests: z.array(timeOffRequestSchema),
});

export const equipmentRequestsOutputSchema = z.object({
  team: z.string(),
  requests: z.array(equipmentRequestSchema),
});

export const timeOffBalanceOutputSchema = z.object({
  team: z.string(),
  userId: z.string(),
  balances: z.record(z.record(balanceItemSchema)),
});
