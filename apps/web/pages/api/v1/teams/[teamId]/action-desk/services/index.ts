import type { NextApiRequest, NextApiResponse } from 'next';
import { z } from 'zod';

import { methodNotAllowed, sendProblem } from '@/lib/api/http';
import { withIdempotency } from '@/lib/api/idempotency';
import { requireTeamPrincipal } from '@/lib/api/team';
import { prisma } from '@/lib/prisma';
import {
  createActionService,
  ensureDefaultActionServices,
} from 'models/actionDesk';

const serviceSchema = z.object({
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().min(1).max(500),
  audience: z.enum(['PUBLIC', 'CUSTOMER', 'EMPLOYEE']),
  active: z.boolean().optional(),
  slaHours: z.number().int().min(1).max(8760).nullable().optional(),
  requiresApproval: z.boolean().optional(),
});

async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const access = await requireTeamPrincipal(
      req,
      res,
      z.string().parse(req.query.teamId),
      req.method === 'POST' ? 'service_requests.manage' : 'service_requests'
    );
    const member =
      access.member ||
      (await prisma.teamMember.findFirstOrThrow({
        where: { teamId: access.team.id, role: { in: ['OWNER', 'ADMIN'] } },
        include: { team: true, user: true },
      }));

    if (req.method === 'GET') {
      await ensureDefaultActionServices(access.team.id);
      const services = await prisma.actionService.findMany({
        where: { teamId: access.team.id },
        orderBy: [{ active: 'desc' }, { name: 'asc' }],
      });
      return res
        .status(200)
        .json({ data: services, meta: { nextCursor: null } });
    }
    if (req.method === 'POST') {
      const service = await createActionService(
        member,
        serviceSchema.parse(req.body)
      );
      return res.status(201).json({ data: service });
    }
    return methodNotAllowed(req, res, ['GET', 'POST']);
  } catch (error) {
    return sendProblem(res, error);
  }
}

export default withIdempotency(handler);
