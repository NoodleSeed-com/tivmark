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

    setAudience(audience: string | string[]) {
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
    jwtVerify: jest.fn(
      async (
        token: string,
        _key: unknown,
        options?: { issuer?: string; audience?: string }
      ) => {
        const payload = JSON.parse(Buffer.from(token, 'base64url').toString());
        // Mirror real jose: `aud` may be a string or an array, and the check is set MEMBERSHIP, not
        // scalar equality. The two-audience design depends on that, so the mock must not paper over it.
        if (options?.audience !== undefined) {
          const claimed: string[] = Array.isArray(payload.aud)
            ? payload.aud
            : [payload.aud];
          if (!claimed.includes(options.audience)) {
            throw new Error('unexpected "aud" claim value');
          }
        }
        if (options?.issuer !== undefined && payload.iss !== options.issuer) {
          throw new Error('unexpected "iss" claim value');
        }
        return { payload };
      }
    ),
  };
});

import {
  API_AUDIENCE,
  ALLOWED_RESOURCES,
  DEFAULT_MCP_RESOURCE,
  hashToken,
  isAllowedResource,
  issueAccessToken,
  oauthJwks,
  oauthMetadata,
  randomToken,
  verifyAccessToken,
} from '@/lib/api/oauth';

// The mocked `jose.SignJWT.sign` returns base64url(JSON(claims)), so we can read the bound aud back.
const decodeAud = (token: string): string | string[] =>
  JSON.parse(Buffer.from(token, 'base64url').toString()).aud;

const MCP_RESOURCE =
  'https://noodleseed.cloud.noodleseed.dev/tivmark-assistant/mcp';
const MCP_RESOURCE_V24 =
  'https://noodleseed.cloud.noodleseed.dev/tivmark-assistant/v24/mcp';

