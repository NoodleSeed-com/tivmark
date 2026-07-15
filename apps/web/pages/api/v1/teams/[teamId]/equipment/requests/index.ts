import type { NextApiRequest, NextApiResponse } from 'next';
import { z } from 'zod';

import { methodNotAllowed, sendProblem } from '@/lib/api/http';
import { requireTeamPrincipal } from '@/lib/api/team';
import { prisma } from '@/lib/prisma';
import {
  createEquipmentRequest,
  getEquipmentWorkspace,
  type EquipmentRequestInput,
} from 'models/equipment';
import { withIdempotency } from '@/lib/api/idempotency';

const requestSchema = z.object({
  requesterId: z.string().uuid().optional(),
  category: z.enum([
    'LAPTOP',
    'MONITOR',
    'PHONE',
    'PERIPHERAL',
    'FURNITURE',
    'OTHER',
  ]),
  item: z.string().trim().min(1).max(200),
  quantity: z.coerce.number().int().min(1).max(20),
  justification: z.string().trim().max(500).nullable().optional(),
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
      const requests = workspace.requests.filter((request) => {
        if (req.query.status && request.status !== req.query.status)
          return false;
        if (req.query.category && request.category !== req.query.category)
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
      const member = await actorMember(access.team.id, requesterId);
      const request = await createEquipmentRequest(
        member,
        input as EquipmentRequestInput
      );
      return res.status(201).json({ data: request });
    }

    return methodNotAllowed(req, res, ['GET', 'POST']);
  } catch (error) {
    return sendProblem(res, error);
  }
}

export default withIdempotency(handler);
