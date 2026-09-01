import { createHash, randomBytes } from 'crypto';
import {
  SignJWT,
  exportJWK,
  generateKeyPair,
  importJWK,
  jwtVerify,
  type JWK,
} from 'jose';

import env from '@/lib/env';
import { ApiError } from '@/lib/errors';
import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';

const issuer = `${env.appUrl}/oauth`;
// The stable, environment-specific audience for every access token this server mints: Tivmark's own
// v1 API (direct clients + the delegated token-exchange) and the customer-OIDC tokens Noodle verifies.
// Noodle requires an (issuer, audience) pair to belong to exactly one app environment, so the `-prod`
// suffix keeps this pair unique to the production deployment. It must match `customerAuth.oidc`'s
// audience in apps/assistant/src/server.ts, and it deliberately does NOT vary by server version.
export const API_AUDIENCE = 'tivmark-api-prod';

// RFC 8707 resource indicators. Standards-based MCP hosts (Gemini, ChatGPT, Claude) request a token
// bound to the MCP server's canonical URL. Every entry is an EXACT canonical URL served by our own
// Noodle deployment — matching is strict string equality with no normalization, so a foreign host,
// another app or environment, an unexpected path, a trailing slash, or a case variant all fail closed.
// Versioned endpoints get their own entry (they are distinct resources) but share API_AUDIENCE.
//
// Keep in lockstep with the ACTIVE Noodle deployments (`noodle deployments list --env prod`): every
// active version whose manifest names us as its authorization server sends clients here for a token,
// and a version missing from this list would get `invalid_target` instead. v8 through v24 are those
// versions — v1-v7 predate the switch to customerAuth.oidc (they used customerAuth.bridge) and route
// to Noodle's own AS, so they must NOT be listed. Add the new /vN/mcp entry whenever a version ships;
// the audience itself never changes.
const ALLOWED_RESOURCE_LIST = [
  'https://noodleseed.cloud.noodleseed.dev/tivmark-assistant/mcp',
  'https://noodleseed.cloud.noodleseed.dev/tivmark-assistant/v8/mcp',
  'https://noodleseed.cloud.noodleseed.dev/tivmark-assistant/v9/mcp',
  'https://noodleseed.cloud.noodleseed.dev/tivmark-assistant/v10/mcp',
  'https://noodleseed.cloud.noodleseed.dev/tivmark-assistant/v11/mcp',
  'https://noodleseed.cloud.noodleseed.dev/tivmark-assistant/v12/mcp',
  'https://noodleseed.cloud.noodleseed.dev/tivmark-assistant/v13/mcp',
  'https://noodleseed.cloud.noodleseed.dev/tivmark-assistant/v14/mcp',
  'https://noodleseed.cloud.noodleseed.dev/tivmark-assistant/v15/mcp',
  'https://noodleseed.cloud.noodleseed.dev/tivmark-assistant/v16/mcp',
  'https://noodleseed.cloud.noodleseed.dev/tivmark-assistant/v17/mcp',
  'https://noodleseed.cloud.noodleseed.dev/tivmark-assistant/v18/mcp',
  'https://noodleseed.cloud.noodleseed.dev/tivmark-assistant/v19/mcp',
  'https://noodleseed.cloud.noodleseed.dev/tivmark-assistant/v20/mcp',
  'https://noodleseed.cloud.noodleseed.dev/tivmark-assistant/v21/mcp',
  'https://noodleseed.cloud.noodleseed.dev/tivmark-assistant/v22/mcp',
  'https://noodleseed.cloud.noodleseed.dev/tivmark-assistant/v23/mcp',
  'https://noodleseed.cloud.noodleseed.dev/tivmark-assistant/v24/mcp',
] as const;

// A Set, not an object map — a plain object would match inherited keys like `__proto__`.
export const ALLOWED_RESOURCES: ReadonlySet<string> = new Set(
  ALLOWED_RESOURCE_LIST
);

// Where a client that omits `resource` entirely (e.g. Gemini) gets bound. The unversioned canonical
// URL, which the Noodle deployment always routes to the current active version.
export const DEFAULT_MCP_RESOURCE = ALLOWED_RESOURCE_LIST[0];

export const isAllowedResource = (resource: string) =>
  ALLOWED_RESOURCES.has(resource);

let signingKeysPromise: ReturnType<typeof createSigningKeys> | null = null;

const createSigningKeys = async () => {
  let privateJwk: JWK;
  if (env.oauth.privateJwk) {
    privateJwk = JSON.parse(env.oauth.privateJwk) as JWK;
  } else {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('OAUTH_PRIVATE_JWK is required in production');
    }
    const pair = await generateKeyPair('ES256', { extractable: true });
    privateJwk = await exportJWK(pair.privateKey);
  }
  privateJwk.alg = 'ES256';
  privateJwk.use = 'sig';
  privateJwk.kid ||= 'tivmark-oauth-1';
  const privateKey = await importJWK(privateJwk, 'ES256');
  const publicJwk = { ...privateJwk };
  delete publicJwk.d;
  // Asymmetric verification requires the PUBLIC key; verifying with the private key throws.
  const publicKey = await importJWK(publicJwk, 'ES256');
  return { privateKey, publicKey, privateJwk, publicJwk };
};

const signingKeys = () => {
  signingKeysPromise ||= createSigningKeys();
  return signingKeysPromise;
};

