import type { NextApiRequest, NextApiResponse } from 'next';
import { z } from 'zod';

import { requireApiPrincipal } from '@/lib/api/auth';
import { methodNotAllowed, sendProblem } from '@/lib/api/http';
import { ApiError } from '@/lib/errors';
import { prisma } from '@/lib/prisma';

const updateSchema = z
  .object({
    name: z.string().trim().min(1).max(100).optional(),
    email: z.string().email().optional(),
    image: z.string().max(2_000_000).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, 'No changes supplied');

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const principal = await requireApiPrincipal(req, res);
    if (principal.type !== 'user') {
      throw new ApiError(403, 'User authentication is required');
    }

    if (req.method === 'GET') {
      const user = await prisma.user.findUniqueOrThrow({
        where: { id: principal.userId },
        select: { id: true, name: true, email: true, image: true },
      });
      return res.status(200).json({ data: user });
    }

    if (req.method === 'PATCH' || req.method === 'PUT') {
      const body = updateSchema.parse(req.body);
      const user = await prisma.user.update({
        where: { id: principal.userId },
        data: body,
        select: { id: true, name: true, email: true, image: true },
      });
      return res.status(200).json({ data: user });
    }

    return methodNotAllowed(req, res, ['GET', 'PATCH', 'PUT']);
  } catch (error) {
    return sendProblem(res, error);
  }
}
