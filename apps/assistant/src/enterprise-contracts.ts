import { z } from '@noodleseed/one';

export const enterpriseStage = z.enum([
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
]);
export const enterpriseTeam = z
  .string()
  .min(1)
  .max(50)
  .regex(/^[a-z0-9_]+(?:-[a-z0-9_]+)*$/)
  .describe(
    'Exact team slug from my_teams or verified context, never a display name.'
  );
export const enterpriseCommand = z
  .object({
    action: z.enum([
      'create',
      'save-step',
      'complete-step',
      'reopen-step',
      'assign',
      'cancel-research',
      'accept-suggestions',
    ]),
    version: z
      .number()
      .int()
      .nonnegative()
      .describe(
        'Current saved revision from enterprise_onboarding; use zero only to create.'
      ),
    stepId: enterpriseStage.optional(),
    values: z
      .record(z.string(), z.string().max(2000))
      .optional()
      .describe(
        'Only fields from the current stage schema, with user-supplied or explicitly reviewed values.'
      ),
    ownerId: z.string().uuid().nullable().optional(),
    suggestionIds: z.array(z.string().max(100)).max(60).optional(),
    source: z.literal('assistant').default('assistant'),
  })
  .strict();

// Portable response contract. Omit the verbose raw report from model context.
export const enterpriseResult = z.object({
  workspace: z.object({
    id: z.string().nullable(),
    team: enterpriseTeam,
    teamName: z.string(),
    version: z.number(),
    status: z.string(),
    canManage: z.boolean(),
    currentUserId: z.string(),
    url: z.string().url(),
    nextAction: z.string(),
    boundary: z.string(),
    researchAvailable: z.boolean(),
    metrics: z.object({
      complete: z.number(),
      total: z.number(),
      manualFields: z.number(),
      assistedFields: z.number(),
      blockers: z.number(),
    }),
    members: z
      .array(z.object({ id: z.string(), name: z.string(), role: z.string() }))
      .max(200),
    steps: z
      .array(
        z.object({
          id: enterpriseStage,
          title: z.string(),
          owner: z.string(),
          description: z.string(),
          dependsOn: z.array(enterpriseStage).max(14),
          adminOnly: z.boolean(),
          fields: z
            .array(
              z.object({
                id: z.string(),
                label: z.string(),
                hint: z.string(),
                choices: z.array(z.string()).max(10).optional(),
              })
            )
            .max(6),
          values: z.record(z.string(), z.string()),
          origins: z.record(z.string(), z.string()),
          evidenceRefs: z.record(
            z.string(),
            z.object({
              runId: z.string(),
              suggestionId: z.string(),
              sourceUrls: z.array(z.string().url()).max(40),
              retrievedAt: z.string(),
            })
          ),
          completedAt: z.string().nullable(),
          ownerId: z.string().nullable(),
          state: z.enum(['ready', 'blocked', 'complete']),
          missing: z.array(z.string()).max(6),
        })
      )
      .max(14),
    research: z
      .object({
        id: z.string(),
        status: z.string(),
        attempts: z.number(),
        model: z.string(),
        error: z.string().nullable(),
        stale: z.boolean(),
        acceptedIds: z.array(z.string()).max(60),
        evidence: z
          .object({
            sources: z
              .array(
                z.object({
                  id: z.string(),
                  title: z.string(),
                  url: z.string().url(),
                })
              )
              .max(40),
            claims: z
              .array(
                z.object({
                  id: z.string(),
                  text: z.string(),
                  sourceIds: z.array(z.string()).max(40),
                })
              )
              .max(60),
            suggestions: z
              .array(
                z.object({
                  id: z.string(),
                  stepId: enterpriseStage,
                  fieldId: z.string(),
                  value: z.string(),
                  kind: z.enum(['sourced', 'recommendation']),
                  sourceIds: z.array(z.string()).max(40),
                })
              )
              .max(40),
            unknowns: z.array(z.string()).max(15),
            model: z.string(),
            retrievedAt: z.string(),
            inputTokens: z.number(),
            outputTokens: z.number(),
          })
          .nullable(),
      })
      .nullable(),
  }),
});
