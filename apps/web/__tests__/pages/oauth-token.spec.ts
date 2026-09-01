import { execFileSync } from 'child_process';
import { randomBytes } from 'crypto';
import { existsSync } from 'fs';
import path from 'path';

// The mocked signer returns base64url(JSON(claims)) so a test can read back the exact `aud` the
// handler bound — the point of these tests is the claim shape, not the signature.
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
    exportJWK: jest.fn(async () => ({ kty: 'EC', crv: 'P-256', d: 'priv' })),
    generateKeyPair: jest.fn(async () => ({ privateKey: {} })),
    importJWK: jest.fn(async () => ({})),
    jwtVerify: jest.fn(),
  };
});

// In-memory stand-in for the two tables the token endpoint touches. The factory is self-contained
// because jest.mock is hoisted above every const in this file; the maps come back out via __clients /
// __payloads so tests can seed grants and inspect what was persisted. `$transaction` runs its callback
// against the same store, which is enough to exercise the single-use consume path.
type Row = {
  id: string;
  model: string;
  payload: Record<string, unknown>;
  expiresAt: Date | null;
};

jest.mock('../../lib/prisma', () => {
  const clients = new Map<string, Record<string, unknown>>();
  const payloads = new Map<string, Row>();

  const store = {
    oAuthClient: {
      findUnique: async ({ where }: { where: { clientId: string } }) =>
        clients.get(where.clientId) ?? null,
    },
    oAuthPayload: {
      findUnique: async ({ where }: { where: { id: string } }) =>
        payloads.get(where.id) ?? null,
      delete: async ({ where }: { where: { id: string } }) => {
        const row = payloads.get(where.id);
        payloads.delete(where.id);
        return row;
      },
      create: async ({ data }: { data: Row }) => {
        payloads.set(data.id, data);
        return data;
      },
    },
  };

  return {
    prisma: {
      ...store,
      $transaction: async (fn: (tx: typeof store) => unknown) => fn(store),
    },
    __clients: clients,
    __payloads: payloads,
  };
});

import handler from '../../pages/api/oauth-v1/token';
import {
  API_AUDIENCE,
  DEFAULT_MCP_RESOURCE,
  hashToken,
} from '../../lib/api/oauth';

const { __clients: clients, __payloads: payloads } = jest.requireMock(
  '../../lib/prisma'
) as { __clients: Map<string, unknown>; __payloads: Map<string, Row> };

const MCP_RESOURCE = DEFAULT_MCP_RESOURCE;
const MCP_RESOURCE_V24 =
  'https://noodleseed.cloud.noodleseed.dev/tivmark-assistant/v24/mcp';
const CLIENT_ID = 'client-under-test';
const REDIRECT_URI = 'https://client.example.com/callback';
const USER_ID = 'user-1';

type Captured = { status: number; body: any; headers: Record<string, string> };

const invoke = async (body: Record<string, unknown>): Promise<Captured> => {
  const captured: Captured = { status: 0, body: undefined, headers: {} };
  const res: any = {
    setHeader: (key: string, value: string) => {
      captured.headers[key] = value;
    },
    status(code: number) {
      captured.status = code;
      return this;
    },
    json(payload: unknown) {
      captured.body = payload;
      return this;
    },
  };
  await handler({ method: 'POST', headers: {}, body } as any, res);
  return captured;
};

const decodeClaims = (token: string) =>
  JSON.parse(Buffer.from(token, 'base64url').toString());

// Seeds a consumable authorization code the way redirectWithAuthorizationCode does.
const seedCode = (resource?: string) => {
  const code = randomBytes(32).toString('base64url');
  payloads.set(hashToken(code), {
    id: hashToken(code),
    model: 'AUTHORIZATION_CODE',
    payload: {
      clientId: CLIENT_ID,
      userId: USER_ID,
      redirectUri: REDIRECT_URI,
      scopes: ['time_off'],
      ...(resource ? { resource } : {}),
    },
    expiresAt: new Date(Date.now() + 60_000),
  });
  return code;
};

const exchangeCode = (code: string, resource?: string) =>
  invoke({
    grant_type: 'authorization_code',
    code,
    client_id: CLIENT_ID,
    client_secret: 'shhh',
    redirect_uri: REDIRECT_URI,
    ...(resource ? { resource } : {}),
  });