describe('OAuth 2.1 helpers', () => {
  it('advertises authorization code flow with S256 PKCE', () => {
    expect(oauthMetadata.response_types_supported).toEqual(['code']);
    expect(oauthMetadata.code_challenge_methods_supported).toEqual(['S256']);
  });

  it('supports public and confidential client authentication', () => {
    // Public PKCE clients (Claude/ChatGPT) + confidential secret clients (Gemini).
    expect(oauthMetadata.token_endpoint_auth_methods_supported).toEqual(
      expect.arrayContaining([
        'none',
        'client_secret_basic',
        'client_secret_post',
      ])
    );
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

  it('advertises Action Desk request and manager scopes', () => {
    expect(oauthMetadata.scopes_supported).toEqual(
      expect.arrayContaining(['service_requests', 'service_requests.manage'])
    );
  });

  it('uses an environment-specific configured audience, never the bare tivmark-api', () => {
    // Noodle requires an (issuer, audience) pair to belong to exactly one app environment. The bare
    // `tivmark-api` was shared, which quarantines every environment that declares it.
    expect(API_AUDIENCE).toBe('tivmark-api-prod');
    expect(API_AUDIENCE).not.toBe('tivmark-api');
  });

  it('keeps the configured audience stable across server versions', () => {
    // /v23/mcp → /v24/mcp must not change the configured audience; only the resource entry moves.
    expect(API_AUDIENCE).not.toMatch(/^https?:\/\//);
    expect(API_AUDIENCE).not.toMatch(/\/v\d+\//);
  });

  it('recognizes every active MCP resource, versioned and unversioned (RFC 8707)', () => {
    expect(isAllowedResource(MCP_RESOURCE)).toBe(true);
    expect(isAllowedResource(MCP_RESOURCE_V24)).toBe(true);
    // Distinct resources that nonetheless share the one stable environment audience.
    expect(MCP_RESOURCE_V24).not.toBe(MCP_RESOURCE);
    expect(ALLOWED_RESOURCES.has(DEFAULT_MCP_RESOURCE)).toBe(true);
  });

  it('covers exactly the versions that name us as their authorization server', () => {
    // v8-v28 declare customerAuth.oidc against https://app.tivmark.com/oauth; v29 is reserved for
    // this rollout so the web authorization server can deploy before the assistant. v1-v7 predate
    // that switch and route to Noodle's own AS, so listing them would widen the allowlist for no one.
    const url = (v: number) =>
      `https://noodleseed.cloud.noodleseed.dev/tivmark-assistant/v${v}/mcp`;

    for (let v = 8; v <= 29; v += 1) {
      expect([v, isAllowedResource(url(v))]).toEqual([v, true]);
    }
    for (let v = 1; v <= 7; v += 1) {
      expect([v, isAllowedResource(url(v))]).toEqual([v, false]);
    }
    // Every versioned entry shares the one audience; none of them IS the audience.
    expect(ALLOWED_RESOURCES.has(API_AUDIENCE)).toBe(false);
  });

  it('rejects a resource for another host, app, environment, or path', () => {
    for (const rejected of [
      // Foreign host.
      'https://evil.example.com/mcp',
      'https://noodleseed.cloud.evil.dev/tivmark-assistant/mcp',
      // Another app on our own host.
      'https://noodleseed.cloud.noodleseed.dev/other-assistant/mcp',
      // Another org/environment segment.
      'https://otherorg.cloud.noodleseed.dev/tivmark-assistant/mcp',
      // A version we do not serve, and one whose authorization server is Noodle's own, not ours.
      'https://noodleseed.cloud.noodleseed.dev/tivmark-assistant/v1/mcp',
      'https://noodleseed.cloud.noodleseed.dev/tivmark-assistant/v99/mcp',
      // Unexpected path, including a traversal that would resolve to an allowed URL only if we
      // normalized — we do not.
      'https://noodleseed.cloud.noodleseed.dev/tivmark-assistant',
      'https://noodleseed.cloud.noodleseed.dev/tivmark-assistant/mcp/extra',
      'https://noodleseed.cloud.noodleseed.dev/tivmark-assistant/v18/../mcp',
      // Exact string equality: trailing slash, case, port, and scheme variants all fail closed.
      'https://noodleseed.cloud.noodleseed.dev/tivmark-assistant/mcp/',
      'https://noodleseed.cloud.noodleseed.dev/tivmark-assistant/MCP',
      'https://NOODLESEED.cloud.noodleseed.dev/tivmark-assistant/mcp',
      'https://noodleseed.cloud.noodleseed.dev:443/tivmark-assistant/mcp',
      'http://noodleseed.cloud.noodleseed.dev/tivmark-assistant/mcp',
      // Prototype keys must not masquerade as allowed entries (hence a Set, not an object map).
      '__proto__',
      'constructor',
    ]) {
      expect(isAllowedResource(rejected)).toBe(false);
    }
  });

  it('defaults the access-token aud to the configured audience (v1 API / delegated exchange)', async () => {
    const token = await issueAccessToken('user-1', 'client-1', ['time_off']);
    expect(decodeAud(token)).toBe(API_AUDIENCE);
  });

  it('binds the access-token aud to both the audience and the exact MCP resource', async () => {
    const token = await issueAccessToken(
      'user-1',
      'client-1',
      ['time_off'],
      [API_AUDIENCE, MCP_RESOURCE]
    );
    expect(decodeAud(token)).toEqual([API_AUDIENCE, MCP_RESOURCE]);
    expect(decodeAud(token)).not.toContain('tivmark-api');
  });

  it('verifies a two-audience MCP token against the configured audience', async () => {
    // Audience checks are set membership, so the pair satisfies both this API and Noodle at once.
    const token = await issueAccessToken(
      'user-1',
      'client-1',
      ['time_off'],
      [API_AUDIENCE, MCP_RESOURCE_V24]
    );
    await expect(verifyAccessToken(token)).resolves.toMatchObject({
      userId: 'user-1',
    });
  });

  it('rejects a token minted for the retired tivmark-api audience', async () => {
    // Clean cutover: nothing accepts the shared audience any more, in either direction.
    const stale = await issueAccessToken(
      'user-1',
      'client-1',
      ['time_off'],
      'tivmark-api'
    );
    await expect(verifyAccessToken(stale)).rejects.toThrow();
  });

  it('rejects a token bound only to the MCP resource', async () => {
    // The resource alone is not enough for the v1 API — the configured audience must be present.
    const resourceOnly = await issueAccessToken(
      'user-1',
      'client-1',
      ['time_off'],
      MCP_RESOURCE
    );
    await expect(verifyAccessToken(resourceOnly)).rejects.toThrow();
  });
});
