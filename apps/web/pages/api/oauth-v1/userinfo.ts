import type { NextApiRequest, NextApiResponse } from 'next';
import { verifyAccessToken } from '@/lib/api/oauth';
import { sendProblem } from '@/lib/api/http';
import { ApiError } from '@/lib/errors';
import { prisma } from '@/lib/prisma';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
    if (!token) throw new ApiError(401, 'Bearer token required');
    const access = await verifyAccessToken(token);
    if (
      !access.scopes.includes('openid') &&
      !access.scopes.includes('profile')
    ) {
      throw new ApiError(403, 'The profile scope is required');
    }
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: access.userId },
      select: { id: true, name: true, email: true, image: true },
    });
    return res.status(200).json({ sub: user.id, ...user });
  } catch (error) {
    return sendProblem(res, error);
  }
}
