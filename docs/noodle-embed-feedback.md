# NoodleSeed Embedded Assistant — Integration Friction Report

> For the NoodleSeed developers. Documents everything that stopped a customer (the Tivmark
> portal, a Next.js 15 / React 18 app) from dropping in a working embedded assistant on the first
> try. Each item lists the symptom, the root cause, the workaround we had to apply, and the
> suggested platform fix.

## TL;DR

The embedded assistant is effectively **broken out of the box** because of **one critical
release-desync bug** (the published widget speaks a different session contract than the live
server), compounded by a set of packaging/DX gaps. Individually small; together they turned a
"should be 5 minutes" embed into a multi-hour reverse-engineering session. Fixing #1–#3 alone makes
the happy path work; fixing the rest makes it genuinely easy.

---

## CRITICAL — the assistant cannot work out of the box

### 1. Widget ↔ server session-contract mismatch (`gatewayUrl` vs `endpoints`) — the showstopper
- **Symptom:** widget renders and shows the welcome message, but every chat message gets **no
  response**. OpenRouter usage stays 0; the MCP server sees 0 traffic.
- **Root cause:** `@noodleseed/assistant@1.0.0` (the only published version) posts turns to
  `session.gatewayUrl ?? '/v1/assistant/turns'` (`dist/element.js:67`, tool-confirmations at `:95`).
  But the live Noodle Cloud session-exchange response **no longer contains `gatewayUrl`** — it now
  returns:
  ```json
  { "token": "…", "expiresAt": "…",
    "endpoints": { "turns": "https://cloud.noodleseed.dev/v1/assistant/turns",
                   "toolConfirmations": "https://cloud.noodleseed.dev/v1/assistant/tool-confirmations" },
    "configuration": { "assistant": { … } } }
  ```
  With `gatewayUrl` undefined, the widget falls back to the **relative** `/v1/assistant/turns`, which
  resolves against the **customer's own domain** (`https://app.tivmark.com/v1/assistant/turns` → 404)
  instead of the Noodle gateway. Nothing ever reaches the model.
- **Workaround:** in our backend session endpoint we now inject
  `gatewayUrl = response.endpoints.turns` before handing the session to the browser.
- **Fix:** publish a widget version whose session parsing matches the server (read `endpoints.turns`
  / `endpoints.toolConfirmations`), keep `gatewayUrl` as a back-compat alias, and **version the
  session contract**. This desync is the single reason the assistant didn't work first time.

