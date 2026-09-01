import {
  clearOnboardingBlueprintCookie,
  parseOnboardingBlueprint,
  safeCallbackUrl,
} from '@/lib/onboarding';

const blueprint = {
  businessName: 'Acme Studio',
  teamSize: '11-50',
  timeZone: 'America/Los_Angeles',
  primaryGoal: 'BOTH',
  vacationAllowanceDays: 20,
  sickAllowanceDays: 10,
  personalAllowanceDays: 3,
};

describe('onboarding continuity data', () => {
  it('accepts the bounded cookie shape and rejects invalid time zones or allowance values', () => {
    expect(
      parseOnboardingBlueprint(encodeURIComponent(JSON.stringify(blueprint)))
    ).toEqual(blueprint);
    expect(
      parseOnboardingBlueprint({ ...blueprint, timeZone: 'Mars/Olympus' })
    ).toBeUndefined();
    expect(
      parseOnboardingBlueprint({ ...blueprint, vacationAllowanceDays: 366 })
    ).toBeUndefined();
  });

  it('permits only same-origin relative callbacks', () => {
    expect(safeCallbackUrl('/onboarding', '/dashboard')).toBe('/onboarding');
    expect(safeCallbackUrl('//evil.example', '/dashboard')).toBe('/dashboard');
    expect(safeCallbackUrl('/\\evil.example', '/dashboard')).toBe('/dashboard');
    expect(safeCallbackUrl('https://evil.example', '/dashboard')).toBe(
      '/dashboard'
    );
  });

  it('clears the shared cookie securely in production only', () => {
    expect(clearOnboardingBlueprintCookie('app.tivmark.com')).toContain(
      'Domain=.tivmark.com; Secure'
    );
    expect(clearOnboardingBlueprintCookie('localhost:4002')).not.toContain(
      'Domain='
    );
  });
});
