import type { NextApiRequest, NextApiResponse } from 'next';
import { z } from 'zod';

import { methodNotAllowed, sendProblem } from '@/lib/api/http';
import { requireTeamPrincipal } from '@/lib/api/team';
import { ApiError } from '@/lib/errors';
import {
  ensureDefaultTimeOffPolicies,
  updateTimeOffPolicies,
} from 'models/timeOff';

const policySchema = z.object({
  allowances: z.object({
    VACATION: z.number().int().min(0).max(730).nullable(),
    SICK: z.number().int().min(0).max(730).nullable(),
    PERSONAL: z.number().int().min(0).max(730).nullable(),
    UNPAID: z.number().int().min(0).max(730).nullable(),
  }),
  actorUserId: z.string().uuid().optional(),
});

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const access = await requireTeamPrincipal(
      req,
      res,
      z.string().parse(req.query.teamId),
      'time_off.policy'
    );
    await ensureDefaultTimeOffPolicies(access.team.id);

    if (req.method === 'GET') {
      const policies = await (
        await import('@/lib/prisma')
      ).prisma.timeOffPolicy.findMany({
        where: { teamId: access.team.id },
        orderBy: { type: 'asc' },
      });
      return res
        .status(200)
        .json({ data: policies, meta: { nextCursor: null } });
    }

    if (req.method === 'PATCH') {
      const input = policySchema.parse(req.body);
      let member = access.member;
      if (!member) {
        const actorUserId = z.string().uuid().parse(input.actorUserId);
        member = await (
          await import('@/lib/prisma')
        ).prisma.teamMember.findUniqueOrThrow({
          where: {
            teamId_userId: { teamId: access.team.id, userId: actorUserId },
          },
          include: { team: true, user: true },
        });
      }
      if (!['OWNER', 'ADMIN'].includes(member.role)) {
        throw new ApiError(403, 'Only owners and admins can change allowances');
      }
      await updateTimeOffPolicies(member, input.allowances);
      const policies = await (
        await import('@/lib/prisma')
      ).prisma.timeOffPolicy.findMany({
        where: { teamId: access.team.id },
        orderBy: { type: 'asc' },
      });
      return res.status(200).json({ data: policies });
    }

    return methodNotAllowed(req, res, ['GET', 'PATCH']);
  } catch (error) {
    return sendProblem(res, error);
  }
}
