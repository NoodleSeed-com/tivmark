import type { NextApiRequest, NextApiResponse } from 'next';
import { z } from 'zod';
import { hashToken } from '@/lib/api/oauth';
import { methodNotAllowed } from '@/lib/api/http';
import { prisma } from '@/lib/prisma';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') return methodNotAllowed(req, res, ['POST']);
  const token = z.string().min(1).safeParse(req.body.token);
  if (token.success) {
    await prisma.oAuthPayload.deleteMany({
      where: { id: hashToken(token.data), model: 'REFRESH_TOKEN' },
    });
  }
  return res.status(200).end();
}
