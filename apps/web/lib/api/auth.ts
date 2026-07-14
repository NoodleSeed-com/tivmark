import type { NextApiRequest, NextApiResponse } from 'next';

import { ApiError } from '@/lib/errors';
import env from '@/lib/env';
import { getSession } from '@/lib/session';
import { getApiKey } from 'models/apiKey';
import { verifyAccessToken } from './oauth';
import { enforceRateLimit } from './rate-limit';

const principalCache = new WeakMap<object, ApiPrincipal | null>();
const rateLimitedRequests = new WeakSet<object>();

export type ApiPrincipal =
  | {
      type: 'user';
      userId: string;
      teamId?: string;
      scopes?: string[];
      clientId?: string;
    }
  | {
      type: 'service';
      credentialId: string;
      teamId: string;
      scopes: string[];
    };

const bearerToken = (req: NextApiRequest) => {
  const authorization = req.headers.authorization;
  if (!authorization?.startsWith('Bearer ')) return null;
  return authorization.slice('Bearer '.length).trim() || null;
};

export const getApiPrincipal = async (
  req: NextApiRequest,
  res: NextApiResponse
): Promise<ApiPrincipal | null> => {
  if (principalCache.has(req)) return principalCache.get(req) || null;
  const token = bearerToken(req);

  if (token) {
    const credential = await getApiKey(token);
    if (credential) {
      const principal: ApiPrincipal = {
        type: 'service',
        credentialId: credential.id,
        teamId: credential.teamId,
        scopes: credential.scopes,
      };
      principalCache.set(req, principal);
      return principal;
    }

    try {
      const accessToken = await verifyAccessToken(token);
      // The Origin/allowedOrigins check enforces browser CORS for SPA OAuth clients. The embedded
      // assistant's delegated-token-exchange client is a trusted server-to-server caller (the broker
      // mirrors the connector origin as an Origin header), so it is exempt from the registered-client
      // lookup — its tokens are minted only by our own /api/assistant/oauth/token endpoint.
      const isDelegationClient =
        !!env.assistant.delegClientId &&
        accessToken.clientId === env.assistant.delegClientId;
      if (req.headers.origin && !isDelegationClient) {
        const client = await (
          await import('@/lib/prisma')
        ).prisma.oAuthClient.findUnique({
          where: { clientId: accessToken.clientId },
        });
        if (!client?.allowedOrigins.includes(req.headers.origin)) return null;
        res.setHeader('Access-Control-Allow-Origin', req.headers.origin);
        res.setHeader('Vary', 'Origin');
      }
      const principal: ApiPrincipal = {
        type: 'user',
        userId: accessToken.userId,
        scopes: accessToken.scopes,
        clientId: accessToken.clientId,
      };
      principalCache.set(req, principal);
      return principal;
    } catch {
      return null;
    }
  }

  const appOrigin = env.appUrl.startsWith('http')
    ? new URL(env.appUrl).origin
    : null;
  if (req.headers.origin && appOrigin && req.headers.origin !== appOrigin) {
    return null;
  }

  const session = await getSession(req, res);
  if (session?.user?.id) {
    const principal: ApiPrincipal = { type: 'user', userId: session.user.id };
    principalCache.set(req, principal);
    return principal;
  }

  principalCache.set(req, null);
  return null;
};

export const requireScope = (principal: ApiPrincipal, scope: string) => {
  if (
    principal.scopes &&
    !principal.scopes.includes(scope) &&
    !principal.scopes.includes('*')
  ) {
    throw new ApiError(403, `Missing required scope: ${scope}`);
  }
};

export const requireApiPrincipal = async (
  req: NextApiRequest,
  res: NextApiResponse
) => {
  const principal = await getApiPrincipal(req, res);
  if (!principal) throw new ApiError(401, 'Unauthorized');
  if (!rateLimitedRequests.has(req)) {
    await enforceRateLimit(req, res, principal);
    rateLimitedRequests.add(req);
  }
  return principal;
};
