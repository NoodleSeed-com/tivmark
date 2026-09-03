import { z } from 'zod';

export const stepIds = [
  'organization',
  'outcomes',
  'stakeholders',
  'research',
  'security',
  'privacy',
  'access',
  'integrations',
  'migration',
  'policy',
  'pilot',
  'enablement',
  'approval',
  'launch',
] as const;
export type StepId = (typeof stepIds)[number];
type Field = {
  id: string;
  label: string;
  hint: string;
  choices?: string[];
  optional?: boolean;
};
type Step = {
  id: StepId;
  title: string;
  owner: string;
  description: string;
  dependsOn: StepId[];
  fields: Field[];
  adminOnly?: boolean;
};
const field = (
  id: string,
  label: string,
  hint: string,
  choices?: string[]
): Field => ({ id, label, hint, ...(choices ? { choices } : {}) });

// Keep the historical IDs in persisted state and API enums so old records remain readable.
// Only these five stages are offered or writable in the simplified plan.
export const enterpriseSteps: Step[] = [
  {
    id: 'organization',
    title: 'Company',
    owner: 'Project owner',
    description:
      'Tell us who you are onboarding. Industry and location can be added from reviewed research later.',
    dependsOn: [],
    fields: [
      field('companyName', 'Company name', 'The organization being onboarded.'),
      field(
        'companyDomain',
        'Public company domain',
        'For example example.com. No internal addresses.'
      ),
      field('employees', 'Team size', 'Approximate number of people in scope.'),
      {
        ...field('industry', 'Industry', 'Your primary business sector.'),
        optional: true,
      },
      {
        ...field(
          'headquarters',
          'Headquarters / operating regions',
          'Business locations, not personal addresses.'
        ),
        optional: true,
      },
    ],
  },
  {
    id: 'outcomes',
    title: 'Goals',
    owner: 'Project owner',
    description: 'Pick the first useful outcome and a target date.',
    dependsOn: [],
    fields: [
      field(
        'useCases',
        'First workflow',
        'What is the first thing your team wants to improve?'
      ),
      field(
        'successMetric',
        'Success measure',
        'How will you know it is working?'
      ),
      field(
        'targetDate',
        'Target date',
        'Your intended start date, not a verified production cutover.'
      ),
    ],
  },
  {
    id: 'access',
    title: 'Basic setup',
    owner: 'Project owner',
    description:
      'Choose how people will sign in and who needs access. This records your choices; it does not configure external systems.',
    dependsOn: [],
    fields: [
      field(
        'identityProvider',
        'Sign-in approach',
        'Your identity provider, or password-based access for a pilot.'
      ),
      field(
        'roleModel',
        'Who needs access?',
        'For example: two administrators and the pilot team.'
      ),
    ],
  },
  {
    id: 'research',
    title: 'Optional research',
    owner: 'Project owner',
    description:
      'Review public company context, add your own notes, or continue without research. No AI call is required.',
    dependsOn: [],
    fields: [
      {
        ...field(
          'companySummary',
          'Company context',
          'A short reviewed summary, if useful.'
        ),
        optional: true,
      },
      {
        ...field(
          'customerSegments',
          'Customers / audience',
          'Publicly supported segments, not private customer lists.'
        ),
        optional: true,
      },
    ],
  },
  {
    id: 'launch',
    title: 'Review & finish',
    owner: 'Administrator',
    description:
      'Review the saved choices and approve this onboarding plan. Security, legal review, migration, and production cutover remain separate work.',
    dependsOn: ['organization', 'outcomes', 'access', 'research'],
    adminOnly: true,
    fields: [
      field(
        'launchOwner',
        'Onboarding owner',
        'The person or team responsible for the next step.'
      ),
      field(
        'acknowledgement',
        'Confirm the plan',
        'Approve only after reviewing the saved information.',
        ['Approve readiness plan; external cutover is separately verified']
      ),
    ],
  },
];
export const stepStateSchema = z.object({
  values: z.record(z.string().max(2000)),
  origins: z.record(z.enum(['manual', 'assistant', 'research'])),
  evidenceRefs: z
    .record(
      z.object({
        runId: z.string(),
        suggestionId: z.string(),
        sourceUrls: z.array(z.string().url()).max(40),
        retrievedAt: z.string(),
      })
    )
    .default({}),
  completedAt: z.string().nullable(),
  ownerId: z.string().nullable(),
});
export const journeyStateSchema = z.object({
  planVersion: z.union([z.literal(1), z.literal(2)]).default(1),
  steps: z.record(stepStateSchema),
  previousSteps: z.record(stepStateSchema).optional(),
});
export type JourneyState = z.infer<typeof journeyStateSchema>;
export const sourceSchema = z.object({
  id: z.string(),
  title: z.string(),
  url: z.string().url(),
});
export const claimSchema = z.object({
  id: z.string(),
  text: z.string(),
  sourceIds: z.array(z.string()),
});
export const suggestionSchema = z.object({
  id: z.string(),
  stepId: z.enum(stepIds),
  fieldId: z.string(),
  value: z.string().max(2000),
  kind: z.enum(['sourced', 'recommendation']),
  sourceIds: z.array(z.string()),
});
export const evidenceSchema = z.object({
  report: z.string(),
  sources: z.array(sourceSchema),
  claims: z.array(claimSchema),
  suggestions: z.array(suggestionSchema),
  unknowns: z.array(z.string()),
  model: z.string(),
  retrievedAt: z.string(),
  inputTokens: z.number(),
  outputTokens: z.number(),
});
export type Evidence = z.infer<typeof evidenceSchema>;
export const enterpriseCommandSchema = z
  .object({
    action: z.enum([
      'create',
      'save-step',
      'complete-step',
      'reopen-step',
      'assign',
      'start-research',
      'cancel-research',
      'accept-suggestions',
    ]),
    version: z.number().int().nonnegative(),
    stepId: z.enum(stepIds).optional(),
    values: z.record(z.string().max(2000)).optional(),
    ownerId: z.string().uuid().nullable().optional(),
    source: z.enum(['manual', 'assistant']).default('manual'),
    suggestionIds: z.array(z.string().max(100)).max(60).optional(),
    researchConsent: z.literal(true).optional(),
    researchIdentity: z
      .object({
        companyName: z.string().min(2).max(100),
        companyDomain: z.string().min(4).max(253),
      })
      .strict()
      .optional(),
  })
  .strict();
