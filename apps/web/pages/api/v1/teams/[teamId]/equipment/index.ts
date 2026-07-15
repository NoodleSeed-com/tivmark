import type { NextApiRequest, NextApiResponse } from 'next';
import { z } from 'zod';

import { methodNotAllowed, sendProblem } from '@/lib/api/http';
import { requireTeamPrincipal } from '@/lib/api/team';
import { prisma } from '@/lib/prisma';
import { getEquipmentWorkspace } from 'models/equipment';

// Full equipment workspace (requests + members + currentUserId + canReview) for a team.
// The UI needs this aggregate; the sibling /requests endpoint only lists requests.
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const access = await requireTeamPrincipal(
      req,
      res,
      z.string().parse(req.query.teamId),
      'equipment'
    );

    if (req.method === 'GET') {
      const member =
        access.member ||
        (await prisma.teamMember.findFirstOrThrow({
          where: { teamId: access.team.id, role: { in: ['OWNER', 'ADMIN'] } },
          include: { team: true, user: true },
        }));
      const workspace = await getEquipmentWorkspace(member);
      return res.status(200).json({ data: workspace });
    }

    return methodNotAllowed(req, res, ['GET']);
  } catch (error) {
    return sendProblem(res, error);
  }
}
