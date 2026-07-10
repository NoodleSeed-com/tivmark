import type { NextApiRequest, NextApiResponse } from 'next';
import { z } from 'zod';

import env from '@/lib/env';
import { methodNotAllowed, sendProblem } from '@/lib/api/http';
import { requireTeamPrincipal } from '@/lib/api/team';
import { ApiError } from '@/lib/errors';
import { prisma } from '@/lib/prisma';
import { getViewerToken } from '@/lib/retraced';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    if (req.method !== 'POST') return methodNotAllowed(req, res, ['POST']);
    if (!env.teamFeatures.auditLog || !env.retraced.url) {
      throw new ApiError(404, 'Audit logs are not configured');
    }
    const access = await requireTeamPrincipal(
      req,
      res,
      z.string().parse(req.query.teamId),
      'audit_logs'
    );
    const actorId =
      access.principal.type === 'user'
        ? access.principal.userId
        : (
            await prisma.teamMember.findFirstOrThrow({
              where: { teamId: access.team.id, role: 'OWNER' },
              select: { userId: true },
            })
          ).userId;
    const token = await getViewerToken(access.team.id, actorId);
    if (!token) throw new ApiError(503, 'Audit logs are unavailable');
    return res.status(200).json({
      data: { token, host: `${env.retraced.url}/viewer/v1` },
    });
  } catch (error) {
    return sendProblem(res, error);
  }
}
