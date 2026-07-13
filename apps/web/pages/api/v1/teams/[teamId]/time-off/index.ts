import type { NextApiRequest, NextApiResponse } from 'next';
import { z } from 'zod';

import { methodNotAllowed, sendProblem } from '@/lib/api/http';
import { requireTeamPrincipal } from '@/lib/api/team';
import { prisma } from '@/lib/prisma';
import { getTimeOffWorkspace } from 'models/timeOff';

// Full time-off workspace (requests + balances + policies + members + currentUserId + canApprove)
// for a team and year. The UI needs this aggregate; the sibling /requests endpoint only lists
// requests.
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
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
      return res.status(200).json({ data: workspace });
    }

    return methodNotAllowed(req, res, ['GET']);
  } catch (error) {
    return sendProblem(res, error);
  }
}
