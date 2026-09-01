import { randomBytes } from 'crypto';
import type { NextApiRequest, NextApiResponse } from 'next';
import { z } from 'zod';

import { hashToken, randomToken } from '@/lib/api/oauth';
import { prisma } from '@/lib/prisma';

// RFC 7591 Dynamic Client Registration for the Tivmark OAuth authorization server.
//
// Generic MCP clients self-register here before running the authorization-code flow. Two client
// types are supported so every standards-based host connects out of the box:
//   - PUBLIC (`token_endpoint_auth_method: 'none'`, e.g. Claude/ChatGPT): PKCE, no secret.
//   - CONFIDENTIAL (`client_secret_basic`/`client_secret_post`, e.g. Gemini): a secret is minted and
//     returned once; only its SHA-256 hash is stored (verified at the token endpoint).
// Redirect URIs must be HTTPS (http only for loopback), and scopes are intersected with a safe
// allowlist so registration can never grant admin access. Clients are not team-owned (`teamId: null`).
//
// Reachable at both `/api/oauth-v1/register` and (via next.config.js rewrite) `/oauth/register`, the
// `registration_endpoint` advertised in the discovery document. The route is public (middleware
// short-circuits `/oauth/**`).

const CONFIDENTIAL_AUTH_METHODS = ['client_secret_basic', 'client_secret_post'];

// Scopes a self-registered client may request. Never admin scopes (credentials/billing/webhooks/…).
// The `.approve` scopes are safe to advertise: the v1 API still enforces per-user OWNER/ADMIN role
// on every approval, so holding the scope alone grants no privilege.
const ALLOWED_SCOPES = [
  'openid',
  'profile',
  'time_off',
  'time_off.approve',
  'equipment',
  'equipment.approve',
  'service_requests',
  'service_requests.manage',
  'teams',
];

const isHttpsOrLocalhost = (value: string) => {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.protocol === 'https:') return true;
  // Allow http only for loopback (local development / testing).
  return (
    url.protocol === 'http:' &&
    (url.hostname === 'localhost' ||
      url.hostname === '127.0.0.1' ||
      url.hostname === '[::1]')
  );
};

const registrationSchema = z.object({
  redirect_uris: z.array(z.string().url()).min(1),
  client_name: z.string().trim().min(1).max(100).optional(),
  // Public (`none`) or confidential (`client_secret_basic`/`client_secret_post`). Omitted → 'none'.
  token_endpoint_auth_method: z
    .enum(['none', 'client_secret_basic', 'client_secret_post'])
    .optional(),
  grant_types: z
    .array(z.enum(['authorization_code', 'refresh_token']))
    .optional(),
  response_types: z.array(z.literal('code')).optional(),
  // RFC 7591 `scope` is a single space-delimited string.
  scope: z.string().optional(),
});

function registrationError(
  res: NextApiResponse,
  status: number,
  error: 'invalid_redirect_uri' | 'invalid_client_metadata',
  description: string
) {
  res.setHeader('Cache-Control', 'no-store');
  return res.status(status).json({ error, error_description: description });
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return registrationError(
      res,
      405,
      'invalid_client_metadata',
      'POST required'
    );
  }

  const parsed = registrationSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return registrationError(
      res,
      400,
      'invalid_client_metadata',
      parsed.error.issues[0]?.message ?? 'Invalid client metadata'
    );
  }
  const input = parsed.data;

  if (!input.redirect_uris.every(isHttpsOrLocalhost)) {
    return registrationError(
      res,
      400,
      'invalid_redirect_uri',
      'All redirect_uris must use https (http is allowed only for localhost).'
    );
  }

  const requested = (input.scope ?? '').split(/\s+/).filter(Boolean);
  const scopes =
    requested.length > 0
      ? requested.filter((s) => ALLOWED_SCOPES.includes(s))
      : [...ALLOWED_SCOPES];
  if (scopes.length === 0) scopes.push('time_off');

  const grantTypes = input.grant_types ?? [
    'authorization_code',
    'refresh_token',
  ];
  const responseTypes = input.response_types ?? ['code'];

  const authMethod = input.token_endpoint_auth_method ?? 'none';
  const isConfidential = CONFIDENTIAL_AUTH_METHODS.includes(authMethod);
  // Mint a secret ONLY for confidential clients; return it once, store only its hash.
  const clientSecretPlain = isConfidential ? randomToken() : undefined;

  const client = await prisma.oAuthClient.create({
    data: {
      name: input.client_name ?? 'MCP Client',
      clientId: `tiv_client_${randomBytes(18).toString('base64url')}`,
      teamId: null,
      redirectUris: input.redirect_uris,
      allowedOrigins: [],
      scopes,
      trusted: false,
      clientSecret: clientSecretPlain ? hashToken(clientSecretPlain) : null,
    },
  });

  res.setHeader('Cache-Control', 'no-store');
  return res.status(201).json({
    client_id: client.clientId,
    client_id_issued_at: Math.floor(client.createdAt.getTime() / 1000),
    ...(clientSecretPlain
      ? { client_secret: clientSecretPlain, client_secret_expires_at: 0 }
      : {}),
    redirect_uris: client.redirectUris,
    token_endpoint_auth_method: authMethod,
    grant_types: grantTypes,
    response_types: responseTypes,
    client_name: client.name,
    scope: client.scopes.join(' '),
  });
}
