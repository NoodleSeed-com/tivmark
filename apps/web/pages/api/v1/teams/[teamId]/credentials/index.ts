import type { NextApiRequest, NextApiResponse } from 'next';
import { z } from 'zod';

import { methodNotAllowed, sendProblem } from '@/lib/api/http';
import { requireTeamPrincipal } from '@/lib/api/team';
import { ApiError } from '@/lib/errors';
import { createApiKey, fetchApiKeys } from 'models/apiKey';
import { withIdempotency } from '@/lib/api/idempotency';

const createSchema = z.object({
  name: z.string().trim().min(1).max(50),
  scopes: z.array(z.string().min(1)).min(1),
  expiresInDays: z.number().int().min(1).max(365).default(90),
});

async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const access = await requireTeamPrincipal(
      req,
      res,
      z.string().parse(req.query.teamId),
      'credentials'
    );
    if (access.member && !['OWNER', 'ADMIN'].includes(access.member.role)) {
      throw new ApiError(403, 'Only owners and admins can manage credentials');
    }

    if (req.method === 'GET') {
      const credentials = await fetchApiKeys(access.team.id);
      return res
        .status(200)
        .json({ data: credentials, meta: { nextCursor: null } });
    }

    if (req.method === 'POST') {
      const input = createSchema.parse(req.body);
      const apiKey = await createApiKey({
        name: input.name,
        teamId: access.team.id,
        createdById:
          access.principal.type === 'user'
            ? access.principal.userId
            : undefined,
        scopes: input.scopes,
        expiresAt: new Date(Date.now() + input.expiresInDays * 86_400_000),
      });
      return res.status(201).json({ data: { apiKey } });
    }

    return methodNotAllowed(req, res, ['GET', 'POST']);
  } catch (error) {
    return sendProblem(res, error);
  }
}

export default withIdempotency(handler);
