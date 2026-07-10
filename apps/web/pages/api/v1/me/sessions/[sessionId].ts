import type { NextApiRequest, NextApiResponse } from 'next';
import { z } from 'zod';
import { requireApiPrincipal } from '@/lib/api/auth';
import { methodNotAllowed, sendProblem } from '@/lib/api/http';
import { ApiError } from '@/lib/errors';
import { prisma } from '@/lib/prisma';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    if (req.method !== 'DELETE') return methodNotAllowed(req, res, ['DELETE']);
    const principal = await requireApiPrincipal(req, res);
    if (principal.type !== 'user') {
      throw new ApiError(403, 'User authentication is required');
    }
    await prisma.session.deleteMany({
      where: {
        id: z.string().parse(req.query.sessionId),
        userId: principal.userId,
      },
    });
    return res.status(204).end();
  } catch (error) {
    return sendProblem(res, error);
  }
}
