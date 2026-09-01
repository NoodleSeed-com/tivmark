import type { NextApiRequest, NextApiResponse } from 'next';
import { z } from 'zod';

import { methodNotAllowed, sendProblem } from '@/lib/api/http';
import { requireTeamPrincipal } from '@/lib/api/team';
import { prisma } from '@/lib/prisma';
import { transitionServiceRequest } from 'models/actionDesk';

const transitionSchema = z.object({
  status: z.enum([
    'OPEN',
    'IN_PROGRESS',
    'WAITING_ON_REQUESTER',
    'RESOLVED',
    'CANCELED',
  ]),
  note: z.string().trim().max(1000).nullable().optional(),
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
      'service_requests.manage'
    );
    if (req.method !== 'PATCH') return methodNotAllowed(req, res, ['PATCH']);
    const member =
      access.member ||
      (await prisma.teamMember.findFirstOrThrow({
        where: { teamId: access.team.id, role: { in: ['OWNER', 'ADMIN'] } },
        include: { team: true, user: true },
      }));
    const input = transitionSchema.parse(req.body);
    const request = await transitionServiceRequest(
      member,
      z.string().uuid().parse(req.query.requestId),
      input.status,
      input.note
    );
    return res.status(200).json({ data: request });
  } catch (error) {
    return sendProblem(res, error);
  }
}
