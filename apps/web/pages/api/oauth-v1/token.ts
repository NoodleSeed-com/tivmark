import { createHash } from 'crypto';
import type { NextApiRequest, NextApiResponse } from 'next';
import { z } from 'zod';

import {
  consumeOAuthPayload,
  createOAuthPayload,
  hashToken,
  isAllowedResource,
  issueAccessToken,
  randomToken,
} from '@/lib/api/oauth';
import { methodNotAllowed, sendProblem } from '@/lib/api/http';
import { ApiError } from '@/lib/errors';
import { prisma } from '@/lib/prisma';
import type { OAuthClient } from '@prisma/client';

const authorizationCodeSchema = z.object({
  grant_type: z.literal('authorization_code'),
  code: z.string().min(1),
  client_id: z.string().min(1),
  redirect_uri: z.string().url(),
  // PKCE verifier — required when the grant carries a code_challenge (public clients); confidential
  // clients that skipped PKCE authenticate with their secret instead.
  code_verifier: z.string().min(43).max(128).optional(),
  // RFC 8707 resource indicator (optional; must match the one from the authorize request).
  resource: z.string().url().optional(),
});
const refreshSchema = z.object({
  grant_type: z.literal('refresh_token'),
  refresh_token: z.string().min(1),
  client_id: z.string().min(1),
  resource: z.string().url().optional(),
});

// Client credentials may arrive via HTTP Basic auth (client_secret_basic) or the request body
// (client_secret_post / public). Returns whatever is present.
const clientCredentials = (
  req: NextApiRequest
): { clientId?: string; clientSecret?: string } => {
  const auth = req.headers.authorization;
  if (auth && /^Basic /i.test(auth)) {
    const decoded = Buffer.from(
      auth.replace(/^Basic /i, ''),
      'base64'
    ).toString('utf8');
    const idx = decoded.indexOf(':');
    if (idx >= 0) {
      return {
        clientId: decodeURIComponent(decoded.slice(0, idx)),
        clientSecret: decodeURIComponent(decoded.slice(idx + 1)),
      };
    }
  }
  return {
    clientId: req.body?.client_id,
    clientSecret: req.body?.client_secret,
  };
};

// Load the client and, for CONFIDENTIAL clients (a secret is stored), verify the presented secret.
// Public clients (no stored secret) are authenticated by PKCE at the code exchange instead.
const authenticateClient = async (
  clientId: string,
  presentedSecret: string | undefined
): Promise<OAuthClient> => {
  const client = await prisma.oAuthClient.findUnique({ where: { clientId } });
  if (!client) throw new ApiError(400, 'OAuth client no longer exists');
  if (client.clientSecret) {
    if (
      !presentedSecret ||
      hashToken(presentedSecret) !== client.clientSecret
    ) {
      throw new ApiError(401, 'invalid_client: bad client credentials');
    }
  }
  return client;
};

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

    // Client credentials can be in a Basic auth header; surface the client_id to the body schemas.
    const creds = clientCredentials(req);
    if (req.body && !req.body.client_id && creds.clientId) {
      req.body.client_id = creds.clientId;
    }

    if (req.body.grant_type === 'authorization_code') {
      const input = authorizationCodeSchema.parse(req.body);
      const client = await authenticateClient(
        input.client_id,
        creds.clientSecret
      );
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
      // Verify PKCE when the grant carries a challenge (always true for public clients). A grant
      // with no challenge is only valid for a confidential client (already secret-authenticated).
      if (payload.codeChallenge) {
        if (!input.code_verifier) {
          throw new ApiError(400, 'code_verifier is required (PKCE)');
        }
        const challenge = createHash('sha256')
          .update(input.code_verifier)
          .digest('base64url');
        if (challenge !== payload.codeChallenge) {
          throw new ApiError(400, 'PKCE verification failed');
        }
      } else if (!client.clientSecret) {
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
    const client = await authenticateClient(
      input.client_id,
      creds.clientSecret
    );
    const payload = await consumeOAuthPayload(
      'REFRESH_TOKEN',
      input.refresh_token
    );
    if (payload.clientId !== input.client_id) {
      throw new ApiError(400, 'Refresh token does not match the client');
    }
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
