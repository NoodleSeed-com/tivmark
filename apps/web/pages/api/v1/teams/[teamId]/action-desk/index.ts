import type { NextApiRequest, NextApiResponse } from 'next';
import { z } from 'zod';

import { methodNotAllowed, sendProblem } from '@/lib/api/http';
import { requireTeamPrincipal } from '@/lib/api/team';
import { prisma } from '@/lib/prisma';
import { getActionDeskWorkspace } from 'models/actionDesk';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const access = await requireTeamPrincipal(
      req,
      res,
      z.string().parse(req.query.teamId),
      'service_requests'
    );
    if (req.method !== 'GET') return methodNotAllowed(req, res, ['GET']);
    const member =
      access.member ||
      (await prisma.teamMember.findFirstOrThrow({
        where: { teamId: access.team.id, role: { in: ['OWNER', 'ADMIN'] } },
        include: { team: true, user: true },
      }));
    return res.status(200).json({ data: await getActionDeskWorkspace(member) });
  } catch (error) {
    return sendProblem(res, error);
  }
}
