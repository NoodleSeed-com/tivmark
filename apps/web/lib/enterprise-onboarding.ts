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
type Field = { id: string; label: string; hint: string; choices?: string[] };
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

export const enterpriseSteps: Step[] = [
  {
    id: 'organization',
    title: 'Organization profile',
    owner: 'Project owner',
    description: 'Establish the organization this readiness plan covers.',
    dependsOn: [],
    fields: [
      field('companyName', 'Company name', 'The organization being onboarded.'),
      field(
        'companyDomain',
        'Public company domain',
        'A public business domain, for example example.com. No internal addresses.'
      ),
      field('industry', 'Industry', 'Your primary business sector.'),
      field(
        'headquarters',
        'Headquarters / operating regions',
        'Business locations, not personal addresses.'
      ),
      field('employees', 'Team size', 'Approximate number of people in scope.'),
    ],
  },
  {
    id: 'outcomes',
    title: 'Outcomes & launch target',
    owner: 'Business sponsor',
    description:
      'Agree what success looks like before configuring the product.',
    dependsOn: ['organization'],
    fields: [
      field(
        'useCases',
        'Priority use cases',
        'Which two or three workflows should improve?'
      ),
      field(
        'successMetric',
        'Success measure',
        'A measurable result and how you will verify it.'
      ),
      field(
        'targetDate',
        'Target launch date',
        'An agreed target, not a promise that all dependencies are ready.'
      ),
    ],
  },
  {
    id: 'stakeholders',
    title: 'Stakeholders & ownership',
    owner: 'Project owner',
    description:
      'Make cross-functional responsibilities explicit. Assign each stage to an existing team member.',
    dependsOn: ['organization'],
    fields: [
      field(
        'sponsor',
        'Business sponsor',
        'Role or team accountable for the outcome.'
      ),
      field(
        'itOwner',
        'IT owner',
        'Team responsible for identity and integrations.'
      ),
      field(
        'securityOwner',
        'Security / privacy owner',
        'Team reviewing data and access.'
      ),
      field(
        'dataOwner',
        'Data owner',
        'Team accountable for migration quality.'
      ),
    ],
  },
  {
    id: 'research',
    title: 'Company & market context',
    owner: 'Project owner',
    description:
      'Use cited public research or customer-supplied context. Research never establishes compliance or eligibility.',
    dependsOn: ['organization'],
    fields: [
      field(
        'companySummary',
        'Company summary',
        'Review the company description and its evidence.'
      ),
      field(
        'competitors',
        'Competitive context',
        'Relevant competitors, or explain why this is not needed.'
      ),
      field(
        'customerSegments',
        'Customer segments',
        'Publicly supported segments, not private customer lists.'
      ),
      field(
        'researchCaveats',
        'Evidence / unknowns',
        'Sources, uncertainty, conflicting information, or a reason to use customer-provided context instead.'
      ),
    ],
  },
  {
    id: 'security',
    title: 'Security review',
    owner: 'Security',
    description:
      'Record your actual review. This workspace does not issue security certifications.',
    dependsOn: ['stakeholders'],
    fields: [
      field(
        'assuranceEvidence',
        'Assurance evidence',
        'Document reference and revision reviewed, or a documented exception.'
      ),
      field(
        'accessReview',
        'Access review',
        'Who reviewed least privilege and administrative access?'
      ),
      field(
        'incidentContact',
        'Incident escalation route',
        'A team channel or operational route; do not enter secrets.'
      ),
      field(
        'securityDecision',
        'Review outcome',
        'Record the accountable reviewer’s decision.',
        ['Approved for pilot', 'Approved with documented exceptions']
      ),
    ],
  },
  {
    id: 'privacy',
    title: 'Privacy & data handling',
    owner: 'Privacy',
    description: 'Agree data handling with your accountable reviewer.',
    dependsOn: ['security'],
    fields: [
      field(
        'dataClasses',
        'Data classes',
        'Categories only. Do not upload personal records.'
      ),
      field(
        'retentionDays',
        'Retention policy',
        'Retention duration and deletion procedure.'
      ),
      field(
        'residency',
        'Residency requirements',
        'Required geography and any approved exceptions.'
      ),
      field(
        'privacyDecision',
        'Privacy approval evidence',
        'Approval reference, reviewer, and date.'
      ),
    ],
  },
  {
    id: 'access',
    title: 'Identity & permissions',
    owner: 'IT',
    description:
      'Document and verify setup in the identity system. Saving this plan does not configure SSO or SCIM.',
    dependsOn: ['stakeholders'],
    fields: [
      field(
        'identityProvider',
        'Identity provider',
        'Your chosen provider or an approved password-based pilot.'
      ),
      field(
        'provisioning',
        'Provisioning method',
        'How accounts are created and removed.'
      ),
      field(
        'roleModel',
        'Role mapping',
        'Map administrators, managers, and end users.'
      ),
      field(
        'accessEvidence',
        'Access-test evidence',
        'Record a real login and deprovisioning test or a documented pilot exception.'
      ),
    ],
  },
  {
    id: 'integrations',
    title: 'Integration readiness',
    owner: 'IT',
    description:
      'Record systems, permissions, and connection tests; no third-party connection is created here.',
    dependsOn: ['access'],
    fields: [
      field(
        'systems',
        'Systems in scope',
        'Required systems, or explicitly state none for the pilot.'
      ),
      field(
        'permissionScope',
        'Approved permissions',
        'Minimum scopes and data access.'
      ),
      field(
        'integrationEvidence',
        'Connection-test evidence',
        'Record actual test results or an approved exception.'
      ),
    ],
  },
  {
    id: 'migration',
    title: 'Data mapping & migration',
    owner: 'Data',
    description:
      'Plan the migration and record sample validation. This does not import customer records.',
    dependsOn: ['privacy', 'integrations'],
    fields: [
      field(
        'sourceSystems',
        'Source inventory',
        'Data sources, volumes, and owners, or no migration required.'
      ),
      field(
        'fieldMapping',
        'Field mapping',
        'Required source-to-target mappings.'
      ),
      field(
        'validationRules',
        'Validation evidence',
        'Record checks for required values, duplicates, and sample results.'
      ),
      field(
        'rollbackPlan',
        'Rollback / recovery',
        'How the owner will reverse or repair the migration.'
      ),
    ],
  },
  {
    id: 'policy',
    title: 'Operating model',
    owner: 'Business operations',
    description: 'Agree how the service will be operated after launch.',
    dependsOn: ['outcomes'],
    fields: [
      field(
        'operatingPolicy',
        'Operating policy',
        'Approval rules and applicable business policies.'
      ),
      field('supportOwner', 'Support owner', 'The accountable support team.'),
      field(
        'escalationPath',
        'Escalation path',
        'Response targets and escalation ownership.'
      ),
    ],
  },
  {
    id: 'pilot',
    title: 'Pilot & acceptance',
    owner: 'Project owner',
    description: 'A real pilot outcome is needed before readiness approval.',
    dependsOn: ['migration', 'policy'],
    fields: [
      field(
        'pilotCohort',
        'Pilot cohort',
        'Teams and size; avoid personal data.'
      ),
      field(
        'acceptanceCriteria',
        'Acceptance criteria',
        'Observable tests tied to the success measure.'
      ),
      field(
        'pilotEvidence',
        'Pilot results',
        'Actual outcomes, unresolved issues, and approved exceptions.'
      ),
    ],
  },
  {
    id: 'enablement',
    title: 'Training & support handoff',
    owner: 'Customer success',
    description: 'Prepare the people who will use and support the product.',
    dependsOn: ['policy'],
    fields: [
      field('trainingPlan', 'Training plan', 'Roles, materials, and sessions.'),
      field(
        'supportHandoff',
        'Support handoff',
        'Runbooks and escalation recipients.'
      ),
      field(
        'supportEvidence',
        'Handoff evidence',
        'Record readiness acknowledgement from the receiving team.'
      ),
    ],
  },
  {
    id: 'approval',
    title: 'Readiness sign-off',
    owner: 'Administrator',
    description:
      'An owner or administrator reviews all completed evidence and remaining exceptions.',
    dependsOn: ['research', 'pilot', 'enablement'],
    adminOnly: true,
    fields: [
      field(
        'approvalSummary',
        'Approval rationale',
        'Summarize the evidence, accepted exceptions, and accountable decision.'
      ),
    ],
  },
  {
    id: 'launch',
    title: 'Launch handoff',
    owner: 'Administrator',
    description:
      'Approve this documented readiness plan. External systems and production cutover remain the accountable teams’ responsibility.',
    dependsOn: ['approval'],
    adminOnly: true,
    fields: [
      field(
        'launchDate',
        'Agreed handoff date',
        'The agreed operational handoff date.'
      ),
      field(
        'launchOwner',
        'Launch owner',
        'Team accountable for actual production cutover.'
      ),
      field(
        'acknowledgement',
        'Readiness boundary',
        'Confirm what this action does.',
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
  steps: z.record(stepStateSchema),
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
  const step = enterpriseSteps.find((s) => s.id === id)!;
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
  const next: JourneyState = JSON.parse(JSON.stringify(state));
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
      const missing = step.fields.filter((f) => !current.values[f.id]?.trim());
      if (missing.length)
        throw new Error(
          `Complete these fields: ${missing.map((f) => f.label).join(', ')}`
        );
      current.completedAt = now;
    }
  }
  for (const id of descendants(step.id)) next.steps[id].completedAt = null;
  return next;
}