export type EnterpriseCommand = z.infer<typeof enterpriseCommandSchema>;
export const enterpriseWorkspaceSchema = z.object({
  id: z.string().nullable(),
  team: z.string(),
  teamName: z.string(),
  version: z.number(),
  status: z.string(),
  canManage: z.boolean(),
  currentUserId: z.string(),
  createdAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
  url: z.string(),
  steps: z.array(
    z.object({
      id: z.enum(stepIds),
      title: z.string(),
      owner: z.string(),
      description: z.string(),
      dependsOn: z.array(z.enum(stepIds)),
      adminOnly: z.boolean(),
      fields: z.array(
        z.object({
          id: z.string(),
          label: z.string(),
          hint: z.string(),
          choices: z.array(z.string()).optional(),
          optional: z.boolean().optional(),
        })
      ),
      values: z.record(z.string()),
      origins: z.record(z.string()),
      evidenceRefs: z.record(
        z.object({
          runId: z.string(),
          suggestionId: z.string(),
          sourceUrls: z.array(z.string().url()).max(40),
          retrievedAt: z.string(),
        })
      ),
      completedAt: z.string().nullable(),
      ownerId: z.string().nullable(),
      state: z.enum(['blocked', 'ready', 'complete']),
      missing: z.array(z.string()),
    })
  ),
  members: z.array(
    z.object({ id: z.string(), name: z.string(), role: z.string() })
  ),
  research: z
    .object({
      id: z.string(),
      status: z.string(),
      attempts: z.number(),
      model: z.string(),
      error: z.string().nullable(),
      createdAt: z.string(),
      evidence: evidenceSchema.nullable(),
      acceptedIds: z.array(z.string()),
      stale: z.boolean(),
    })
    .nullable(),
  metrics: z.object({
    complete: z.number(),
    total: z.number(),
    manualFields: z.number(),
    assistedFields: z.number(),
    blockers: z.number(),
  }),
  events: z.array(
    z.object({
      id: z.string(),
      actor: z.string(),
      message: z.string(),
      createdAt: z.string(),
    })
  ),
  researchAvailable: z.boolean(),
  nextAction: z.string(),
  boundary: z.string(),
});
export type EnterpriseWorkspace = z.infer<typeof enterpriseWorkspaceSchema>;

