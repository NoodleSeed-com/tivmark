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
// Default audience for tokens minted for Tivmark's OWN v1 API (direct API clients and the
// delegated token-exchange the assistant connector uses). `verifyAccessToken` (the v1 API) checks
// this exact value — do not change it.
const audience = 'tivmark-api';

// RFC 8707 resource indicators. Standards-based MCP hosts (Gemini, ChatGPT, Claude) request a token
// bound to the MCP server's canonical URL; we mint the access token with `aud` set to that resource
// so Noodle (the resource server fronting the MCP endpoint) accepts it. A request with no `resource`
// falls back to the `tivmark-api` audience above (backward compatible with direct v1 API clients).
export const ALLOWED_RESOURCES = [
  'https://noodleseed.cloud.noodleseed.dev/tivmark-assistant/mcp',
];
export const isAllowedResource = (resource: string) =>
  ALLOWED_RESOURCES.includes(resource);

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
  token_endpoint_auth_methods_supported: ['none'],
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
  // RFC 8707: MCP-host tokens bind `aud` to the requested resource; everything else (the v1 API /
  // delegated exchange) keeps the default `tivmark-api`.
  tokenAudience: string = audience
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
    audience,
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
  codeChallenge: string;
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
      codeChallenge: input.codeChallenge,
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
