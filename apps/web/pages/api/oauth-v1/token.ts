import { createHash } from 'crypto';
import type { NextApiRequest, NextApiResponse } from 'next';
import { z } from 'zod';

import {
  consumeOAuthPayload,
  createOAuthPayload,
  issueAccessToken,
  randomToken,
} from '@/lib/api/oauth';
import { methodNotAllowed, sendProblem } from '@/lib/api/http';
import { ApiError } from '@/lib/errors';
import { prisma } from '@/lib/prisma';

const authorizationCodeSchema = z.object({
  grant_type: z.literal('authorization_code'),
  code: z.string().min(1),
  client_id: z.string().min(1),
  redirect_uri: z.string().url(),
  code_verifier: z.string().min(43).max(128),
});
const refreshSchema = z.object({
  grant_type: z.literal('refresh_token'),
  refresh_token: z.string().min(1),
  client_id: z.string().min(1),
});

const refreshResponse = async (
  res: NextApiResponse,
  userId: string,
  clientId: string,
  scopes: string[]
) => {
  const accessToken = await issueAccessToken(userId, clientId, scopes);
  const refreshToken = randomToken();
  await createOAuthPayload(
    'REFRESH_TOKEN',
    refreshToken,
    { userId, clientId, scopes },
    new Date(Date.now() + 30 * 86_400_000)
  );
  return res.status(200).json({
    access_token: accessToken,
    token_type: 'Bearer',
    expires_in: 900,
    refresh_token: refreshToken,
    scope: scopes.join(' '),
  });
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    if (req.method !== 'POST') return methodNotAllowed(req, res, ['POST']);
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Pragma', 'no-cache');

    if (req.body.grant_type === 'authorization_code') {
      const input = authorizationCodeSchema.parse(req.body);
      const payload = await consumeOAuthPayload(
        'AUTHORIZATION_CODE',
        input.code
      );
      if (
        payload.clientId !== input.client_id ||
        payload.redirectUri !== input.redirect_uri
      ) {
        throw new ApiError(400, 'Authorization code does not match the client');
      }
      const challenge = createHash('sha256')
        .update(input.code_verifier)
        .digest('base64url');
      if (challenge !== payload.codeChallenge) {
        throw new ApiError(400, 'PKCE verification failed');
      }
      return refreshResponse(
        res,
        String(payload.userId),
        String(payload.clientId),
        payload.scopes as string[]
      );
    }

    const input = refreshSchema.parse(req.body);
    const payload = await consumeOAuthPayload(
      'REFRESH_TOKEN',
      input.refresh_token
    );
    if (payload.clientId !== input.client_id) {
      throw new ApiError(400, 'Refresh token does not match the client');
    }
    const client = await prisma.oAuthClient.findUnique({
      where: { clientId: input.client_id },
    });
    if (!client) throw new ApiError(400, 'OAuth client no longer exists');
    const scopes = (payload.scopes as string[]).filter((scope) =>
      client.scopes.includes(scope)
    );
    if (scopes.length === 0) {
      throw new ApiError(400, 'The OAuth grant no longer has valid scopes');
    }
    return refreshResponse(
      res,
      String(payload.userId),
      input.client_id,
      scopes
    );
  } catch (error) {
    return sendProblem(res, error);
  }
}
