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

export const timeOffAssessmentSchema = z.object({
  status: z.string().min(1),
  team: z.string().min(1),
  userId: z.string().min(1),
  type: z.enum(['VACATION', 'SICK', 'PERSONAL', 'UNPAID']),
  startDate: dateOnly,
  endDate: dateOnly,
  eligible: z.boolean(),
  decision: z.enum([
    'ELIGIBLE',
    'INVALID_DATES',
    'OVERLAP',
    'INSUFFICIENT_BALANCE',
    'POLICY_UNAVAILABLE',
  ]),
  reason: z.string().min(1),
  requestedHalfDays: z.number().int().nonnegative(),
  pendingHalfDays: z.number().nonnegative(),
  availableBeforeHalfDays: z.number().nullable(),
  remainingAfterHalfDays: z.number().nullable(),
  conflict: z
    .object({
      id: z.string().min(1),
      startDate: dateOnly,
      endDate: dateOnly,
    })
    .nullable(),
  checks: z.object({
    weekday: z.boolean(),
    noOverlap: z.boolean(),
    withinBalance: z.boolean(),
  }),
  policySource: z.string().min(1),
});

export const timeOffReceiptSchema = z.object({
  requestId: z.string().min(1),
  status: z.string().min(1),
  team: z.string().min(1),
  type: z.enum(['VACATION', 'SICK', 'PERSONAL', 'UNPAID']),
  startDate: dateOnly,
  endDate: dateOnly,
  requestedHalfDays: z.number().int().nonnegative(),
  pendingHalfDays: z.number().nonnegative(),
  remainingAfterPendingHalfDays: z.number().nullable(),
  authenticated: z.boolean(),
});

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
