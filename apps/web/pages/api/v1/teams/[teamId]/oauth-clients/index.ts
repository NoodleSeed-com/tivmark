import { randomBytes } from 'crypto';
import type { NextApiRequest, NextApiResponse } from 'next';
import { z } from 'zod';

import { methodNotAllowed, sendProblem } from '@/lib/api/http';
import { requireTeamPrincipal } from '@/lib/api/team';
import { ApiError } from '@/lib/errors';
import { prisma } from '@/lib/prisma';
import { withIdempotency } from '@/lib/api/idempotency';

const createSchema = z.object({
  name: z.string().trim().min(1).max(100),
  redirectUris: z.array(z.string().url()).min(1),
  allowedOrigins: z.array(z.string().url()).default([]),
  scopes: z.array(z.string().min(1)).min(1),
});

async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const access = await requireTeamPrincipal(
      req,
      res,
      z.string().parse(req.query.teamId),
      'credentials'
    );
    if (access.member && access.member.role !== 'OWNER') {
      throw new ApiError(403, 'Only owners can manage OAuth clients');
    }

    if (req.method === 'GET') {
      const clients = await prisma.oAuthClient.findMany({
        where: { teamId: access.team.id },
        orderBy: { createdAt: 'desc' },
      });
      return res
        .status(200)
        .json({ data: clients, meta: { nextCursor: null } });
    }

    if (req.method === 'POST') {
      const input = createSchema.parse(req.body);
      const client = await prisma.oAuthClient.create({
        data: {
          ...input,
          clientId: `tiv_client_${randomBytes(18).toString('base64url')}`,
          teamId: access.team.id,
        },
      });
      return res.status(201).json({ data: client });
    }

    return methodNotAllowed(req, res, ['GET', 'POST']);
  } catch (error) {
    return sendProblem(res, error);
  }
}

export default withIdempotency(handler);
