import { z } from 'zod';

export const ONBOARDING_BLUEPRINT_COOKIE = 'tiv_onboarding_blueprint';
export const ONBOARDING_BLUEPRINT_MAX_AGE_SECONDS = 60 * 60;

export const businessSizeBands = ['1-10', '11-50', '51-200', '201+'] as const;
export const onboardingGoals = ['TIME_OFF', 'EQUIPMENT', 'BOTH'] as const;

export const onboardingBlueprintSchema = z.object({
  businessName: z.string().trim().min(3).max(100),
  teamSize: z.enum(businessSizeBands),
  timeZone: z
    .string()
    .trim()
    .min(1)
    .max(100)
    .refine((value) => {
      try {
        Intl.DateTimeFormat('en-US', { timeZone: value });
        return true;
      } catch {
        return false;
      }
    }, 'Use an IANA time zone such as America/Los_Angeles'),
  primaryGoal: z.enum(onboardingGoals),
  vacationAllowanceDays: z.number().int().min(0).max(365),
  sickAllowanceDays: z.number().int().min(0).max(365),
  personalAllowanceDays: z.number().int().min(0).max(365),
});

export type OnboardingBlueprint = z.infer<typeof onboardingBlueprintSchema>;

export function parseOnboardingBlueprint(
  value: unknown
): OnboardingBlueprint | undefined {
  let candidate = value;
  if (typeof value === 'string') {
    try {
      candidate = JSON.parse(decodeURIComponent(value));
    } catch {
      return undefined;
    }
  }

  const parsed = onboardingBlueprintSchema.safeParse(candidate);
  return parsed.success ? parsed.data : undefined;
}

export function clearOnboardingBlueprintCookie(host?: string) {
  const production = host === 'tivmark.com' || host?.endsWith('.tivmark.com');
  return (
    `${ONBOARDING_BLUEPRINT_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax` +
    (production ? '; Domain=.tivmark.com; Secure' : '')
  );
}

export function goalLabel(goal: string) {
  if (goal === 'TIME_OFF') return 'Time off';
  if (goal === 'EQUIPMENT') return 'Equipment';
  if (goal === 'BOTH') return 'Time off and equipment';
  return 'Not set';
}

export function safeCallbackUrl(value: unknown, fallback: string) {
  return typeof value === 'string' &&
    value.startsWith('/') &&
    !value.startsWith('//') &&
    !value.includes('\\')
    ? value
    : fallback;
}
