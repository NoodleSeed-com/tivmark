import type { NextApiRequest, NextApiResponse } from 'next';

import type { ApiPrincipal } from '@/lib/api/auth';
import env from '@/lib/env';
import { ApiError } from '@/lib/errors';
import { prisma } from '@/lib/prisma';

const WINDOW_MS = 60_000;
const REQUEST_LIMIT = env.apiRateLimitRequests;

export const enforceRateLimit = async (
  req: NextApiRequest,
  res: NextApiResponse,
  principal: ApiPrincipal
) => {
  const principalId =
    principal.type === 'service'
      ? `service:${principal.credentialId}`
      : `user:${principal.userId}`;
  const windowStart = Math.floor(Date.now() / WINDOW_MS) * WINDOW_MS;
  const id = `${principalId}:${windowStart}`;
  const limit = await prisma.apiRateLimit.upsert({
    where: { id },
    create: {
      id,
      expiresAt: new Date(windowStart + WINDOW_MS * 2),
    },
    update: { count: { increment: 1 } },
  });

  const remaining = Math.max(0, REQUEST_LIMIT - limit.count);
  res.setHeader('X-RateLimit-Limit', String(REQUEST_LIMIT));
  res.setHeader('X-RateLimit-Remaining', String(remaining));
  res.setHeader(
    'X-RateLimit-Reset',
    String(Math.ceil((windowStart + WINDOW_MS) / 1000))
  );
  if (limit.count > REQUEST_LIMIT) {
    res.setHeader(
      'Retry-After',
      String(
        Math.max(1, Math.ceil((windowStart + WINDOW_MS - Date.now()) / 1000))
      )
    );
    throw new ApiError(429, 'API rate limit exceeded');
  }

  if (Math.random() < 0.01) {
    void prisma.apiRateLimit.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
  }
};
