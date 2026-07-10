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
const audience = 'tivmark-api';
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
  return { privateKey, privateJwk, publicJwk };
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
  scopes: string[]
) => {
  const keys = await signingKeys();
  return new SignJWT({ scope: scopes.join(' '), client_id: clientId })
    .setProtectedHeader({ alg: 'ES256', kid: keys.publicJwk.kid })
    .setIssuer(issuer)
    .setAudience(audience)
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime('15m')
    .setJti(randomToken())
    .sign(keys.privateKey);
};

export const verifyAccessToken = async (token: string) => {
  const keys = await signingKeys();
  const result = await jwtVerify(token, keys.privateKey, {
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
    },
    new Date(Date.now() + 5 * 60_000)
  );
  const redirect = new URL(input.redirectUri);
  redirect.searchParams.set('code', code);
  redirect.searchParams.set('state', input.state);
  return redirect.toString();
};