export function initialJourney(companyName: string): JourneyState {
  return journeyStateSchema.parse({
    planVersion: 2,
    steps: Object.fromEntries(
      stepIds.map((id) => [
        id,
        {
          values: id === 'organization' ? { companyName } : {},
          origins: id === 'organization' ? { companyName: 'manual' } : {},
          completedAt: null,
          ownerId: null,
        },
      ])
    ),
  });
}

// Upgrade on read without a database write; persist atomically with the next
// authorized change. Preserve the full old snapshot, including attestations.
export function currentJourney(value: unknown): JourneyState {
  const state = journeyStateSchema.parse(value);
  if (state.planVersion === 2) return state;
  const next: JourneyState = {
    ...state,
    planVersion: 2,
    steps: JSON.parse(JSON.stringify(state.steps)),
    previousSteps: state.previousSteps ?? state.steps,
  };
  for (const step of enterpriseSteps) {
    next.steps[step.id] ??= initialJourney('').steps[step.id];
    next.steps[step.id].completedAt = null;
  }
  return next;
}

export function isCurrentField(stepId: string, fieldId: string) {
  return Boolean(
    enterpriseSteps
      .find((s) => s.id === stepId)
      ?.fields.some((f) => f.id === fieldId)
  );
}

export function descendants(id: StepId): StepId[] {
  const found = new Set<StepId>();
  const visit = (parent: StepId) =>
    enterpriseSteps
      .filter((s) => s.dependsOn.includes(parent))
      .forEach((s) => {
        if (!found.has(s.id)) {
          found.add(s.id);
          visit(s.id);
        }
      });
  visit(id);
  return Array.from(found);
}

export function validateStepValues(id: StepId, values: Record<string, string>) {
  const step = enterpriseSteps.find((s) => s.id === id);
  if (!step) throw new Error('This stage is not part of the five-stage plan');
  const clean: Record<string, string> = {};
  for (const [key, raw] of Object.entries(values)) {
    const definition = step.fields.find((f) => f.id === key);
    if (!definition) throw new Error(`Unknown field: ${key}`);
    const value = raw.trim();
    if (definition.choices && value && !definition.choices.includes(value))
      throw new Error(`Invalid choice for ${definition.label}`);
    if (
      key === 'companyDomain' &&
      value &&
      !/^(?!.*(?:localhost|\.local$|\.internal$))(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i.test(
        value
      )
    )
      throw new Error('Enter a public company domain, without a URL path');
    clean[key] = value;
  }
  return clean;
}

export function applyStepCommand(
  state: JourneyState,
  command: EnterpriseCommand,
  admin: boolean,
  now: string
): JourneyState {
  const next: JourneyState = JSON.parse(JSON.stringify(currentJourney(state)));
  const step = enterpriseSteps.find((s) => s.id === command.stepId);
  if (!step) throw new Error('Choose a valid stage');
  if (step.adminOnly && !admin)
    throw new Error('Only an owner or administrator can change this stage');
  const current = next.steps[step.id];
  if (command.action === 'assign') {
    current.ownerId = command.ownerId ?? null;
    return next;
  }
  if (command.action === 'reopen-step') {
    current.completedAt = null;
  } else {
    const values = validateStepValues(step.id, command.values ?? {});
    for (const [key, value] of Object.entries(values)) {
      if (current.values[key] !== value) {
        current.values[key] = value;
        current.origins[key] = command.source;
        delete current.evidenceRefs[key];
      }
    }
    current.completedAt = null;
    if (command.action === 'complete-step') {
      if (step.dependsOn.some((id) => !next.steps[id].completedAt))
        throw new Error('Complete the prerequisite stages first');
      const missing = step.fields.filter(
        (f) => !f.optional && !current.values[f.id]?.trim()
      );
      if (missing.length)
        throw new Error(
          `Complete these fields: ${missing.map((f) => f.label).join(', ')}`
        );
      current.completedAt = now;
    }
  }
  for (const id of descendants(step.id)) next.steps[id].completedAt = null;
  if (
    step.id === 'organization' &&
    ['companyName', 'companyDomain'].some(
      (id) =>
        next.steps.organization.values[id] !==
        state.steps.organization.values[id]
    )
  ) {
    // A different organization needs fresh review of every saved choice.
    for (const active of enterpriseSteps) {
      if (active.id !== step.id) next.steps[active.id].completedAt = null;
    }
  }
  return next;
}
