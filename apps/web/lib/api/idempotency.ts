import { createHash } from 'crypto';
import type { NextApiHandler, NextApiRequest, NextApiResponse } from 'next';
import { Prisma } from '@prisma/client';

import { requireApiPrincipal } from '@/lib/api/auth';
import { sendProblem } from '@/lib/api/http';
import { ApiError } from '@/lib/errors';
import { prisma } from '@/lib/prisma';

const hash = (value: string) =>
  createHash('sha256').update(value).digest('hex');

export const withIdempotency =
  (handler: NextApiHandler): NextApiHandler =>
  async (req: NextApiRequest, res: NextApiResponse) => {
    const key = req.headers['idempotency-key'];
    if (!key || req.method === 'GET') return handler(req, res);

    try {
      if (Array.isArray(key) || key.length < 8 || key.length > 200) {
        throw new ApiError(400, 'Idempotency-Key must be 8 to 200 characters');
      }
      const principal = await requireApiPrincipal(req, res);
      const principalId =
        principal.type === 'service'
          ? `service:${principal.credentialId}`
          : `user:${principal.userId}`;
      const method = req.method || 'POST';
      const path = req.url?.split('?')[0] || '';
      const requestHash = hash(JSON.stringify(req.body ?? null));
      const id = hash(`${principalId}:${method}:${path}:${key}`);

      let created = false;
      let record = await prisma.apiIdempotencyRecord.findUnique({
        where: { id },
      });
      if (!record) {
        try {
          record = await prisma.apiIdempotencyRecord.create({
            data: {
              id,
              principalId,
              method,
              path,
              requestHash,
              expiresAt: new Date(Date.now() + 24 * 60 * 60_000),
            },
          });
          created = true;
        } catch {
          record = await prisma.apiIdempotencyRecord.findUniqueOrThrow({
            where: { id },
          });
        }
      }
      if (record.requestHash !== requestHash) {
        throw new ApiError(
          409,
          'Idempotency-Key was already used with a different request body'
        );
      }
      if (record.statusCode !== null) {
        res.setHeader('Idempotency-Replayed', 'true');
        return res.status(record.statusCode).json(record.responseBody);
      }
      if (!created) {
        throw new ApiError(409, 'An identical request is already in progress');
      }

      let responseBody: unknown;
      const originalJson = res.json.bind(res);
      res.json = ((body: unknown) => {
        responseBody = body;
        return originalJson(body);
      }) as typeof res.json;

      await handler(req, res);
      if (res.statusCode >= 500) {
        await prisma.apiIdempotencyRecord.deleteMany({ where: { id } });
      } else {
        await prisma.apiIdempotencyRecord.update({
          where: { id },
          data: {
            statusCode: res.statusCode,
            responseBody:
              responseBody === undefined
                ? Prisma.JsonNull
                : (responseBody as Prisma.InputJsonValue),
          },
        });
      }
    } catch (error) {
      return sendProblem(res, error);
    }
  };
