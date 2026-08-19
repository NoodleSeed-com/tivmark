import { describe, expect, it } from 'vitest';

import app from '../src/server.js';

/**
 * Tools a stranger on tivmark.com is allowed to run.
 *
 * Keep this list tiny and deliberate. The compiler refuses to project a `${user}`-reading tool
 * onto a `public` surface, but it classifies on `${user}` references and declared authorization
 * only -- NOT on the connector's auth kind. Every other Tivmark tool reaches the API through
 * `delegatedTokenExchange`, which has no credential without a signed-in person, so listing one
 * here would compile cleanly and then fail at runtime with `credential_unavailable`. The
 * no-connector assertion below is what actually holds that line.
 */
const ANONYMOUS_SAFE_TOOLS = new Set(['talk_to_sales']);

/**
 * Identity-gated tools deliberately offered to visitors. Each is backed by the delegated
 * connector, so for an anonymous session the service intercepts the call into a sign-in card
 * (Noodle r601 classifies on the connector's auth kind); after sign-in it runs as the real
 * person. Listing one here is the opt-in to ADVERTISE it — Tivmark's API still authorizes it.
 */
const IDENTITY_GATED_TOOLS = new Set([
  'my_teams',
  'time_off_balance',
  'my_time_off',
  'my_equipment',
  'book_time_off',
]);

const PUBLIC_ORIGINS = ['https://tivmark.com', 'https://www.tivmark.com'];
const AUTHENTICATED_ORIGINS = [
  'http://localhost:4002',
  'https://app.tivmark.com',
];