const refresh = (refreshToken: string, resource?: string) =>
  invoke({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: CLIENT_ID,
    client_secret: 'shhh',
    ...(resource ? { resource } : {}),
  });

beforeEach(() => {
  clients.clear();
  payloads.clear();
  // A confidential client, so the exchange is authenticated by its secret and PKCE is not required.
  clients.set(CLIENT_ID, {
    clientId: CLIENT_ID,
    clientSecret: hashToken('shhh'),
    redirectUris: [REDIRECT_URI],
    scopes: ['time_off'],
    trusted: true,
  });
});

describe('POST /oauth/token — access-token audience binding', () => {
  it('binds both the configured audience and the exact MCP resource', async () => {
    const res = await exchangeCode(seedCode(MCP_RESOURCE), MCP_RESOURCE);

    expect(res.status).toBe(200);
    const claims = decodeClaims(res.body.access_token);
    expect(claims.aud).toEqual([API_AUDIENCE, MCP_RESOURCE]);
    expect(claims.iss).toBe(`${process.env.APP_URL}/oauth`);
    expect(claims.sub).toBe(USER_ID);
  });

  it('binds the exact versioned resource while keeping the stable audience', async () => {
    // /v24/mcp and /mcp are distinct resources that share one environment audience — the audience
    // does not move when the deployed server version does.
    const res = await exchangeCode(
      seedCode(MCP_RESOURCE_V24),
      MCP_RESOURCE_V24
    );

    expect(res.status).toBe(200);
    const claims = decodeClaims(res.body.access_token);
    expect(claims.aud).toEqual([API_AUDIENCE, MCP_RESOURCE_V24]);
    expect(claims.aud).not.toContain(MCP_RESOURCE);
  });

  it('pins a client that omits `resource` to the canonical MCP resource', async () => {
    const res = await exchangeCode(seedCode());

    expect(res.status).toBe(200);
    expect(decodeClaims(res.body.access_token).aud).toEqual([
      API_AUDIENCE,
      DEFAULT_MCP_RESOURCE,
    ]);
  });

  it('never mints the retired shared audience', async () => {
    const res = await exchangeCode(seedCode(MCP_RESOURCE), MCP_RESOURCE);
    expect(decodeClaims(res.body.access_token).aud).not.toContain(
      'tivmark-api'
    );
  });

  it('preserves both audience values through a refresh', async () => {
    const first = await exchangeCode(
      seedCode(MCP_RESOURCE_V24),
      MCP_RESOURCE_V24
    );
    const refreshed = await refresh(first.body.refresh_token);

    expect(refreshed.status).toBe(200);
    expect(decodeClaims(refreshed.body.access_token).aud).toEqual([
      API_AUDIENCE,
      MCP_RESOURCE_V24,
    ]);
  });

  it('preserves the default binding through a refresh when `resource` was omitted', async () => {
    // The RESOLVED resource is persisted on the refresh family, so the refreshed token reproduces the
    // same pair rather than silently losing its resource entry.
    const first = await exchangeCode(seedCode());
    const refreshed = await refresh(first.body.refresh_token);

    expect(decodeClaims(refreshed.body.access_token).aud).toEqual([
      API_AUDIENCE,
      DEFAULT_MCP_RESOURCE,
    ]);
  });
});

describe('POST /oauth/token — resource validation', () => {
  it('rejects a token request whose resource does not match the authorization', async () => {
    const res = await exchangeCode(seedCode(MCP_RESOURCE), MCP_RESOURCE_V24);
    expect(res.status).toBe(400);
    expect(res.body.detail).toMatch(/invalid_target/);
  });

  it('rejects a foreign, wrong-app, or wrong-path resource carried on the code', async () => {
    for (const rejected of [
      'https://evil.example.com/mcp',
      'https://noodleseed.cloud.noodleseed.dev/other-assistant/mcp',
      'https://noodleseed.cloud.noodleseed.dev/tivmark-assistant/v1/mcp',
      'https://noodleseed.cloud.noodleseed.dev/tivmark-assistant/mcp/',
    ]) {
      const res = await exchangeCode(seedCode(rejected), rejected);
      expect(res.status).toBe(400);
      expect(res.body.detail).toMatch(/invalid_target/);
    }
  });

  it('rejects a resource swapped in at refresh time', async () => {
    const first = await exchangeCode(seedCode(MCP_RESOURCE), MCP_RESOURCE);
    const swapped = await refresh(first.body.refresh_token, MCP_RESOURCE_V24);

    expect(swapped.status).toBe(400);
    expect(swapped.body.detail).toMatch(/invalid_target/);
  });
});

