import type { NextApiRequest, NextApiResponse } from 'next';
import { z } from 'zod';

import { methodNotAllowed, sendProblem } from '@/lib/api/http';
import { requireTeamPrincipal } from '@/lib/api/team';
import { ApiError } from '@/lib/errors';
import { prisma } from '@/lib/prisma';
import { updateTeamApiSchema } from '@/lib/zod';

const canManage = (role?: string) => role === 'OWNER' || role === 'ADMIN';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const teamId = z.string().parse(req.query.teamId);
    const access = await requireTeamPrincipal(req, res, teamId, 'teams');

    if (req.method === 'GET') {
      return res.status(200).json({ data: access.team });
    }

    if (req.method === 'PATCH' || req.method === 'PUT') {
      if (access.member && !canManage(access.member.role)) {
        throw new ApiError(403, 'Only owners and admins can update a team');
      }
      const team = await prisma.team.update({
        where: { id: access.team.id },
        data: updateTeamApiSchema.parse(req.body),
      });
      return res.status(200).json({ data: team });
    }

    if (req.method === 'DELETE') {
      if (
        access.member?.role !== 'OWNER' &&
        access.principal.type !== 'service'
      ) {
        throw new ApiError(403, 'Only owners can delete a team');
      }
      await prisma.team.delete({ where: { id: access.team.id } });
      return res.status(204).end();
    }

    return methodNotAllowed(req, res, ['GET', 'PATCH', 'PUT', 'DELETE']);
  } catch (error) {
    return sendProblem(res, error);
  }
}
