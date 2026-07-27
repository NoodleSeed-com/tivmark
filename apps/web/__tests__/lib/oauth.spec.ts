jest.mock('jose', () => {
  class SignJWT {
    private claims: Record<string, unknown>;

    constructor(claims: Record<string, unknown>) {
      this.claims = claims;
    }

    setProtectedHeader() {
      return this;
    }

    setIssuer(issuer: string) {
      this.claims.iss = issuer;
      return this;
    }

    setAudience(audience: string) {
      this.claims.aud = audience;
      return this;
    }

    setSubject(subject: string) {
      this.claims.sub = subject;
      return this;
    }

    setIssuedAt() {
      return this;
    }

    setExpirationTime() {
      return this;
    }

    setJti() {
      return this;
    }

    async sign() {
      return Buffer.from(JSON.stringify(this.claims)).toString('base64url');
    }
  }

  return {
    SignJWT,
    exportJWK: jest.fn(async () => ({
      kty: 'EC',
      crv: 'P-256',
      x: 'public-x',
      y: 'public-y',
      d: 'private-d',
    })),
    generateKeyPair: jest.fn(async () => ({ privateKey: {} })),
    importJWK: jest.fn(async () => ({})),
    jwtVerify: jest.fn(async (token: string) => ({
      payload: JSON.parse(Buffer.from(token, 'base64url').toString()),
    })),
  };
});

import {
  ALLOWED_RESOURCES,
  hashToken,
  isAllowedResource,
  issueAccessToken,
  oauthJwks,
  oauthMetadata,
  randomToken,
  verifyAccessToken,
} from '@/lib/api/oauth';

// The mocked `jose.SignJWT.sign` returns base64url(JSON(claims)), so we can read the bound aud back.
const decodeAud = (token: string): string =>
  JSON.parse(Buffer.from(token, 'base64url').toString()).aud;

const MCP_RESOURCE =
  'https://noodleseed.cloud.noodleseed.dev/tivmark-assistant/mcp';

describe('OAuth 2.1 helpers', () => {
  it('advertises authorization code flow with S256 PKCE', () => {
    expect(oauthMetadata.response_types_supported).toEqual(['code']);
    expect(oauthMetadata.code_challenge_methods_supported).toEqual(['S256']);
    expect(oauthMetadata.token_endpoint_auth_methods_supported).toEqual([
      'none',
    ]);
  });

  it('issues and verifies scoped access tokens', async () => {
    const token = await issueAccessToken('user-1', 'client-1', [
      'profile',
      'teams',
    ]);

    await expect(verifyAccessToken(token)).resolves.toEqual({
      userId: 'user-1',
      clientId: 'client-1',
      scopes: ['profile', 'teams'],
    });
  });

  it('publishes only the public signing key', async () => {
    const jwks = await oauthJwks();
    expect(jwks.keys[0]).toMatchObject({ alg: 'ES256', use: 'sig' });
    expect(jwks.keys[0]).not.toHaveProperty('d');
  });

  it('creates high-entropy, hashable opaque tokens', () => {
    const first = randomToken();
    const second = randomToken();
    expect(first).not.toBe(second);
    expect(hashToken(first)).toMatch(/^[a-f0-9]{64}$/);
  });

  it('advertises the equipment scopes it actually enforces', () => {
    expect(oauthMetadata.scopes_supported).toEqual(
      expect.arrayContaining(['equipment', 'equipment.approve'])
    );
  });

  it('recognizes the MCP resource and rejects unknown resources (RFC 8707)', () => {
    expect(ALLOWED_RESOURCES).toContain(MCP_RESOURCE);
    expect(isAllowedResource(MCP_RESOURCE)).toBe(true);
    expect(isAllowedResource('https://evil.example.com/mcp')).toBe(false);
  });

  it('defaults the access-token aud to tivmark-api (v1 API / delegated exchange)', async () => {
    const token = await issueAccessToken('user-1', 'client-1', ['time_off']);
    expect(decodeAud(token)).toBe('tivmark-api');
  });

  it('binds the access-token aud to the requested MCP resource', async () => {
    const token = await issueAccessToken(
      'user-1',
      'client-1',
      ['time_off'],
      MCP_RESOURCE
    );
    expect(decodeAud(token)).toBe(MCP_RESOURCE);
  });
});
