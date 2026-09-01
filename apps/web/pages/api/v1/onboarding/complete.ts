import type { NextApiRequest, NextApiResponse } from 'next';
import { Role, TimeOffType } from '@prisma/client';

import { requireApiPrincipal, requireScope } from '@/lib/api/auth';
import { methodNotAllowed, sendProblem } from '@/lib/api/http';
import { withIdempotency } from '@/lib/api/idempotency';
import { goalLabel, onboardingBlueprintSchema } from '@/lib/onboarding';
import { prisma } from '@/lib/prisma';
import { ApiError } from '@/lib/errors';
import { slugify } from '@/lib/server-common';
import { createTeam } from 'models/team';

const policyInputs = (
  input: ReturnType<typeof onboardingBlueprintSchema.parse>
) => [
  {
    type: TimeOffType.VACATION,
    annualAllowanceHalfDays: input.vacationAllowanceDays * 2,
  },
  {
    type: TimeOffType.SICK,
    annualAllowanceHalfDays: input.sickAllowanceDays * 2,
  },
  {
    type: TimeOffType.PERSONAL,
    annualAllowanceHalfDays: input.personalAllowanceDays * 2,
  },
  {
    type: TimeOffType.UNPAID,
    annualAllowanceHalfDays: null,
  },
];

async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== 'POST') {
      return methodNotAllowed(req, res, ['POST']);
    }

    const principal = await requireApiPrincipal(req, res);
    requireScope(principal, 'teams');
    requireScope(principal, 'time_off.policy');
    if (principal.type !== 'user') {
      throw new ApiError(403, 'Only a signed-in person can create a workspace');
    }

    const input = onboardingBlueprintSchema.parse(req.body);
    let membership = await prisma.teamMember.findFirst({
      where: {
        userId: principal.userId,
        role: Role.OWNER,
        team: {
          name: { equals: input.businessName, mode: 'insensitive' },
        },
      },
      include: { team: true },
      orderBy: { createdAt: 'desc' },
    });

    // New signups already own the prefilled team. Existing Tivmark users may run the same
    // public onboarding flow, so create a new business only when no matching owned team exists.
    if (!membership) {
      const slugBase = slugify(input.businessName);
      const collision = await prisma.team.count({ where: { slug: slugBase } });
      const team = await createTeam({
        userId: principal.userId,
        name: input.businessName,
        slug: collision ? `${slugBase}-${Date.now().toString(36)}` : slugBase,
      });
      membership = await prisma.teamMember.findUniqueOrThrow({
        where: {
          teamId_userId: { teamId: team.id, userId: principal.userId },
        },
        include: { team: true },
      });
    }

    const completedAt = membership.team.onboardingCompletedAt ?? new Date();
    const configured = await prisma.$transaction(async (tx) => {
      const team = await tx.team.update({
        where: { id: membership.teamId },
        data: {
          name: input.businessName,
          businessSizeBand: input.teamSize,
          timeZone: input.timeZone,
          onboardingGoal: input.primaryGoal,
          onboardingCompletedAt: completedAt,
        },
      });

      for (const policy of policyInputs(input)) {
        await tx.timeOffPolicy.upsert({
          where: {
            teamId_type: { teamId: membership.teamId, type: policy.type },
          },
          create: { teamId: membership.teamId, ...policy },
          update: {
            annualAllowanceHalfDays: policy.annualAllowanceHalfDays,
          },
        });
      }

      const policies = await tx.timeOffPolicy.findMany({
        where: { teamId: membership.teamId },
        orderBy: { type: 'asc' },
      });
      return { team, policies };
    });

    return res.status(200).json({
      data: {
        status: 'READY',
        team: {
          id: configured.team.id,
          name: configured.team.name,
          slug: configured.team.slug,
          teamSize: configured.team.businessSizeBand,
          timeZone: configured.team.timeZone,
          primaryGoal: configured.team.onboardingGoal,
          primaryGoalLabel: goalLabel(input.primaryGoal),
          onboardingCompletedAt:
            configured.team.onboardingCompletedAt?.toISOString() ??
            completedAt.toISOString(),
        },
        policies: configured.policies.map((policy) => ({
          type: policy.type,
          allowanceHalfDays: policy.annualAllowanceHalfDays,
          allowanceDays:
            policy.annualAllowanceHalfDays === null
              ? null
              : policy.annualAllowanceHalfDays / 2,
        })),
        nextSteps: [
          {
            id: 'time-off',
            label: 'Review time-off workspace',
            url: `https://app.tivmark.com/teams/${configured.team.slug}/time-off`,
          },
          {
            id: 'equipment',
            label: 'Review equipment workspace',
            url: `https://app.tivmark.com/teams/${configured.team.slug}/equipment`,
          },
        ],
        authenticated: true,
      },
    });
  } catch (error) {
    return sendProblem(res, error);
  }
}

export default withIdempotency(handler);
