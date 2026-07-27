import { createHash } from 'crypto';
import type { NextApiRequest, NextApiResponse } from 'next';
import { z } from 'zod';

import {
  consumeOAuthPayload,
  createOAuthPayload,
  isAllowedResource,
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
  // RFC 8707 resource indicator (optional; must match the one from the authorize request).
  resource: z.string().url().optional(),
});
const refreshSchema = z.object({
  grant_type: z.literal('refresh_token'),
  refresh_token: z.string().min(1),
  client_id: z.string().min(1),
  resource: z.string().url().optional(),
});

const refreshResponse = async (
  res: NextApiResponse,
  userId: string,
  clientId: string,
  scopes: string[],
  // RFC 8707: when the grant is bound to a resource, mint the access token with aud = that resource
  // so the MCP resource server (Noodle) accepts it. Absent → default `tivmark-api` audience.
  resource?: string
) => {
  if (resource && !isAllowedResource(resource)) {
    throw new ApiError(400, 'invalid_target: unknown resource');
  }
  const accessToken = await issueAccessToken(
    userId,
    clientId,
    scopes,
    resource // undefined → issueAccessToken falls back to the tivmark-api audience
  );
  const refreshToken = randomToken();
  await createOAuthPayload(
    'REFRESH_TOKEN',
    refreshToken,
    { userId, clientId, scopes, ...(resource ? { resource } : {}) },
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
      const authorizedResource = payload.resource
        ? String(payload.resource)
        : undefined;
      // RFC 8707: if the token request repeats `resource`, it must match what was authorized.
      if (input.resource && input.resource !== authorizedResource) {
        throw new ApiError(
          400,
          'invalid_target: resource does not match the authorization request'
        );
      }
      return refreshResponse(
        res,
        String(payload.userId),
        String(payload.clientId),
        payload.scopes as string[],
        authorizedResource
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
    const refreshedResource = payload.resource
      ? String(payload.resource)
      : undefined;
    if (input.resource && input.resource !== refreshedResource) {
      throw new ApiError(
        400,
        'invalid_target: resource does not match the original grant'
      );
    }
    return refreshResponse(
      res,
      String(payload.userId),
      input.client_id,
      scopes,
      refreshedResource
    );
  } catch (error) {
    return sendProblem(res, error);
  }
}
