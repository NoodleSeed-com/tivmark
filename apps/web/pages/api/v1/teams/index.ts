import type { NextApiRequest, NextApiResponse } from 'next';
import { z } from 'zod';

import { requireApiPrincipal, requireScope } from '@/lib/api/auth';
import { methodNotAllowed, sendProblem } from '@/lib/api/http';
import { ApiError } from '@/lib/errors';
import { slugify } from '@/lib/server-common';
import { createTeam } from 'models/team';
import { prisma } from '@/lib/prisma';
import { withIdempotency } from '@/lib/api/idempotency';

const createSchema = z.object({ name: z.string().trim().min(1).max(100) });

async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const principal = await requireApiPrincipal(req, res);
    requireScope(principal, 'teams');

    if (req.method === 'GET') {
      const teams = await prisma.team.findMany({
        where:
          principal.type === 'service'
            ? { id: principal.teamId }
            : { members: { some: { userId: principal.userId } } },
        include: { _count: { select: { members: true } } },
        orderBy: { createdAt: 'asc' },
      });
      return res.status(200).json({ data: teams, meta: { nextCursor: null } });
    }

    if (req.method === 'POST') {
      if (principal.type !== 'user') {
        throw new ApiError(403, 'Service credentials cannot create teams');
      }
      const { name } = createSchema.parse(req.body);
      let slug = slugify(name);
      const existing = await prisma.team.count({ where: { slug } });
      if (existing) slug = `${slug}-${Date.now().toString(36)}`;
      const team = await createTeam({ userId: principal.userId, name, slug });
      return res.status(201).json({ data: team });
    }

    return methodNotAllowed(req, res, ['GET', 'POST']);
  } catch (error) {
    return sendProblem(res, error);
  }
}

export default withIdempotency(handler);
