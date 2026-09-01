import { timingSafeEqual } from 'crypto';
import type { NextApiRequest, NextApiResponse } from 'next';
import { createRemoteJWKSet, jwtVerify } from 'jose';

import env from '@/lib/env';
import { issueAccessToken } from '@/lib/api/oauth';

// RFC 8693 token-exchange endpoint for the embedded assistant's `delegatedTokenExchange` connector.
//
// The Noodle Seed broker authenticates with our delegation client credential and presents a
// short-lived, platform-signed assertion (`subject_token`) of the signed-in user. We verify it against
// the platform JWKS, then mint a user-scoped Tivmark token via the same `issueAccessToken` the OAuth
// server uses — so downstream v1 API calls run as a real user principal and Tivmark enforces its own
// per-user / per-team authorization and filtering.

const GRANT = 'urn:ietf:params:oauth:grant-type:token-exchange';
const TOKEN_URL = `${env.appUrl}/api/assistant/oauth/token`;
// The scopes the assistant may act with. Time-off and equipment reads/writes plus the reviewer
// sub-scopes and team listing. (Approve for a *user* principal is authorized by role, not this scope;
// it is requested for intent/forward-compat.)
const ALLOWED_SCOPES = new Set([
  'teams',
  'time_off',
  'time_off.approve',
  'time_off.policy',
  'equipment',
  'equipment.approve',
]);

// Cache the remote JWKS across warm invocations.
let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;
function platformJwks() {
  if (!jwks) {
    jwks = createRemoteJWKSet(
      new URL(`${env.assistant.platformIssuer}/.well-known/jwks.json`)
    );
  }
  return jwks;
}

function safeEqual(a: string, b: string) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

function oauthError(
  res: NextApiResponse,
  status: number,
  error: string,
  description?: string
) {
  res.setHeader('Cache-Control', 'no-store');
  return res.status(status).json({
    error,
    ...(description ? { error_description: description } : {}),
  });
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return oauthError(res, 405, 'invalid_request', 'POST required');
  }

  const { delegClientId, delegClientSecret, platformIssuer } = env.assistant;
  if (!delegClientId || !delegClientSecret || !platformIssuer) {
    return oauthError(
      res,
      503,
      'temporarily_unavailable',
      'Delegation not configured'
    );
  }

  // --- client authentication (client_secret_basic) ---
  const authorization = req.headers.authorization ?? '';
  if (!authorization.startsWith('Basic ')) {
    res.setHeader('WWW-Authenticate', 'Basic');
    return oauthError(res, 401, 'invalid_client');
  }
  let clientId = '';
  let clientSecret = '';
  try {
    const decoded = Buffer.from(
      authorization.slice('Basic '.length),
      'base64'
    ).toString('utf8');
    const sep = decoded.indexOf(':');
    clientId = decodeURIComponent(decoded.slice(0, sep));
    clientSecret = decodeURIComponent(decoded.slice(sep + 1));
  } catch {
    return oauthError(res, 401, 'invalid_client');
  }
  if (
    !safeEqual(clientId, delegClientId) ||
    !safeEqual(clientSecret, delegClientSecret)
  ) {
    return oauthError(res, 401, 'invalid_client');
  }

  // --- token-exchange params (application/x-www-form-urlencoded) ---
  const body = (req.body ?? {}) as Record<string, unknown>;
  if (String(body.grant_type ?? '') !== GRANT) {
    return oauthError(res, 400, 'unsupported_grant_type');
  }
  const subjectToken = String(body.subject_token ?? '');
  if (!subjectToken) {
    return oauthError(res, 400, 'invalid_request', 'subject_token required');
  }

  // --- verify the platform-signed assertion (audience bound to this token URL) ---
  let userId: string;
  try {
    const { payload } = await jwtVerify(subjectToken, platformJwks(), {
      issuer: platformIssuer,
      audience: TOKEN_URL,
      algorithms: ['RS256', 'ES256'],
    });
    if (!payload.sub) throw new Error('missing sub');
    userId = String(payload.sub);
  } catch {
    return oauthError(
      res,
      401,
      'invalid_grant',
      'subject_token verification failed'
    );
  }

  // --- scope intersection with our allowlist ---
  const requested = String(body.scope ?? '')
    .split(' ')
    .filter(Boolean);
  const scopes = (requested.length ? requested : ['time_off']).filter((s) =>
    ALLOWED_SCOPES.has(s)
  );
  if (scopes.length === 0) scopes.push('time_off');

  // --- mint a user-scoped Tivmark token (15m; same signer the v1 API verifies) ---
  const accessToken = await issueAccessToken(userId, delegClientId, scopes);

  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({
    access_token: accessToken,
    token_type: 'Bearer',
    expires_in: 900,
  });
}
