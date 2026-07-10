import type { NextApiRequest, NextApiResponse } from 'next';
import { requireApiPrincipal } from '@/lib/api/auth';
import { methodNotAllowed, sendProblem } from '@/lib/api/http';
import { ApiError } from '@/lib/errors';
import { prisma } from '@/lib/prisma';
import { getCookie } from 'cookies-next';
import { sessionTokenCookieName } from '@/lib/nextAuth';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    if (req.method !== 'GET') return methodNotAllowed(req, res, ['GET']);
    const principal = await requireApiPrincipal(req, res);
    if (principal.type !== 'user') {
      throw new ApiError(403, 'User authentication is required');
    }
    const sessions = await prisma.session.findMany({
      where: { userId: principal.userId },
      orderBy: { expires: 'desc' },
    });
    const currentToken = await getCookie(sessionTokenCookieName, { req, res });
    return res.status(200).json({
      data: sessions.map((session) => ({
        ...session,
        isCurrent: session.sessionToken === currentToken,
      })),
      meta: { nextCursor: null },
    });
  } catch (error) {
    return sendProblem(res, error);
  }
}