### 2. The published `AssistantSession` TypeScript type is stale
- `@noodleseed/assistant/server`'s `AssistantSession` type declares only `{ token, expiresAt,
  gatewayUrl? }` — it does **not** include the `endpoints`/`configuration` fields the server actually
  returns. So even a correctly-typed integration is misled about the real response shape.
- **Fix:** regenerate/ship the types from the real server response.

### 3. Failures are silent and crash the host app
- When the turn request fails (relative 404, or an auth redirect returning HTML that the widget tries
  to parse as SSE), the widget throws an **unhandled exception that crashes the entire embedding
  page** (Next.js "Application error: a client-side exception has occurred").
- **Fix:** the widget must fail gracefully — surface errors via the existing `onError` prop, never
  let a network/parse error escape into the host's React tree. An embed that can take down the
  customer's whole page is a hard blocker for adoption.

---

## HIGH — blocks or badly hinders integration & build

### 4. The embed widget is a different package than it appears
- `@noodleseed/one/react` looks like the embed surface but is actually the **MCP-App authoring
  toolkit** (View/DataCard/useCallTool…). The real embed widget is a **separate** package,
  `@noodleseed/assistant` (`./react` + `./server` + web component). Nothing cross-references them.
- **Fix:** docs + package descriptions should make this obvious; ideally `@noodleseed/one` re-exports
  or points at `@noodleseed/assistant`.

### 5. ESM-only package exports break Next.js server bundling
- `@noodleseed/assistant`'s `exports` map exposes only the `import` (and `types`) condition — no
  `require`/`default`. Next.js's server-side webpack pass then fails hard:
  `Module not found: Package path ./react is not exported`.
- **Workaround:** `transpilePackages: ['@noodleseed/assistant']` **plus** a manual webpack `resolve.alias`
  pointing `@noodleseed/assistant/react` and `/server` at their `dist/*.js` files.
- **Fix:** ship a `default` (and/or `require`) export condition, or dual ESM/CJS. This is the
  single biggest reason the build wouldn't compile.

### 6. `moduleResolution: "node"` can't resolve the package at all
- Under the very common classic `moduleResolution: node`, tsc can't follow the `exports` map or the
  package's `.js`-suffixed internal type imports — `Cannot find module '@noodleseed/assistant/react'`.
- **Workaround:** we hand-wrote an ambient `.d.ts` shim mirroring the public API.
- **Fix:** ship types that resolve under `node`/`node16`/`bundler` alike (typesVersions or a flat
  `.d.ts`), and document the minimum `moduleResolution`.

### 7. `engines.node >= 24`, undocumented
- `@noodleseed/assistant` requires Node ≥24. Our CI ran Node 22 → `EBADENGINE` warnings and risk.
- **Fix:** document the requirement prominently (it's unusually high), or lower it. Most CI defaults
  are 18/20/22.

### 8. `--access customers` requires `server.auth`, surfaced only as an opaque deploy error
- `noodle deploy … --access customers` failed with `HTTP 400 … "customers access mode requires
  server.auth"` — **only at deploy time**, after a successful `noodle validate`, and with no docs
  explaining what to add.
- We had to discover `customerAuth.bridge({...})` by reading the SDK's `.d.ts`.
- **Fix:** (a) catch this at `noodle validate` (author-time), (b) document the auth requirement for
  each access mode, (c) the embedded-assistant guide should show the exact `auth:` block.

---

## MEDIUM — papercuts and trial-and-error

### 9. `allowedOrigins` is https-only → no localhost dev
- `embeddedAssistant.allowedOrigins` rejects `http://localhost:4002` at validate ("must use https").
  So you cannot exercise the real chat locally — only against the deployed https origin.
- **Fix:** allow `http://localhost[:port]` (and `http://127.0.0.1`) for dev, or provide a documented
  dev mode / tunnel story.

### 10. `serviceUrl` for `createAssistantSession` is ambiguous and undocumented
- The deploy output / `deployment.json` exposes both a deployment `url`
  (`…/tivmark-assistant/v1/mcp`) and a `serviceUrl` (`https://cloud.noodleseed.dev`). The session
  helper needs the **control-plane** `serviceUrl`; the deployment host **404s** the session endpoint.
  We found this by trial (and one probe got flagged as it POSTed a secret to guessed URLs).
- **Fix:** document exactly which URL `createAssistantSession({ serviceUrl })` takes, and ideally have
  `noodle assistant clients create` print a ready-to-use snippet including it.

### 11. Session response `endpoints` / `configuration` are undocumented
- Neither field appears in the docs or the published types, yet both are essential (endpoints to
  route turns, configuration to theme the widget).
- **Fix:** document and type the full session response.

### 12. The end-to-end embed flow isn't documented in one place
- We had to piece it together from `noodle <cmd> --help`, reading `dist/*.d.ts`, and live probing:
  `server.ts` (`embeddedAssistant` + `openAICompatible` + `customerAuth` + `allowedOrigins`) →
  `noodle deploy --access customers` → `noodle assistant clients create` → backend
  `createAssistantSession` route → `<NoodleAssistant sessionEndpoint>` mount. No single guide shows
  this consistently and correctly.
- **Fix:** one canonical, tested "Embed the assistant" page covering all of the above.

### 13. React wrapper must be client-only, not documented
- `<NoodleAssistant>` renders a web component and must be mounted client-side (we used Next
  `dynamic(..., { ssr:false })`). SSR guidance is absent.

### 14. Internal `@noodle-borg/*` packages are the real implementation, undiscoverable
- `@noodleseed/one/react` re-exports `@noodle-borg/authoring/react`; those packages aren't documented
  and aren't independently resolvable, making it hard to learn the surface without unzipping node_modules.

---

## OBSERVED RUNTIME BUG — tool-input Zod defaults not applied
- Our `greet` tool input is `z.object({ name: z.string().default('world') })`, yet calling it from the
  assistant returned `{"message":"Hello, !"}` — an **empty** name (see screenshot), not the default
  `world`. So either the model passed `name: ""` or the runtime didn't apply the Zod `.default()` when
  the arg was omitted.
- **Fix:** confirm tool-input Zod defaults are honored on the assistant's tool-call path (apply
  defaults before invoking `fulfil`); if the model emitted `""`, consider validating/marking required.

---

## What would have made this a 5-minute integration

1. **A scaffold command:** `noodle assistant embed --framework nextjs` that generates the backend
   session route, the client-only widget mount, the env keys, and the CSP hints — all matching the
   deployed server's contract. (This is the biggest lever: it sidesteps #1–#13 at once.)
2. **A single, versioned, contract-matched embed package** with normal exports (ESM+CJS/`default`),
   peer-ranged React (already `>=18 <20` — good), a sane Node floor, and types generated from the
   real server response.
3. **`noodle validate` that catches deploy-blocking rules** (customers⇒auth, model config, origins).
4. **Localhost dev support** for `allowedOrigins`.
5. **One end-to-end "Embed" doc** that is tested against the shipped packages each release.

---

## Evidence / versions (for repro)
- `@noodleseed/one` 0.33.0 (CLI + SDK); `@noodleseed/assistant` 1.0.0 (only published version).
- Deployment: `noodleseed/tivmark-assistant/prod`, access `customers`, model OpenRouter
  `anthropic/claude-sonnet-5`.
- Widget turn call: `dist/element.js:67` `fetch(this.#session.gatewayUrl ?? '/v1/assistant/turns', …)`.
- Live session response includes `endpoints.turns` / `endpoints.toolConfirmations`, **no**
  `gatewayUrl`.
- Deploy error for missing auth: `HTTP 400 [{ code:"server_auth_required",
  path:"server.auth", message:"customers access mode requires server.auth" }]`.
- Build error before workaround: `Module not found: Package path ./react is not exported from
  @noodleseed/assistant`.

---

## How we worked around each issue in this repo (reference for the fixes above)
- `apps/assistant/src/server.ts` — `embeddedAssistant` + `openAICompatible` (OpenRouter) +
  `customerAuth.bridge` + https-only `allowedOrigins`.
- `apps/web/pages/api/assistant/session.ts` — session exchange that injects
  `gatewayUrl = endpoints.turns` (workaround for #1).
- `apps/web/next.config.js` — `transpilePackages` + webpack alias (workaround for #5).
- `apps/web/types/noodleseed-assistant.d.ts` — ambient shim (workaround for #2/#6).
- `apps/web/components/shared/shell/AssistantWidget.tsx` — client-only (`ssr:false`) mount (for #13).