export const oauthMetadata = {
  issuer,
  authorization_endpoint: `${issuer}/authorize`,
  token_endpoint: `${issuer}/token`,
  revocation_endpoint: `${issuer}/revoke`,
  userinfo_endpoint: `${issuer}/userinfo`,
  jwks_uri: `${issuer}/jwks`,
  // RFC 7591 Dynamic Client Registration — lets generic MCP clients (ChatGPT, Claude, Cursor)
  // self-register public PKCE clients instead of prompting for a manual client id.
  registration_endpoint: `${issuer}/register`,
  response_types_supported: ['code'],
  grant_types_supported: ['authorization_code', 'refresh_token'],
  // Public PKCE clients (`none`, e.g. Claude/ChatGPT) and confidential clients that authenticate
  // with a DCR-issued secret (e.g. Gemini) are both supported.
  token_endpoint_auth_methods_supported: [
    'none',
    'client_secret_basic',
    'client_secret_post',
  ],
  code_challenge_methods_supported: ['S256'],
  scopes_supported: [
    'openid',
    'profile',
    'teams',
    'members',
    'invitations',
    'time_off',
    'time_off.approve',
    'time_off.policy',
    'equipment',
    'equipment.approve',
    'credentials',
    'sso',
    'directory_sync',
    'webhooks',
    'audit_logs',
    'billing',
  ],
};

export const oauthJwks = async () => ({
  keys: [(await signingKeys()).publicJwk],
});

export const hashToken = (value: string) =>
  createHash('sha256').update(value).digest('hex');

export const randomToken = () => randomBytes(32).toString('base64url');

export const issueAccessToken = async (
  userId: string,
  clientId: string,
  scopes: string[],
  // RFC 8707: MCP-host tokens pass `[API_AUDIENCE, <exact resource URL>]` so one token satisfies both
  // Noodle's configured-audience check and the resource binding (audience checks are set membership).
  // Everything else (the v1 API / delegated exchange) keeps the scalar default.
  tokenAudience: string | string[] = API_AUDIENCE
) => {
  const keys = await signingKeys();
  return new SignJWT({
    scope: scopes.join(' '),
    client_id: clientId,
  })
    .setProtectedHeader({ alg: 'ES256', kid: keys.publicJwk.kid })
    .setIssuer(issuer)
    .setAudience(tokenAudience)
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime('15m')
    .setJti(randomToken())
    .sign(keys.privateKey);
};

export const verifyAccessToken = async (token: string) => {
  const keys = await signingKeys();
  const result = await jwtVerify(token, keys.publicKey, {
    issuer,
    // Set membership: an MCP token whose `aud` is [API_AUDIENCE, <resource>] satisfies this too.
    audience: API_AUDIENCE,
    algorithms: ['ES256'],
  });
  if (!result.payload.sub) throw new ApiError(401, 'Invalid access token');
  return {
    userId: result.payload.sub,
    clientId: String(result.payload.client_id || ''),
    scopes: String(result.payload.scope || '')
      .split(' ')
      .filter(Boolean),
  };
};

export const createOAuthPayload = async (
  model: 'AUTHORIZATION_REQUEST' | 'AUTHORIZATION_CODE' | 'REFRESH_TOKEN',
  rawToken: string,
  payload: Record<string, unknown>,
  expiresAt: Date
) =>
  prisma.oAuthPayload.create({
    data: {
      id: hashToken(rawToken),
      model,
      payload: payload as Prisma.InputJsonValue,
      expiresAt,
    },
  });

export const consumeOAuthPayload = async (
  model: 'AUTHORIZATION_REQUEST' | 'AUTHORIZATION_CODE' | 'REFRESH_TOKEN',
  rawToken: string
) => {
  const id = hashToken(rawToken);
  return prisma.$transaction(async (tx) => {
    const stored = await tx.oAuthPayload.findUnique({ where: { id } });
    if (!stored || stored.model !== model || !stored.expiresAt) {
      throw new ApiError(400, 'Invalid or expired token');
    }
    await tx.oAuthPayload.delete({ where: { id } });
    if (stored.expiresAt <= new Date()) {
      throw new ApiError(400, 'Invalid or expired token');
    }
    return stored.payload as Record<string, unknown>;
  });
};

export const getOAuthPayload = async (
  model: 'AUTHORIZATION_REQUEST' | 'AUTHORIZATION_CODE' | 'REFRESH_TOKEN',
  rawToken: string
) => {
  const stored = await prisma.oAuthPayload.findUnique({
    where: { id: hashToken(rawToken) },
  });
  if (
    !stored ||
    stored.model !== model ||
    !stored.expiresAt ||
    stored.expiresAt <= new Date()
  ) {
    throw new ApiError(400, 'Invalid or expired authorization request');
  }
  return stored.payload as Record<string, unknown>;
};

export const redirectWithAuthorizationCode = async (input: {
  clientId: string;
  userId: string;
  redirectUri: string;
  // Optional: public clients always send a PKCE challenge; confidential clients (authenticated by a
  // secret at the token endpoint) may omit it.
  codeChallenge?: string;
  scopes: string[];
  state: string;
  // RFC 8707 resource indicator — carried through to the token exchange to bind the access-token aud.
  resource?: string;
}) => {
  const code = randomToken();
  await createOAuthPayload(
    'AUTHORIZATION_CODE',
    code,
    {
      clientId: input.clientId,
      userId: input.userId,
      redirectUri: input.redirectUri,
      ...(input.codeChallenge ? { codeChallenge: input.codeChallenge } : {}),
      scopes: input.scopes,
      ...(input.resource ? { resource: input.resource } : {}),
    },
    new Date(Date.now() + 5 * 60_000)
  );
  const redirect = new URL(input.redirectUri);
  redirect.searchParams.set('code', code);
  redirect.searchParams.set('state', input.state);
  return redirect.toString();
};
