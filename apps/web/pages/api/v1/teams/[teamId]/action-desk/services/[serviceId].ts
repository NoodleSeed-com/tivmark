import type { NextApiRequest, NextApiResponse } from 'next';
import { z } from 'zod';

import { methodNotAllowed, sendProblem } from '@/lib/api/http';
import { requireTeamPrincipal } from '@/lib/api/team';
import { prisma } from '@/lib/prisma';
import { updateActionService } from 'models/actionDesk';

const serviceSchema = z.object({
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().min(1).max(500),
  audience: z.enum(['PUBLIC', 'CUSTOMER', 'EMPLOYEE']),
  active: z.boolean(),
  slaHours: z.number().int().min(1).max(8760).nullable(),
  requiresApproval: z.boolean(),
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
    const service = await updateActionService(
      member,
      z.string().uuid().parse(req.query.serviceId),
      serviceSchema.parse(req.body)
    );
    return res.status(200).json({ data: service });
  } catch (error) {
    return sendProblem(res, error);
  }
}
