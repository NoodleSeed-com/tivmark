import {
  NewHireEquipmentPackage,
  NewHireLaunchStatus,
  Prisma,
  Role,
  type TimeOffPolicy,
} from '@prisma/client';
import { z } from 'zod';

import { ApiError } from '@/lib/errors';

const dateOnly = /^\d{4}-\d{2}-\d{2}$/;

const validTimeZone = (value: string) => {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value });
    return true;
  } catch {
    return false;
  }
};

export const newHireLaunchInputSchema = z.object({
  employeeName: z.string().trim().min(2).max(120),
  employeeEmail: z
    .string()
    .trim()
    .email()
    .max(320)
    .transform((email) => email.toLowerCase()),
  jobTitle: z.string().trim().min(2).max(120),
  startDate: z
    .string()
    .regex(dateOnly, 'Use a YYYY-MM-DD start date')
    .refine(
      (value) => !Number.isNaN(Date.parse(`${value}T00:00:00.000Z`)),
      'Invalid start date'
    ),
  workLocation: z.string().trim().min(2).max(120),
  timeZone: z
    .string()
    .trim()
    .min(1)
    .max(100)
    .refine(validTimeZone, 'Invalid IANA time zone'),
  role: z
    .nativeEnum(Role)
    .refine(
      (role) => role !== Role.OWNER,
      'A new hire cannot be launched as an owner'
    ),
  equipmentPackage: z.nativeEnum(NewHireEquipmentPackage),
});

export type NewHireLaunchInput = z.infer<typeof newHireLaunchInputSchema>;

const EQUIPMENT_PACKAGES: Record<
  NewHireEquipmentPackage,
  { label: string; item: string | null }
> = {
  STANDARD: {
    label: 'Standard equipment package',
    item: 'Standard package — laptop, monitor, keyboard, mouse, and headset',
  },
  DESIGN: {
    label: 'Design equipment package',
    item: 'Design package — MacBook Pro, color-accurate monitor, keyboard, mouse, and tablet',
  },
  ENGINEERING: {
    label: 'Engineering equipment package',
    item: 'Engineering package — developer laptop, two monitors, keyboard, mouse, and headset',
  },
  NONE: { label: 'No equipment package', item: null },
};

export const newHireChecklist = (hasEquipment: boolean) => [
  { id: 'invitation', label: 'Team invitation', status: 'COMPLETE' as const },
  {
    id: 'membership',
    label: 'Team role prepared',
    status: 'COMPLETE' as const,
  },
  {
    id: 'leave',
    label: 'Leave policy inheritance prepared',
    status: 'COMPLETE' as const,
  },
  {
    id: 'equipment',
    label: hasEquipment
      ? 'Equipment request created'
      : 'Equipment intentionally skipped',
    status: 'COMPLETE' as const,
  },
];

export const newHirePlannedChecklist = (hasEquipment: boolean) =>
  newHireChecklist(hasEquipment).map((item) => ({
    ...item,
    status: 'WILL_CREATE' as const,
  }));

export const equipmentPackage = (value: NewHireEquipmentPackage) =>
  EQUIPMENT_PACKAGES[value];

export const policySummary = (policies: TimeOffPolicy[]) =>
  policies.map((policy) => ({
    type: policy.type,
    allowanceHalfDays: policy.annualAllowanceHalfDays,
    allowanceDays:
      policy.annualAllowanceHalfDays === null
        ? null
        : policy.annualAllowanceHalfDays / 2,
    assignment: 'ON_ACCEPTANCE' as const,
  }));

export const toDateOnly = (value: Date) => value.toISOString().slice(0, 10);

export type NewHireLaunchRecord = Prisma.NewHireLaunchGetPayload<{
  include: {
    team: true;
    invitation: true;
    equipmentRequest: true;
  };
}>;

export const serializeNewHirePlan = (
  team: { id: string; name: string; slug: string },
  input: NewHireLaunchInput,
  policies: TimeOffPolicy[]
) => {
  const bundle = equipmentPackage(input.equipmentPackage);
  return {
    status: 'PLANNED' as const,
    team: { id: team.id, name: team.name, slug: team.slug },
    newHire: {
      name: input.employeeName,
      email: input.employeeEmail,
      jobTitle: input.jobTitle,
      startDate: input.startDate,
      workLocation: input.workLocation,
      timeZone: input.timeZone,
      role: input.role,
    },
    equipment: {
      package: input.equipmentPackage,
      label: bundle.label,
      item: bundle.item,
    },
    policies: policySummary(policies),
    checklist: newHirePlannedChecklist(bundle.item !== null),
    authenticated: true as const,
  };
};

export const serializeNewHireReceipt = (
  launch: NewHireLaunchRecord,
  policies: TimeOffPolicy[]
) => {
  const bundle = equipmentPackage(launch.equipmentPackage);
  return {
    status: launch.status,
    launchId: launch.id,
    team: {
      id: launch.team.id,
      name: launch.team.name,
      slug: launch.team.slug,
    },
    newHire: {
      name: launch.employeeName,
      email: launch.employeeEmail,
      jobTitle: launch.jobTitle,
      startDate: toDateOnly(launch.startDate),
      workLocation: launch.workLocation,
      timeZone: launch.timeZone,
      role: launch.role,
    },
    invitation: {
      id: launch.invitation?.id ?? null,
      status:
        launch.status === NewHireLaunchStatus.ACTIVE
          ? ('ACCEPTED' as const)
          : ('PENDING' as const),
      expiresAt: launch.invitation?.expires.toISOString() ?? null,
    },
    equipment: {
      package: launch.equipmentPackage,
      label: bundle.label,
      requestId: launch.equipmentRequest?.id ?? null,
      item: launch.equipmentRequest?.item ?? bundle.item,
      status: launch.equipmentRequest?.status ?? null,
    },
    policies: policySummary(policies),
    checklist: newHireChecklist(bundle.item !== null),
    nextSteps: [
      {
        id: 'people',
        label: 'Open people readiness',
        url: `https://app.tivmark.com/teams/${launch.team.slug}/members`,
      },
      ...(launch.equipmentRequest
        ? [
            {
              id: 'equipment',
              label: 'Open equipment request',
              url: `https://app.tivmark.com/teams/${launch.team.slug}/equipment`,
            },
          ]
        : []),
    ],
    createdAt: launch.createdAt.toISOString(),
    activatedAt: launch.activatedAt?.toISOString() ?? null,
    authenticated: true as const,
  };
};

export const assertCanLaunchNewHire = (role?: Role) => {
  if (role !== Role.OWNER && role !== Role.ADMIN) {
    throw new ApiError(403, 'Only owners and admins can launch a new hire');
  }
};
