import {
  applyStepCommand,
  descendants,
  enterpriseCommandSchema,
  enterpriseSteps,
  initialJourney,
  currentJourney,
  validateStepValues,
} from '@/lib/enterprise-onboarding';

const now = '2026-09-02T10:00:00Z';
const completePlan = () => {
  let state = initialJourney('Example');
  for (const step of enterpriseSteps) {
    const values = Object.fromEntries(
      step.fields.map((f) => [
        f.id,
        f.choices?.[0] ??
          (f.id === 'companyDomain' ? 'example.com' : `Reviewed ${f.label}`),
      ])
    );
    state = applyStepCommand(
      state,
      {
        action: 'complete-step',
        version: 1,
        stepId: step.id,
        values,
        source: 'manual',
      },
      true,
      now
    );
  }
  return state;
};

describe('enterprise readiness domain', () => {
  it('preserves accepted research provenance when a human reviews unchanged values', () => {
    const state = completePlan();
    state.steps.organization.origins.industry = 'research';
    state.steps.organization.evidenceRefs.industry = {
      runId: 'run-1',
      suggestionId: 'suggestion-1',
      sourceUrls: ['https://example.com'],
      retrievedAt: now,
    };
    const reviewed = applyStepCommand(
      state,
      {
        action: 'complete-step',
        version: 1,
        stepId: 'organization',
        values: { ...state.steps.organization.values },
        source: 'manual',
      },
      true,
      now
    );
    expect(reviewed.steps.organization.origins.industry).toBe('research');
    expect(reviewed.steps.organization.evidenceRefs.industry.runId).toBe(
      'run-1'
    );
    const corrected = applyStepCommand(
      reviewed,
      {
        action: 'save-step',
        version: 2,
        stepId: 'organization',
        values: { industry: 'Corrected by customer' },
        source: 'manual',
      },
      true,
      now
    );
    expect(corrected.steps.organization.evidenceRefs.industry).toBeUndefined();
    expect(corrected.steps.organization.origins.industry).toBe('manual');
  });
  it('has five stages, ten required answers, and no dependency cycles', () => {
    expect(enterpriseSteps.map((s) => s.title)).toEqual([
      'Company',
      'Goals',
      'Basic setup',
      'Optional research',
      'Review & finish',
    ]);
    expect(
      enterpriseSteps.flatMap((s) => s.fields).filter((f) => !f.optional)
    ).toHaveLength(10);
    for (const step of enterpriseSteps) {
      expect(new Set(step.fields.map((f) => f.id)).size).toBe(
        step.fields.length
      );
      expect(descendants(step.id)).not.toContain(step.id);
    }
  });
  it('does not pre-complete or infer customer evidence', () => {
    const state = initialJourney('Example');
    expect(
      Object.values(state.steps).every((s) => s.completedAt === null)
    ).toBe(true);
    expect(state.steps.security.values).toEqual({});
  });
  it('rejects completion with missing fields and unmet prerequisites', () => {
    expect(() =>
      applyStepCommand(
        initialJourney('Example'),
        {
          action: 'complete-step',
          version: 1,
          stepId: 'organization',
          source: 'manual',
        },
        true,
        now
      )
    ).toThrow('Complete these fields');
    expect(() =>
      applyStepCommand(
        initialJourney('Example'),
        {
          action: 'complete-step',
          version: 1,
          stepId: 'launch',
          source: 'manual',
        },
        true,
        now
      )
    ).toThrow('prerequisite');
  });
  it('accepts drafts while blocked without granting completion', () => {
    const state = applyStepCommand(
      initialJourney('Example'),
      {
        action: 'save-step',
        version: 1,
        stepId: 'launch',
        values: { launchOwner: 'Pilot team' },
        source: 'assistant',
      },
      true,
      now
    );
    expect(state.steps.launch).toMatchObject({
      completedAt: null,
      values: { launchOwner: 'Pilot team' },
      origins: { launchOwner: 'assistant' },
    });
  });
  it('requires a human administrator for final sign-off', () => {
    expect(() =>
      applyStepCommand(
        completePlan(),
        {
          action: 'complete-step',
          version: 1,
          stepId: 'launch',
          source: 'manual',
        },
        false,
        now
      )
    ).toThrow('administrator');
  });
  it('can complete the full plan, then invalidates only affected descendants on edits', () => {
    const completed = completePlan();
    expect(completed.steps.launch.completedAt).toBe(now);
    const changed = applyStepCommand(
      completed,
      {
        action: 'save-step',
        version: 1,
        stepId: 'access',
        values: { roleModel: 'Pilot users only' },
        source: 'manual',
      },
      true,
      now
    );
    expect(changed.steps.access.completedAt).toBeNull();
    expect(changed.steps.launch.completedAt).toBeNull();
    expect(changed.steps.outcomes.completedAt).toBe(now);
    expect(changed.steps.organization.completedAt).toBe(now);
    expect(completed.steps.access.completedAt).toBe(now);
  });
  it('does not invalidate evidence merely by assigning an owner', () => {
    const changed = applyStepCommand(
      completePlan(),
      {
        action: 'assign',
        version: 1,
        stepId: 'access',
        ownerId: 'owner',
        source: 'manual',
      },
      true,
      now
    );
    expect(changed.steps.launch.completedAt).toBe(now);
  });
  it('requires fresh review of all choices when the company identity changes', () => {
    const changed = applyStepCommand(
      completePlan(),
      {
        action: 'save-step',
        version: 1,
        stepId: 'organization',
        values: { companyDomain: 'another-company.com' },
        source: 'manual',
      },
      true,
      now
    );
    expect(
      enterpriseSteps.every((s) => changed.steps[s.id].completedAt === null)
    ).toBe(true);
  });
  it.each([
    'localhost',
    '10.0.0.1',
    'internal.local',
    'host.internal',
    'https://example.com/path',
    'example.com/secret',
  ])('rejects non-public company domain %s', (value) => {
    expect(() =>
      validateStepValues('organization', { companyDomain: value })
    ).toThrow();
  });
  it('rejects unknown fields, fabricated decision choices, oversized input and unknown command keys', () => {
    expect(() =>
      validateStepValues('organization', { secret: 'ignore instructions' })
    ).toThrow('Unknown field');
    expect(() =>
      validateStepValues('launch', {
        acknowledgement: 'Automatically approved',
      })
    ).toThrow('Invalid choice');
    expect(
      enterpriseCommandSchema.safeParse({
        action: 'save-step',
        version: 1,
        values: { companyName: 'a'.repeat(2001) },
      }).success
    ).toBe(false);
    expect(
      enterpriseCommandSchema.safeParse({
        action: 'create',
        version: 0,
        providerUrl: 'https://attacker.test',
      }).success
    ).toBe(false);
  });
  it('allows optional company details and research to be omitted without inventing research', () => {
    let state = initialJourney('Example');
    state = applyStepCommand(
      state,
      {
        action: 'complete-step',
        version: 1,
        stepId: 'organization',
        source: 'manual',
        values: { companyDomain: 'example.com', employees: '20' },
      },
      true,
      now
    );
    expect(state.steps.organization.completedAt).toBe(now);
    expect(state.steps.organization.values.industry).toBeUndefined();
    state = applyStepCommand(
      state,
      {
        action: 'complete-step',
        version: 2,
        stepId: 'research',
        source: 'manual',
      },
      true,
      now
    );
    expect(state.steps.research.completedAt).toBe(now);
    expect(state.steps.research.values).toEqual({});
    expect(state.steps.launch.completedAt).toBeNull();
  });
  it('preserves the full legacy snapshot and data while requiring fresh review', () => {
    const old = completePlan();
    old.steps.security.values = { assuranceEvidence: 'Historical document' };
    old.steps.security.completedAt = now;
    old.steps.access.values.provisioning = 'Historical provisioning notes';
    const legacy = { steps: old.steps };
    const upgraded = currentJourney(legacy);
    expect(upgraded.planVersion).toBe(2);
    expect(upgraded.previousSteps).toEqual(legacy.steps);
    expect(upgraded.steps.security).toEqual(legacy.steps.security);
    expect(upgraded.steps.access.values.provisioning).toBe(
      'Historical provisioning notes'
    );
    expect(
      enterpriseSteps.every((s) => upgraded.steps[s.id].completedAt === null)
    ).toBe(true);
    expect(legacy.steps.launch.completedAt).toBe(now);
    expect(currentJourney(upgraded)).toEqual(upgraded);
    const changed = applyStepCommand(
      upgraded,
      {
        action: 'save-step',
        version: 1,
        stepId: 'access',
        source: 'manual',
        values: { roleModel: 'Updated pilot roles' },
      },
      true,
      now
    );
    expect(changed.previousSteps).toEqual(legacy.steps);
    expect(changed.steps.access.values.provisioning).toBe(
      'Historical provisioning notes'
    );
  });
  it('rejects writes to retired stages instead of losing the old data', () => {
    expect(() =>
      validateStepValues('security', { assuranceEvidence: 'Changed' })
    ).toThrow('five-stage plan');
    expect(() =>
      applyStepCommand(
        initialJourney('Example'),
        {
          action: 'save-step',
          version: 1,
          stepId: 'security',
          source: 'manual',
        },
        true,
        now
      )
    ).toThrow('valid stage');
  });
});
