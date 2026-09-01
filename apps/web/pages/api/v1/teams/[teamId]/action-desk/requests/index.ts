import type { NextApiRequest, NextApiResponse } from 'next';
import { z } from 'zod';

import { methodNotAllowed, sendProblem } from '@/lib/api/http';
import { withIdempotency } from '@/lib/api/idempotency';
import { requireTeamPrincipal } from '@/lib/api/team';
import { prisma } from '@/lib/prisma';
import {
  createServiceRequest,
  getActionDeskWorkspace,
} from 'models/actionDesk';

const requestSchema = z.object({
  requesterId: z.string().uuid().optional(),
  serviceId: z.string().uuid(),
  subject: z.string().trim().min(1).max(160),
  description: z.string().trim().min(1).max(2000),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']).default('NORMAL'),
  source: z.enum(['WEB', 'ASSISTANT', 'MCP']).default('WEB'),
});

const actorMember = (teamId: string, userId: string) =>
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
      'service_requests'
    );

    if (req.method === 'GET') {
      const member =
        access.member ||
        (await prisma.teamMember.findFirstOrThrow({
          where: { teamId: access.team.id, role: { in: ['OWNER', 'ADMIN'] } },
          include: { team: true, user: true },
        }));
      const workspace = await getActionDeskWorkspace(member);
      const requests = workspace.requests.filter((request) => {
        if (req.query.status && request.status !== req.query.status)
          return false;
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
      const request = await createServiceRequest(
        await actorMember(access.team.id, requesterId),
        input
      );
      return res.status(201).json({ data: request });
    }
    return methodNotAllowed(req, res, ['GET', 'POST']);
  } catch (error) {
    return sendProblem(res, error);
  }
}

export default withIdempotency(handler);
