import { z } from 'zod';
import {
  enterpriseWorkspaceSchema,
  evidenceSchema,
  type EnterpriseWorkspace,
} from './enterprise-onboarding';

const step = enterpriseWorkspaceSchema.shape.steps.element;
const research = enterpriseWorkspaceSchema.shape.research.unwrap();

// Match apps/assistant/src/enterprise-contracts.ts. MCP validates the emitted
// JSON Schema with additionalProperties:false; a Zod parse that merely succeeds
// does not prove that the original, unprojected response satisfies that schema.
// Required answers remain available in each step's `missing` list.
export const enterpriseAssistantWorkspaceSchema = enterpriseWorkspaceSchema
  .pick({
    id: true,
    team: true,
    teamName: true,
    version: true,
    status: true,
    canManage: true,
    currentUserId: true,
    url: true,
    nextAction: true,
    boundary: true,
    researchAvailable: true,
    metrics: true,
    members: true,
  })
  .extend({
    steps: z.array(
      step
        .pick({
          id: true,
          title: true,
          owner: true,
          description: true,
          dependsOn: true,
          adminOnly: true,
          values: true,
          origins: true,
          evidenceRefs: true,
          completedAt: true,
          ownerId: true,
          state: true,
          missing: true,
        })
        .extend({
          fields: z.array(
            step.shape.fields.element.pick({
              id: true,
              label: true,
              hint: true,
              choices: true,
            })
          ),
        })
    ),
    research: research
      .pick({
        id: true,
        status: true,
        attempts: true,
        model: true,
        error: true,
        stale: true,
        acceptedIds: true,
      })
      .extend({
        evidence: evidenceSchema
          .pick({
            sources: true,
            claims: true,
            suggestions: true,
            unknowns: true,
            model: true,
            retrievedAt: true,
            inputTokens: true,
            outputTokens: true,
          })
          .nullable(),
      })
      .nullable(),
  });

export function enterpriseAssistantWorkspace(workspace: EnterpriseWorkspace) {
  return enterpriseAssistantWorkspaceSchema.parse(workspace);
}
