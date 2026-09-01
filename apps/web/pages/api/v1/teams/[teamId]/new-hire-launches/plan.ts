import type { NextApiRequest, NextApiResponse } from 'next';
import { z } from 'zod';

import { requireScope } from '@/lib/api/auth';
import { methodNotAllowed, sendProblem } from '@/lib/api/http';
import { requireTeamPrincipal } from '@/lib/api/team';
import { ApiError } from '@/lib/errors';
import {
  assertCanLaunchNewHire,
  newHireLaunchInputSchema,
  serializeNewHirePlan,
} from '@/lib/new-hire';
import { prisma } from '@/lib/prisma';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    if (req.method !== 'POST') {
      return methodNotAllowed(req, res, ['POST']);
    }

    const teamIdOrSlug = z.string().parse(req.query.teamId);
    const access = await requireTeamPrincipal(
      req,
      res,
      teamIdOrSlug,
      'invitations'
    );
    requireScope(access.principal, 'equipment');
    requireScope(access.principal, 'time_off.policy');
    if (access.principal.type !== 'user') {
      throw new ApiError(403, 'A signed-in manager must launch a new hire');
    }
    assertCanLaunchNewHire(access.member?.role);

    const input = newHireLaunchInputSchema.parse(req.body);
    const [member, existingLaunch, policies] = await Promise.all([
      prisma.teamMember.findFirst({
        where: {
          teamId: access.team.id,
          user: { email: { equals: input.employeeEmail, mode: 'insensitive' } },
        },
      }),
      prisma.newHireLaunch.findUnique({
        where: {
          teamId_employeeEmail: {
            teamId: access.team.id,
            employeeEmail: input.employeeEmail,
          },
        },
      }),
      prisma.timeOffPolicy.findMany({
        where: { teamId: access.team.id },
        orderBy: { type: 'asc' },
      }),
    ]);

    if (member) {
      throw new ApiError(409, 'That person is already a member of this team');
    }
    if (existingLaunch) {
      throw new ApiError(
        409,
        'A new-hire launch already exists for that email; ask for its current status instead'
      );
    }

    return res.status(200).json({
      data: serializeNewHirePlan(access.team, input, policies),
    });
  } catch (error) {
    return sendProblem(res, error);
  }
}
