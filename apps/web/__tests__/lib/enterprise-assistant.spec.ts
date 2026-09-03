import { enterpriseAssistantWorkspace } from '../../lib/enterprise-assistant';
import {
  enterpriseSteps,
  enterpriseWorkspaceSchema,
  initialJourney,
} from '../../lib/enterprise-onboarding';

function workspace() {
  const state = initialJourney('Example');
  return enterpriseWorkspaceSchema.parse({
    id: 'plan',
    team: 'example',
    teamName: 'Example',
    version: 5,
    status: 'ACTIVE',
    canManage: true,
    currentUserId: 'owner',
    createdAt: '2026-09-03T00:00:00Z',
    updatedAt: '2026-09-03T01:00:00Z',
    url: 'https://app.tivmark.com/teams/example/enterprise-onboarding',
    nextAction: 'Complete Company',
    boundary: 'This saves a plan only.',
    researchAvailable: true,
    members: [{ id: 'owner', name: 'Owner', role: 'owner' }],
    metrics: {
      complete: 0,
      total: 5,
      manualFields: 1,
      assistedFields: 0,
      blockers: 1,
    },
    steps: enterpriseSteps.map((s) => ({
      ...s,
      ...state.steps[s.id],
      adminOnly: !!s.adminOnly,
      state: 'ready',
      missing: s.fields.filter((f) => !f.optional).map((f) => f.label),
    })),
    events: [
      { id: 'event', actor: 'Owner', message: 'Created', createdAt: 'today' },
    ],
    research: {
      id: 'research',
      status: 'SUCCEEDED',
      attempts: 1,
      model: 'gemini-flash-latest',
      error: null,
      stale: false,
      acceptedIds: ['suggestion'],
      createdAt: '2026-09-03T00:00:00Z',
      evidence: {
        report: 'Full report belongs on the website only.',
        sources: [
          { id: 'source', title: 'Example', url: 'https://example.com' },
        ],
        claims: [
          { id: 'claim', text: 'Company context', sourceIds: ['source'] },
        ],
        suggestions: [
          {
            id: 'suggestion',
            stepId: 'organization',
            fieldId: 'industry',
            value: 'Software',
            kind: 'sourced',
            sourceIds: ['source'],
          },
        ],
        unknowns: ['Competitors'],
        model: 'gemini-flash-latest',
        retrievedAt: '2026-09-03T00:00:00Z',
        inputTokens: 100,
        outputTokens: 50,
      },
    },
  });
}

describe('assistant workspace response projection', () => {
  it('removes every web-only field that caused output_invalid without mutating the web response', () => {
    const full = workspace();
    const before = JSON.stringify(full);
    const result = enterpriseAssistantWorkspace(full);
    expect(result).not.toHaveProperty('createdAt');
    expect(result).not.toHaveProperty('updatedAt');
    expect(result).not.toHaveProperty('events');
    expect(result.research).not.toHaveProperty('createdAt');
    expect(result.research?.evidence).not.toHaveProperty('report');
    for (const s of result.steps)
      for (const f of s.fields) expect(f).not.toHaveProperty('optional');
    expect(result.steps).toHaveLength(5);
    expect(result.steps.map((s) => s.missing)).toEqual(
      full.steps.map((s) => s.missing)
    );
    expect(result.research?.evidence?.sources).toEqual(
      full.research?.evidence?.sources
    );
    expect(result.research?.evidence?.suggestions).toEqual(
      full.research?.evidence?.suggestions
    );
    expect(result.research?.acceptedIds).toEqual(['suggestion']);
    expect(result.version).toBe(5);
    expect(JSON.stringify(full)).toBe(before);
  });

  it('supports a new plan, no research, and pending research without evidence', () => {
    const full = workspace();
    expect(
      enterpriseAssistantWorkspace({ ...full, id: null, research: null })
    ).toMatchObject({ id: null, research: null });
    full.research!.evidence = null;
    expect(enterpriseAssistantWorkspace(full).research?.evidence).toBeNull();
  });

  it('does not serialize unexpected fields injected into the response', () => {
    const full = workspace();
    Object.assign(full, { futureWebOnlyField: 'must not escape' });
    Object.assign(full.steps[0].fields[0], {
      futureWebOnlyField: 'must not escape',
    });
    const result = enterpriseAssistantWorkspace(full);
    expect(JSON.stringify(result)).not.toContain('must not escape');
  });
});
