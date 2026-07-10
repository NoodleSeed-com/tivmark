import type { NextApiRequest, NextApiResponse } from 'next';
import { z } from 'zod';

import { methodNotAllowed, sendProblem } from '@/lib/api/http';
import { requireTeamPrincipal } from '@/lib/api/team';
import { ApiError } from '@/lib/errors';
import { prisma } from '@/lib/prisma';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    if (req.method !== 'DELETE') return methodNotAllowed(req, res, ['DELETE']);
    const access = await requireTeamPrincipal(
      req,
      res,
      z.string().parse(req.query.teamId),
      'credentials'
    );
    if (access.member && !['OWNER', 'ADMIN'].includes(access.member.role)) {
      throw new ApiError(403, 'Only owners and admins can revoke credentials');
    }
    const credentialId = z.string().uuid().parse(req.query.credentialId);
    await prisma.apiKey.deleteMany({
      where: { id: credentialId, teamId: access.team.id },
    });
    return res.status(204).end();
  } catch (error) {
    return sendProblem(res, error);
  }
}
