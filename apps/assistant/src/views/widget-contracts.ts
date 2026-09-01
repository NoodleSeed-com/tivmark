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

export const onboardingBlueprintSchema = z.object({
  businessName: z.string().min(3),
  teamSize: z.enum(['1-10', '11-50', '51-200', '201+']),
  timeZone: z.string().min(1),
  primaryGoal: z.enum(['TIME_OFF', 'EQUIPMENT', 'BOTH']),
  vacationAllowanceDays: z.number().int().nonnegative(),
  sickAllowanceDays: z.number().int().nonnegative(),
  personalAllowanceDays: z.number().int().nonnegative(),
  policySummary: z.string().optional(),
  nextSteps: z.array(z.string()).optional(),
});

export const onboardingReceiptSchema = z.object({
  status: z.literal('READY'),
  team: z.object({
    id: z.string(),
    name: z.string(),
    slug: z.string(),
    teamSize: z.enum(['1-10', '11-50', '51-200', '201+']).nullable(),
    timeZone: z.string().nullable(),
    primaryGoal: z.enum(['TIME_OFF', 'EQUIPMENT', 'BOTH']).nullable(),
    primaryGoalLabel: z.string(),
    onboardingCompletedAt: z.string(),
  }),
  policies: z.array(
    z.object({
      type: z.string(),
      allowanceHalfDays: z.number().nullable(),
      allowanceDays: z.number().nullable(),
    })
  ),
  nextSteps: z.array(
    z.object({ id: z.string(), label: z.string(), url: z.string() })
  ),
  authenticated: z.boolean(),
});

export type OnboardingBlueprintData = z.infer<typeof onboardingBlueprintSchema>;
export type OnboardingReceiptData = z.infer<typeof onboardingReceiptSchema>;

const newHireEquipmentPackage = z.enum([
  'STANDARD',
  'DESIGN',
  'ENGINEERING',
  'NONE',
]);

const newHirePersonSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  jobTitle: z.string().min(1),
  startDate: dateOnly,
  workLocation: z.string().min(1),
  timeZone: z.string().min(1),
  role: z.enum(['ADMIN', 'MEMBER']),
});

const newHirePolicySchema = z.object({
  type: z.string().min(1),
  allowanceHalfDays: z.number().int().nullable(),
  allowanceDays: z.number().nullable(),
  assignment: z.literal('ON_ACCEPTANCE'),
});

export const newHirePlanSchema = z.object({
  status: z.literal('PLANNED'),
  team: z.object({ id: z.string(), name: z.string(), slug: z.string() }),
  newHire: newHirePersonSchema,
  equipment: z.object({
    package: newHireEquipmentPackage,
    label: z.string(),
    item: z.string().nullable(),
  }),
  policies: z.array(newHirePolicySchema).max(4),
  checklist: z
    .array(
      z.object({
        id: z.string(),
        label: z.string(),
        status: z.literal('WILL_CREATE'),
      })
    )
    .max(4),
  authenticated: z.boolean(),
});

export const newHireReceiptSchema = z.object({
  status: z.enum(['READY', 'ACTIVE']),
  launchId: z.string(),
  team: z.object({ id: z.string(), name: z.string(), slug: z.string() }),
  newHire: newHirePersonSchema,
  invitation: z.object({
    id: z.string().nullable(),
    status: z.enum(['PENDING', 'ACCEPTED']),
    expiresAt: z.string().nullable(),
  }),
  equipment: z.object({
    package: newHireEquipmentPackage,
    label: z.string(),
    requestId: z.string().nullable(),
    item: z.string().nullable(),
    status: z.string().nullable(),
  }),
  policies: z.array(newHirePolicySchema).max(4),
  checklist: z
    .array(
      z.object({
        id: z.string(),
        label: z.string(),
        status: z.literal('COMPLETE'),
      })
    )
    .max(4),
  nextSteps: z
    .array(z.object({ id: z.string(), label: z.string(), url: z.string() }))
    .max(2),
  createdAt: z.string(),
  activatedAt: z.string().nullable(),
  authenticated: z.boolean(),
});

export type NewHirePlanData = z.infer<typeof newHirePlanSchema>;
export type NewHireReceiptData = z.infer<typeof newHireReceiptSchema>;
