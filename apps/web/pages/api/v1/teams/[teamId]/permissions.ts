import type { NextApiRequest, NextApiResponse } from 'next';
import { z } from 'zod';

import { methodNotAllowed, sendProblem } from '@/lib/api/http';
import { requireTeamPrincipal } from '@/lib/api/team';
import { permissions } from '@/lib/permissions';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    if (req.method !== 'GET') return methodNotAllowed(req, res, ['GET']);
    const access = await requireTeamPrincipal(
      req,
      res,
      z.string().parse(req.query.teamId),
      'teams'
    );
    const data = access.member
      ? permissions[access.member.role]
      : access.principal.type === 'service'
        ? access.principal.scopes.map((scope) => ({
            resource: scope,
            actions: '*',
          }))
        : [];
    return res.status(200).json({ data });
  } catch (error) {
    return sendProblem(res, error);
  }
}
