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
  code_challenge: z.string().min(43).max(128),
  code_challenge_method: z.literal('S256'),
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

    const requestedScopes = input.scope.split(' ').filter(Boolean);
    if (requestedScopes.some((scope) => !client.scopes.includes(scope))) {
      throw new ApiError(
        400,
        'The client is not allowed to request that scope'
      );
    }

    if (input.resource && !isAllowedResource(input.resource)) {
      throw new ApiError(400, 'invalid_target: unknown resource');
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
      codeChallenge: input.code_challenge,
      scopes: requestedScopes,
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
