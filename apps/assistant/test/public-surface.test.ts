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

  it('exposes only anonymous-safe capabilities to the public surface', async () => {
    const manifest = await app.toManifest();
    const surface = (manifest.server.assistant?.surfaces ?? []).find(
      (candidate) => candidate.mode === 'public' || candidate.mode === 'mixed',
    );
    expect(surface).toBeDefined();

    const capabilities = surface?.capabilities ?? [];
    expect(capabilities.length).toBeGreaterThan(0);

    for (const capability of capabilities) {
      if (capability.kind !== 'tool') continue;

      expect(
        ANONYMOUS_SAFE_TOOLS.has(capability.name),
        `${capability.name} is on the public surface but is not on the anonymous-safe list`,
      ).toBe(true);

      const tool = manifest.tools.find(
        (candidate) => candidate.name === capability.name,
      );
      expect(tool, `missing manifest tool ${capability.name}`).toBeDefined();

      const fulfilment = JSON.stringify(tool?.fulfilment ?? {});

      // No verified identity exists for an anonymous visitor.
      expect(
        fulfilment.includes('${user'),
        `${capability.name} reads \${user} but is projected to an anonymous surface`,
      ).toBe(false);
      expect(tool?.authorization).toBeUndefined();

      // The real guard: no connector operation, so no delegated credential is ever needed.
      expect(
        /"kind":"operation"/.test(fulfilment),
        `${capability.name} calls a connector, which needs a signed-in user's delegated credential`,
      ).toBe(false);
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
