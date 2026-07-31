import { describe, expect, it } from 'vitest';
import app from '../src/server.js';

// Noodle requires an OIDC (issuer, audience) pair to belong to exactly ONE app environment — a pair
// reused across environments quarantines all of them. These assertions run against the compiled
// manifest (what the platform actually receives), not the source, so they catch a value that looks
// right in TypeScript but does not survive compilation.
const ISSUER = 'https://app.tivmark.com/oauth';
const AUDIENCE = 'tivmark-api-prod';

const serverAuth = async () => {
  const manifest = (await app.toManifest()) as {
    server: { auth?: { kind?: string; issuer?: unknown; audience?: unknown } };
  };
  return manifest.server.auth;
};

describe('customer OIDC auth', () => {
  it('compiles to the production issuer/audience pair', async () => {
    const auth = await serverAuth();
    expect(auth?.issuer).toBe(ISSUER);
    expect(auth?.audience).toBe(AUDIENCE);
  });

  it('declares the audience as a single literal string', async () => {
    const auth = await serverAuth();
    // customerAuth.oidc types `audience` as a plain string. A `variable(...)` compiles to a ConfigRef
    // OBJECT and an '${env.X}' placeholder compiles to that literal text — the first fails validate,
    // the second passes validate and deploys, then silently 401s every request because the verifier
    // compares the token's aud against the placeholder itself. Both must be impossible here.
    expect(typeof auth?.audience).toBe('string');
    expect(Array.isArray(auth?.audience)).toBe(false);
    expect(String(auth?.audience)).not.toContain('${');
  });

  it('does not carry the environment-agnostic tivmark-api audience', async () => {
    const auth = await serverAuth();
    // The bare name is what collided across environments; only the -prod suffixed form is valid here.
    expect(auth?.audience).not.toBe('tivmark-api');
    expect(String(auth?.audience).endsWith('-prod')).toBe(true);
  });

  it('keeps the audience independent of the deployed server version', async () => {
    const auth = await serverAuth();
    // The audience must stay stable as /v18/mcp becomes /v19/mcp: a resource URL here would force a
    // new (issuer, audience) pair on every deploy. The exact per-version URL rides in the token's
    // `aud` array instead (see apps/web/lib/api/oauth.ts ALLOWED_RESOURCES).
    expect(String(auth?.audience)).not.toMatch(/^https?:\/\//);
    expect(String(auth?.audience)).not.toMatch(/\/v\d+\//);
  });
});
