import type { NextApiRequest, NextApiResponse } from 'next';
import { z } from 'zod';

import {
  createOAuthPayload,
  isAllowedResource,
  randomToken,
  redirectWithAuthorizationCode,
} from '@/lib/api/oauth';
import { sendProblem } from '@/lib/api/http';
import { ApiError } from '@/lib/errors';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/session';

const querySchema = z.object({
  response_type: z.literal('code'),
  client_id: z.string().min(1),
  redirect_uri: z.string().url(),
  // PKCE is optional at the schema level: REQUIRED for public clients, optional for confidential
  // clients (authenticated by a secret at the token endpoint) — enforced after client lookup below.
  code_challenge: z.string().min(43).max(128).optional(),
  code_challenge_method: z.literal('S256').optional(),
  scope: z.string().min(1),
  state: z.string().min(8),
  // RFC 8707 resource indicator (optional). When present it must be a resource we recognize; the
  // minted access token's `aud` is bound to it (see the token endpoint).
  resource: z.string().url().optional(),
});

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const input = querySchema.parse(req.query);
    const client = await prisma.oAuthClient.findUnique({
      where: { clientId: input.client_id },
    });
    if (!client || !client.redirectUris.includes(input.redirect_uri)) {
      throw new ApiError(400, 'Invalid OAuth client or redirect URI');
    }

    // Downscope rather than reject. Standards-based MCP hosts (e.g. Claude) request every scope in
    // `scopes_supported`, but a DCR-registered client is only granted the allowlisted subset. Grant
    // the intersection (OAuth 2.1 §3.3 permits a narrower grant; the token response returns the
    // granted `scope`). Only error if NOTHING the client can hold was requested.
    const requestedScopes = input.scope.split(' ').filter(Boolean);
    const grantedScopes = requestedScopes.filter((scope) =>
      client.scopes.includes(scope)
    );
    if (grantedScopes.length === 0) {
      throw new ApiError(
        400,
        'The client is not allowed to request any of those scopes'
      );
    }

    if (input.resource && !isAllowedResource(input.resource)) {
      throw new ApiError(400, 'invalid_target: unknown resource');
    }

    // PKCE is mandatory for public clients (no secret). Confidential clients (client.clientSecret
    // set) authenticate with their secret at the token endpoint and MAY omit PKCE.
    const isConfidential = Boolean(client.clientSecret);
    if (!isConfidential && !input.code_challenge) {
      throw new ApiError(400, 'code_challenge is required (PKCE)');
    }

    const session = await getSession(req, res);
    if (!session?.user?.id) {
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(input)) {
        if (value !== undefined) params.set(key, String(value));
      }
      const callbackUrl = `/oauth/authorize?${params.toString()}`;
      return res.redirect(
        302,
        `/?tab=login&callbackUrl=${encodeURIComponent(callbackUrl)}`
      );
    }

    const authorization = {
      clientId: client.clientId,
      userId: session.user.id,
      redirectUri: input.redirect_uri,
      ...(input.code_challenge ? { codeChallenge: input.code_challenge } : {}),
      scopes: grantedScopes,
      state: input.state,
      ...(input.resource ? { resource: input.resource } : {}),
    };

    if (!client.trusted) {
      const requestToken = randomToken();
      await createOAuthPayload(
        'AUTHORIZATION_REQUEST',
        requestToken,
        authorization,
        new Date(Date.now() + 10 * 60_000)
      );
      return res.redirect(
        302,
        `/oauth/consent?request=${encodeURIComponent(requestToken)}`
      );
    }

    return res.redirect(
      302,
      await redirectWithAuthorizationCode(authorization)
    );
  } catch (error) {
    return sendProblem(res, error);
  }
}
