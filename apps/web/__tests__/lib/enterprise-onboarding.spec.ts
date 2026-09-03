import {
  applyStepCommand,
  descendants,
  enterpriseCommandSchema,
  enterpriseSteps,
  initialJourney,
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
  it('has fourteen stages, unique field ids per stage and no dependency cycles', () => {
    expect(enterpriseSteps).toHaveLength(14);
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
        stepId: 'migration',
        values: { rollbackPlan: 'Restore verified backup' },
        source: 'assistant',
      },
      true,
      now
    );
    expect(state.steps.migration).toMatchObject({
      completedAt: null,
      values: { rollbackPlan: 'Restore verified backup' },
      origins: { rollbackPlan: 'assistant' },
    });
  });
  it('requires a human administrator for final sign-off', () => {
    expect(() =>
      applyStepCommand(
        completePlan(),
        {
          action: 'complete-step',
          version: 1,
          stepId: 'approval',
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
        stepId: 'security',
        values: { incidentContact: 'New incident team' },
        source: 'manual',
      },
      true,
      now
    );
    expect(changed.steps.security.completedAt).toBeNull();
    expect(changed.steps.launch.completedAt).toBeNull();
    expect(changed.steps.approval.completedAt).toBeNull();
    expect(changed.steps.organization.completedAt).toBe(now);
    expect(completed.steps.security.completedAt).toBe(now);
  });
  it('does not invalidate evidence merely by assigning an owner', () => {
    const changed = applyStepCommand(
      completePlan(),
      {
        action: 'assign',
        version: 1,
        stepId: 'security',
        ownerId: 'owner',
        source: 'manual',
      },
      true,
      now
    );
    expect(changed.steps.launch.completedAt).toBe(now);
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
      validateStepValues('security', {
        securityDecision: 'Automatically approved',
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
});
