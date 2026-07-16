import { randomBytes } from 'crypto';
import type { NextApiRequest, NextApiResponse } from 'next';
import { z } from 'zod';

import { prisma } from '@/lib/prisma';

// RFC 7591 Dynamic Client Registration for the Tivmark OAuth authorization server.
//
// Generic MCP clients (ChatGPT, Claude) self-register here before running the PKCE authorization-code
// flow. We only ever mint PUBLIC clients (PKCE, no secret): `token_endpoint_auth_method: 'none'`,
// HTTPS redirect URIs, and scopes intersected with a safe allowlist so registration can never grant
// admin-level access. Registered clients are not owned by a team (`teamId: null`).
//
// Reachable at both `/api/oauth-v1/register` and (via next.config.js rewrite) `/oauth/register`, the
// `registration_endpoint` advertised in the discovery document. The route is public (middleware
// `unAuthenticatedRoutes` covers `/api/oauth-v1/**` and `/oauth/**`).

// Scopes a self-registered client may request. Never admin scopes (credentials/billing/webhooks/…).
const ALLOWED_SCOPES = ['openid', 'profile', 'time_off', 'equipment', 'teams'];

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
  // Public clients only. Omitted defaults to 'none'; any other value is rejected below.
  token_endpoint_auth_method: z.literal('none').optional(),
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

  // Reject an explicit non-public auth method before schema coercion so the error is specific.
  if (
    req.body?.token_endpoint_auth_method !== undefined &&
    req.body.token_endpoint_auth_method !== 'none'
  ) {
    return registrationError(
      res,
      400,
      'invalid_client_metadata',
      "Only public clients are supported (token_endpoint_auth_method must be 'none')."
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

  const client = await prisma.oAuthClient.create({
    data: {
      name: input.client_name ?? 'MCP Client',
      clientId: `tiv_client_${randomBytes(18).toString('base64url')}`,
      teamId: null,
      redirectUris: input.redirect_uris,
      allowedOrigins: [],
      scopes,
      trusted: false,
    },
  });

  res.setHeader('Cache-Control', 'no-store');
  return res.status(201).json({
    client_id: client.clientId,
    client_id_issued_at: Math.floor(client.createdAt.getTime() / 1000),
    redirect_uris: client.redirectUris,
    token_endpoint_auth_method: 'none',
    grant_types: grantTypes,
    response_types: responseTypes,
    client_name: client.name,
    scope: client.scopes.join(' '),
  });
}