describe('public website surface', () => {
  it('serves the marketing origins anonymously and the app origins signed in', async () => {
    const manifest = await app.toManifest();
    const surfaces = manifest.server.assistant?.surfaces ?? [];

    const publicSurfaces = surfaces.filter(
      (surface) => surface.mode === 'public' || surface.mode === 'mixed',
    );
    const authenticatedSurfaces = surfaces.filter(
      (surface) => surface.mode === 'authenticated',
    );

    // At most one of each is a platform rule; exactly one of each is this product's shape.
    expect(publicSurfaces).toHaveLength(1);
    expect(authenticatedSurfaces).toHaveLength(1);

    // signIn: true — visitors can sign in mid-conversation and keep the thread.
    expect(publicSurfaces[0]!.mode).toBe('mixed');

    // Both the apex and www serve the marketing site with no redirect between them. Origins
    // are matched character-for-character, so dropping either silently breaks that host.
    expect([...publicSurfaces[0]!.origins].sort()).toEqual(
      [...PUBLIC_ORIGINS].sort(),
    );
    expect([...authenticatedSurfaces[0]!.origins].sort()).toEqual(
      [...AUTHENTICATED_ORIGINS].sort(),
    );

    // An origin on two surfaces would make "which projection is this request?" ambiguous.
    const allOrigins = surfaces.flatMap((surface) => [...surface.origins]);
    expect(new Set(allOrigins).size).toBe(allOrigins.length);
  });

  it('splits the mixed surface into anonymous-safe and identity-gated capabilities', async () => {
    const manifest = await app.toManifest();
    const surface = (manifest.server.assistant?.surfaces ?? []).find(
      (candidate) => candidate.mode === 'public' || candidate.mode === 'mixed',
    );
    expect(surface).toBeDefined();

    const capabilities = surface?.capabilities ?? [];
    expect(capabilities.length).toBeGreaterThan(0);

    for (const capability of capabilities) {
      if (capability.kind !== 'tool') continue;

      const anonymousSafe = ANONYMOUS_SAFE_TOOLS.has(capability.name);
      const identityGated = IDENTITY_GATED_TOOLS.has(capability.name);
      expect(
        anonymousSafe !== identityGated,
        `${capability.name} must be on exactly one of the two deliberate lists`,
      ).toBe(true);

      const tool = manifest.tools.find(
        (candidate) => candidate.name === capability.name,
      );
      expect(tool, `missing manifest tool ${capability.name}`).toBeDefined();
      const fulfilment = JSON.stringify(tool?.fulfilment ?? {});
      // A connector-backed step compiles as {"use":"<connector>.<op>"} — the earlier
      // "kind":"operation" check matched nothing in this manifest shape and passed vacuously.
      const touchesConnector = /"use":"/.test(fulfilment);

      if (anonymousSafe) {
        // Runs for a stranger, so it must need nothing a stranger lacks: no verified
        // identity, and no connector whose delegated credential does not exist.
        expect(
          fulfilment.includes('${user'),
          `${capability.name} reads \${user} but must run anonymously`,
        ).toBe(false);
        expect(tool?.authorization).toBeUndefined();
        expect(
          touchesConnector,
          `${capability.name} calls a connector, which needs a signed-in user's credential`,
        ).toBe(false);
      } else {
        // The sign-in card only raises for a tool the service classifies as needing
        // identity — for these, via the delegated connector. A gated tool that touched no
        // connector and read no \${user} would silently run anonymously instead.
        expect(
          touchesConnector || fulfilment.includes('${user'),
          `${capability.name} is listed as identity-gated but nothing would gate it`,
        ).toBe(true);
        // Public/mixed compiler rule: connector-touching tools must be read-only or
        // confirmed, so an elevated visitor still reviews any write.
        const annotations = tool?.annotations as
          | { readOnlyHint?: boolean; confirm?: boolean }
          | undefined;
        expect(
          annotations?.readOnlyHint === true || annotations?.confirm === true,
          `${capability.name} must be read-only or confirm-gated on a mixed surface`,
        ).toBe(true);
      }
    }
  });

  it('grounds the public surface in the Tivmark knowledge component', async () => {
    const manifest = await app.toManifest();
    const surface = (manifest.server.assistant?.surfaces ?? []).find(
      (candidate) => candidate.mode === 'public' || candidate.mode === 'mixed',
    );

    expect(surface?.capabilities).toContainEqual({
      kind: 'knowledge',
      name: 'tivmark_help',
    });

    const declared = manifest.server.knowledge ?? [];
    const component = declared.find((entry) => entry.name === 'tivmark_help');
    expect(component, 'tivmark_help must be declared on the server').toBeDefined();

    // Documents ship with the app; the site scope is the freshness half.
    expect(component?.documents.length).toBeGreaterThanOrEqual(6);
    for (const document of component?.documents ?? []) {
      expect(document.title, 'every document needs a citation label').toBeTruthy();
      expect(document.path).toMatch(/^\.\/knowledge\/.+\.md$/);
    }

    // The marketing site serves its single page for every path, so a wider glob would crawl
    // the same document under unbounded URLs.
    expect(component?.sites).toEqual([
      expect.objectContaining({
        origin: 'https://tivmark.com',
        include: ['/'],
      }),
    ]);
  });

  it('greets both audiences, because copy is per-assistant not per-surface', async () => {
    // `labels` and `suggestedPrompts` sit on the assistant, so the marketing site and the
    // signed-in product show the SAME copy. A prompt that only a signed-in user can act on
    // is, for a visitor on tivmark.com, a button whose only possible answer is "sign in".
    const manifest = await app.toManifest();
    const prompts = manifest.server.assistant?.suggestedPrompts ?? [];

    expect(prompts.length).toBeGreaterThan(0);

    // At least half must be answerable with no account at all -- i.e. from the knowledge
    // component -- so the public surface opens with something that actually works.
    const firstPersonPrompt = /\bmy\b|\bI\b|\bme\b/i;
    const anonymousAnswerable = prompts.filter(
      (prompt) => !firstPersonPrompt.test(prompt),
    );
    expect(
      anonymousAnswerable.length,
      `most starter prompts must work without an account; got ${JSON.stringify(prompts)}`,
    ).toBeGreaterThanOrEqual(Math.ceil(prompts.length / 2));

    // The first prompt is the most prominent one, so it must be the safe one.
    expect(firstPersonPrompt.test(prompts[0] ?? '')).toBe(false);
  });

  it('discloses a privacy policy to anonymous visitors', async () => {
    const manifest = await app.toManifest();
    // A public assistant collects whatever a stranger types into it. `noodle check` warns
    // (assistant_public_disclosure) when a public surface has no privacy link.
    expect(manifest.server.assistant?.privacyUrl).toMatch(/^https:\/\//);
  });

  it('only offers links the declared handoff allowlist can open', async () => {
    // `handoff.allowedDomains` is consumed when widgets are compiled rather than stored on
    // the manifest, so `noodle check`'s `handoff_allowlist` finding is what confirms the
    // declaration. What matters here is the half that would actually break for a visitor:
    // the widget must never render a link the host will then refuse to open.
    const allowedDomains = ['https://tivmark.com', 'https://app.tivmark.com'];
    const manifest = await app.toManifest();
    const tool = manifest.tools.find(
      (candidate) => candidate.name === 'talk_to_sales',
    );
    const urls = JSON.stringify(tool?.fulfilment ?? {}).match(
      /https:\/\/[^"'\\ ]+/g,
    );

    expect(urls, 'talk_to_sales must offer at least one link').toBeTruthy();
    for (const url of urls ?? []) {
      expect(
        allowedDomains.some((domain) => url.startsWith(domain)),
        `${url} is offered to visitors but is outside handoff.allowedDomains`,
      ).toBe(true);
    }
  });
});
