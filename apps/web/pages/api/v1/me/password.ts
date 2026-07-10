import type { NextApiRequest, NextApiResponse } from 'next';
import { z } from 'zod';

import { requireApiPrincipal } from '@/lib/api/auth';
import { methodNotAllowed, sendProblem } from '@/lib/api/http';
import { hashPassword, verifyPassword } from '@/lib/auth';
import { ApiError } from '@/lib/errors';
import { prisma } from '@/lib/prisma';

const schema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(128),
});

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    if (req.method !== 'PUT') return methodNotAllowed(req, res, ['PUT']);
    const principal = await requireApiPrincipal(req, res);
    if (principal.type !== 'user') {
      throw new ApiError(403, 'User authentication is required');
    }
    const input = schema.parse(req.body);
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: principal.userId },
    });
    if (
      !user.password ||
      !(await verifyPassword(input.currentPassword, user.password))
    ) {
      throw new ApiError(400, 'Your current password is incorrect');
    }
    await prisma.user.update({
      where: { id: user.id },
      data: { password: await hashPassword(input.newPassword) },
    });
    await prisma.oAuthPayload.deleteMany({
      where: {
        model: 'REFRESH_TOKEN',
        payload: { path: ['userId'], equals: user.id },
      },
    });
    return res.status(200).json({ data: {} });
  } catch (error) {
    return sendProblem(res, error);
  }
}
