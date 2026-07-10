import type { NextApiRequest, NextApiResponse } from 'next';
import { z } from 'zod';

import { methodNotAllowed, sendProblem } from '@/lib/api/http';
import { requireTeamPrincipal } from '@/lib/api/team';
import { prisma } from '@/lib/prisma';
import {
  createTimeOffRequest,
  getTimeOffWorkspace,
  type TimeOffRequestInput,
} from 'models/timeOff';
import { withIdempotency } from '@/lib/api/idempotency';

const requestSchema = z.object({
  requesterId: z.string().uuid().optional(),
  type: z.enum(['VACATION', 'SICK', 'PERSONAL', 'UNPAID']),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  duration: z.enum(['FULL_DAY', 'HALF_DAY']),
  halfDayPeriod: z.enum(['MORNING', 'AFTERNOON']).nullable().optional(),
  reason: z.string().trim().max(500).nullable().optional(),
});

const actorMember = async (teamId: string, userId: string) =>
  prisma.teamMember.findUniqueOrThrow({
    where: { teamId_userId: { teamId, userId } },
    include: { team: true, user: true },
  });

async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const access = await requireTeamPrincipal(
      req,
      res,
      z.string().parse(req.query.teamId),
      'time_off'
    );

    if (req.method === 'GET') {
      const year = z.coerce
        .number()
        .int()
        .min(2000)
        .max(2100)
        .default(new Date().getUTCFullYear())
        .parse(req.query.year);
      const member =
        access.member ||
        (await prisma.teamMember.findFirstOrThrow({
          where: { teamId: access.team.id, role: { in: ['OWNER', 'ADMIN'] } },
          include: { team: true, user: true },
        }));
      const workspace = await getTimeOffWorkspace(member, year);
      const requests = workspace.requests.filter((request) => {
        if (req.query.status && request.status !== req.query.status)
          return false;
        if (req.query.type && request.type !== req.query.type) return false;
        if (
          req.query.requesterId &&
          request.requester.id !== req.query.requesterId
        )
          return false;
        return true;
      });
      return res
        .status(200)
        .json({ data: requests, meta: { nextCursor: null } });
    }

    if (req.method === 'POST') {
      const input = requestSchema.parse(req.body);
      const requesterId =
        access.principal.type === 'user'
          ? access.principal.userId
          : z.string().uuid().parse(input.requesterId);
      const member = await actorMember(access.team.id, requesterId);
      const request = await createTimeOffRequest(
        member,
        input as TimeOffRequestInput
      );
      return res.status(201).json({ data: request });
    }

    return methodNotAllowed(req, res, ['GET', 'POST']);
  } catch (error) {
    return sendProblem(res, error);
  }
}

export default withIdempotency(handler);