describe('POST /oauth/token — token response shape', () => {
  it('issues no ID token and never puts the client id in aud', async () => {
    // Nothing here issues an ID token; identity is served by /oauth/userinfo. This locks that in so a
    // future change cannot quietly start minting one, and guarantees the access-token audience stays
    // the resource/API audience rather than drifting toward ID-token (client id) semantics.
    const res = await exchangeCode(seedCode(MCP_RESOURCE), MCP_RESOURCE);

    expect(res.body).not.toHaveProperty('id_token');
    expect(decodeClaims(res.body.access_token).aud).not.toContain(CLIENT_ID);
    expect(res.body.token_type).toBe('Bearer');
  });

  it('marks token responses no-store', async () => {
    const res = await exchangeCode(seedCode(MCP_RESOURCE), MCP_RESOURCE);
    expect(res.headers['Cache-Control']).toBe('no-store');
  });

  it('stores only hashed grants, never the raw code or refresh token', async () => {
    const code = seedCode(MCP_RESOURCE);
    const res = await exchangeCode(code, MCP_RESOURCE);
    const stored = Array.from(payloads.keys());

    // The authorization code is single-use: consumed and gone.
    expect(stored).not.toContain(hashToken(code));
    // The refresh token is retrievable only by its sha256, and its raw form is nowhere in the table.
    expect(stored).toContain(hashToken(res.body.refresh_token));
    expect(stored).not.toContain(res.body.refresh_token);
    expect(JSON.stringify(Array.from(payloads.values()))).not.toContain(
      res.body.refresh_token
    );
  });
});

describe('POST /oauth/token — log hygiene', () => {
  const methods = ['log', 'info', 'warn', 'error', 'debug'] as const;

  it('writes nothing to the console on success or failure', async () => {
    const spies = methods.map((m) =>
      jest.spyOn(console, m).mockImplementation(() => {})
    );

    try {
      // Success path.
      const ok = await exchangeCode(seedCode(MCP_RESOURCE), MCP_RESOURCE);
      // Refresh path.
      await refresh(ok.body.refresh_token);
      // Failure paths: unknown resource, replayed code, bad client secret.
      await exchangeCode(
        seedCode('https://evil.example.com/mcp'),
        'https://evil.example.com/mcp'
      );
      const replayed = seedCode(MCP_RESOURCE);
      await exchangeCode(replayed, MCP_RESOURCE);
      await exchangeCode(replayed, MCP_RESOURCE);
      await invoke({
        grant_type: 'authorization_code',
        code: seedCode(MCP_RESOURCE),
        client_id: CLIENT_ID,
        client_secret: 'wrong',
        redirect_uri: REDIRECT_URI,
      });

      for (const spy of spies) {
        expect(spy).not.toHaveBeenCalled();
      }
    } finally {
      spies.forEach((spy) => spy.mockRestore());
    }
  });

  it('keeps bearer material out of error responses', async () => {
    const code = seedCode(MCP_RESOURCE);
    const res = await exchangeCode(code, MCP_RESOURCE_V24);

    const serialized = JSON.stringify(res.body);
    expect(serialized).not.toContain(code);
    expect(serialized).not.toContain('shhh');
  });
});

describe('OAuth source hygiene', () => {
  it('has no console calls in the OAuth server code', () => {
    // A static guard: the spy test above only covers the paths it exercises, this covers every line.
    const root = path.resolve(__dirname, '../..');
    const targets = ['pages/api/oauth-v1', 'lib/api/oauth.ts'].filter((t) =>
      existsSync(path.join(root, t))
    );
    expect(targets).toHaveLength(2);

    // grep exits 1 when it finds nothing, which is the passing case here.
    let found = '';
    try {
      found = execFileSync(
        'grep',
        ['-rn', '--include=*.ts', 'console\\.', ...targets],
        { cwd: root, encoding: 'utf8' }
      );
    } catch {
      found = '';
    }
    expect(found).toBe('');
  });
});
