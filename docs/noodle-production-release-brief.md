# Everything Tivmark needs from Noodle Seed to finish the end-to-end demo

**From:** Tivmark (Noodle Seed sample customer site)
**To:** Noodle Seed engineering
**Date:** 2026-08-19
**Refs:** fb-1163, fb-1164 (both P0, area `deploys`)
**Prior correspondence:** `docs/noodle-assistant-elevation-gap.md` and your reply of 2026-08-19

---

## 0 — How to read this, and the definition of done

This document is intended to be **the complete list**. If every item in §1–§3 is done and every
confirmation in §3 is answered, we can finish the demo without coming back with further asks.
§5 is the definition of done: a table mapping every demo scenario to the Noodle-side dependency
that gates it and the action we take the moment it clears. §4 is welcome-but-not-blocking; feel
free to defer all of it.

Priority order:

1. **§1 — Restore the deploy preflight** (P0 outage, ~9 hours). Blocks literally everything,
   including work of yours we have already integrated.
2. **§2 — Release the mixed-mode sign-in fixes to production**, with acceptance criteria per fix
   so they can be cherry-picked if the full release is slower.
3. **§3 — Six confirmations** we need in writing. Most are one-sentence answers; two are "watch
   our first deploy land" requests.

---

## 1 — P0: the deploy preflight has returned 503 for ~9 hours

### 1.1 The failure

```console
$ noodle deploy --org noodleseed --app tivmark-assistant --env prod --access customers --version 19 --json
{"ok":false,"error":{"code":"deploy_preflight_failed","message":"request failed (503)",
 "fix":"Repair the reported preflight problem before deploying.",
 "next":"noodle doctor --service https://cloud.noodleseed.dev",
 "detail":{"status":503,"target":{"org":"noodleseed","app":"tivmark-assistant","env":"prod"}}}}
```

First observed ~2026-08-19T05:30Z. Still failing at time of writing. Retried automatically every
2–3 minutes throughout — roughly 200 attempts — with a monitor that alerts on any change of
error signature. It has alerted once (§1.2).

### 1.2 Reproduction matrix — every axis we could vary

| Variable | Values tried | Result |
| :-- | :-- | :-- |
| Environment | `prod`, `dev` | 503 on both |
| `--version` | omitted, `18` (current active), `19` (next) | 503 whenever the request reaches the service |
| `--access` | omitted, `customers` | 503 on both |
| CLI version | `0.127.0`, `0.127.2`, `0.128.0` | 503 on all three |
| `knowledge()` declared | yes, no | 503 both ways |
| `NOODLE_KNOWLEDGE_ENABLED` | unset, `true` | 503 both ways |

The signature changed **exactly once** in ~9 hours: it briefly became
`client_version_unsupported` (HTTP 409, requiring `@noodleseed/one@0.127.2`), then reverted to
503 after we upgraded. That is the only variation observed and suggests a service roll-forward
happened during the window without clearing the underlying condition.

Two rows carry most of the diagnostic weight:

- **`dev` fails identically**, ruling out anything specific to our prod configuration, access
  mode, secrets, or knowledge component.
- **The very first failure predates our `knowledge()` component entirely** — it occurred on a
  deploy of the plain 0.127-migrated server (6 widget-linked tools, no knowledge, doctor
  reporting `Assets: none packaged`). Knowledge is not implicated.

### 1.3 Everything else is healthy — which is why this looks scoped to the preflight path

**Control-plane reads all succeed** (same credentials, same service URL, same session):

```console
$ noodle whoami                    # → orgs: acme, demo, fahdrafi, mash, noodleseed, …
$ noodle status  --org noodleseed --app tivmark-assistant --env prod --json    # → ok (full record in §1.4)
$ noodle envs    list --org noodleseed --app tivmark-assistant --json          # → ok
$ noodle apps    list --org noodleseed --json                                  # → 18 apps
$ noodle service capabilities --json
{"ok":true,"data":{"capabilities":["controls","audit","observability","secrets","connectors","apps"],
 "service":"https://cloud.noodleseed.dev"}}
```

A control-plane **write** also succeeds — we set a variable mid-outage without trouble:

```console
$ noodle variables set NOODLE_KNOWLEDGE_ENABLED --value true --runtime cloud \
    --scope env --org noodleseed --app tivmark-assistant --env prod --json
{"ok":true,"data":{"runtime":"cloud","scope":{"level":"env","org":"noodleseed",…}}}
```

**`noodle doctor` passes 10 of 11**, and the single failure is the endpoint-health probe:

```text
pass  Node             v24.16.0
pass  CLI              0.128.0
pass  Login            fahd@noodleseed.com
pass  Service          https://cloud.noodleseed.dev
pass  Org membership   noodleseed
pass  Project link     noodleseed/tivmark-assistant/prod
pass  Entrypoint       …/apps/assistant/src/server.ts
pass  Validate         manifest compiles locally
pass  Assets           none packaged
pass  Secrets          1 required secret(s) configured
fail  Endpoint health  Endpoint returned HTTP 503.
summary: {'pass': 10, 'warn': 0, 'fail': 1}
```

**The deployment record reports healthy:**

```json
{
  "deployment": {
    "deploymentId": "tivmark-assistant-bda5b673d8ff1a1e",
    "endpointUrl": "https://noodleseed.cloud.noodleseed.dev/tivmark-assistant/v18/mcp",
    "serverVersion": "18", "active": true, "accessMode": "customers",
    "createdAt": "2026-07-31T08:08:46.443Z"
  },
  "health": { "state": "ready" },
  "config": { "ok": true, "missingSecrets": [] }
}
```

**And the data plane genuinely works.** Probed directly during the outage, the deployed endpoint
enforces the customer-auth boundary exactly as it should:

```text
GET   /tivmark-assistant/mcp        → 405     (method not allowed)
GET   /tivmark-assistant/v18/mcp    → 405
POST  /tivmark-assistant/mcp        → 401     (auth required — correct)
POST  /tivmark-assistant/v18/mcp    → 401
```

`https://cloud.noodleseed.dev/v1/assistant/embed.js` also serves 200 (686 KB,
`text/javascript`).

### 1.4 The contradiction worth chasing first

`noodle doctor` reports **Endpoint health → HTTP 503** for an endpoint that answers **401**
correctly when we probe it directly, in the same minute, from the same machine.

Those two cannot both be describing the same thing. Whatever upstream the doctor probe and the
deploy preflight are calling is not the MCP endpoint that is actually serving traffic. We would
start there: it is the shortest path to whichever internal dependency is down, and it explains
how a deployment that reports `ready` cannot be redeployed.

### 1.5 Where the failing request goes — three candidates, from your shipped CLI

Read out of `@noodleseed/one` `dist/` (we cannot see which one 503s from the outside):

1. **The main deploy preflight call.** The error surfaces through `preflightError()` in
   `dist/commands/deploy-first-flow.js`, which maps a thrown `ServiceRequestError` with a
   non-401/403 status onto `deploy_preflight_failed`. The generic `"request failed (503)"`
   message is the `ServiceRequestError` wording, so the 503 is a raw upstream status from the
   service, not synthesised locally. Given §1.2 (first failure with no knowledge and no packaged
   assets), **this is the most likely culprit**.
2. `POST /v1/orgs/{org}/apps/{app}/envs/{env}/assets/preflight` — the asset preflight. Doctor
   reports `Assets: none packaged` for us, so it may not run at all.
3. `POST /v1/orgs/{org}/apps/{app}/envs/{env}/knowledge/preflight` — only when a `knowledge()`
   component is declared (`@noodle-borg/deploy-client/dist/deploy-knowledge.js`,
   `` `${base}/preflight` ``). Ruled out for the *initial* failure; our current server does
   declare knowledge, so it will run on the next attempt.

### 1.6 Triage warning — CLI 0.128 masks this outage

**0.128 added a local pre-check that fires before any network call:**

```console
$ noodle deploy --org noodleseed --app tivmark-assistant --env prod --json
{"ok":false,"error":{"code":"ambiguous_server_version",
 "message":"This app already runs 17 server versions (1, 10, 11, …), so the target is ambiguous.",
 "fix":"Pass the server version you intend to deploy."}}
```

That is a **client-side** error. It looks like the 503 has cleared. **It has not** — we misread
it that way for a minute this morning before passing `--version` and getting the 503 back.

Anyone verifying a fix must pass `--version` explicitly, or they will get a client-side error,
never reach the service, and conclude it is healthy.

### 1.7 Impact

Direct: **nothing ships for `apps/assistant`.** The chain is longer than it looks:

1. We cannot deploy the assistant, so
2. the new `publicWebsite` surface never goes live, so
3. `noodle deploy` never provisions the non-secret embed id, so
4. the marketing embed on `tivmark.com` cannot be published — the snippet needs that id — so
5. `tivmark.com` keeps serving the **legacy share-code widget**
   (`app.noodleseed.com/widget/loader.js`, `data-share-code=Z2G688FI`), and the public demo keeps
   showing a superseded Noodle Seed product next to the current one.

Everything for steps 2–5 is merged, green, and waiting. The marketing PR is drafted with a
placeholder embed id and needs exactly one string replaced.

Secondary: the `sessionClaims` personalization we shipped in `apps/web` this morning is inert,
because the deployed v18 manifest declares no `sessionClaims` and the service correctly drops
undeclared claims. By design, not a complaint — but the signed-in demo cannot greet users by name
until a deploy succeeds either.

---

## 2 — Release the mixed-mode sign-in fixes to production

### 2.1 What we verified already shipped (npm)

Thank you for turning our report around the same day. We checked the published artifacts rather
than the announcement. In **`@noodleseed/assistant@1.20.0`**:

- **§3.1 of our report** — `CreateAssistantSessionInput` is the discriminated union:
  `signInTicket` on the elevation arm, `signInTicket?: undefined` on the fresh-mint arm, `user`
  required on both, and `context` excluded from the elevation arm.
- **§3.2** — `AssistantSessionExchangeError` with
  `detail: { code: 'session_exchange_failed', status, retryable, serviceCode? }` and an
  `elevationRefusal` getter narrowed to `ASSISTANT_ELEVATION_REFUSAL_CODES`
  (`elevation_ticket_invalid | elevation_ticket_expired | elevation_tenant_mismatch |
  elevation_session_unavailable | elevation_already_signed_in`).
- **§3.8** — the rename landed everywhere a host sees it. We also confirmed the client still
  dual-reads: our marketing listener reads `event.detail.signInTicket` and falls back to
  `event.detail.continuation` for widgets deployed before the rename.

One discrepancy worth aligning in your release notes: **the shipped 1.20.0 types allow `routing`
on both arms**, with an in-source comment that elevation is the first authenticated moment and
therefore the only chance a routed connector's session gets its backend-verified routes. Your
email said `routing` was *excluded* from the elevation arm pending a follow-up. The shipped
behaviour is the better one — flagging only so the documentation matches the package (also
§3, confirmation 5).

### 2.2 What we have already built against it (merged, dormant)

**Host backend** — `apps/web/lib/assistant/elevation.ts` + `pages/api/assistant/session.ts`:

- Reads the single-use ticket from a short-lived, parent-domain cookie
  (`tiv_assistant_signin`; `Domain=.tivmark.com; Secure; SameSite=Lax; Max-Age=600`) and clears
  it in the same response, unconditionally — a presented ticket is spent whether or not the
  exchange succeeded.
- Presents `origin: https://app.tivmark.com` — **the origin the conversation will continue on**,
  not `tivmark.com` where it began. This is a direct consequence of your origin-pinning finding
  (§2.4, fix 1).
- Handles refusals **by kind**:

  | Refusal | Our handling |
  | :-- | :-- |
  | `elevation_ticket_expired` | Mint a fresh session. The visitor took too long; they lose the thread, never the assistant. |
  | `elevation_ticket_invalid` | Fresh session. |
  | `elevation_already_signed_in` | Fresh session. |
  | `elevation_session_unavailable` | Fresh session. |
  | `elevation_tenant_mismatch` | **Logged and never retried.** A client reaching for another tenant's conversation is a boundary event. |
  | `elevation_unavailable` (503, outside the union) | Falls through to the error path — your note that this one pages an operator rather than degrading a visitor is exactly how we treat it. |

**Marketing page** — `apps/marketing/index.html` listens for `assistant-sign-in-requested`,
writes the ticket cookie, and redirects to `https://app.tivmark.com/mark`. Never a URL
parameter — that would put the ticket in access logs, in the `Referer` of every subresource, and
in browser history. It no-ops off the tivmark.com domain so local browsing cannot strand a
visitor on a redirect that cannot work.

### 2.3 Why `signIn: true` is still off on our side

Enabling it against today's production would produce **a sign-in that appears to succeed and then
breaks** — precisely the trap your own origin-pinning finding describes. We would rather ship an
honestly anonymous public surface than a sign-in card that leads somewhere broken. The flag flips
the day the three fixes below are in production.

### 2.4 The three gating fixes, each with acceptance criteria

**Fix 1 — Origin re-pin at elevation. The single blocker.**

*Problem:* sessions are origin-pinned at mint and every session-authenticated route emits CORS
only for the pinned origin. Our elevated token would be minted against `tivmark.com` and used
from `app.tivmark.com` — every turn browser-blocked, *after* a sign-in that appeared to succeed.

*Acceptance criteria we will verify against:*

1. Given an anonymous session minted for the public surface (`https://tivmark.com`), when our
   backend spends a `signInTicket` presenting `origin: "https://app.tivmark.com"` (a member of
   the compiled `allowedOrigins` union), the elevated session is **re-pinned to that origin**.
2. A subsequent `POST` to the turns endpoint from `https://app.tivmark.com` succeeds, with
   `access-control-allow-origin: https://app.tivmark.com` on the response.
3. Presenting an origin **not** in the union refuses the exchange **without consuming the
   ticket** (your design notes say validation happens before the spend — please keep that
   property; a visitor should survive a host misconfiguration with their ticket intact).

**Fix 2 — Classification: gated tools advertise-and-intercept, and the connector-auth-kind
join.**

*Problem, as you confirmed and extended:* `anonymousBehavior` classifies on `${user}` references
and `authorization` only; the `authorization` branch is dead on the model path; and a
`delegatedTokenExchange`-backed tool with no `${user}` reference is classified public-safe, so it
executes anonymously and dies in the credential broker with `credential_unavailable` instead of
raising the sign-in card.

*Our concrete test case:* `my_teams` — our team-context tool, delegated-connector-backed, no
`${user}` reference. Today we **exclude it from the mixed surface entirely** because it would
execute anonymously and fail. After this fix we can project it, and the `${user}`-reference
workaround we added to other tools (e.g. `book_time_off`'s `requestedBy` output field) becomes
redundant rather than wrong — per your note, we will keep it until then.

*Acceptance criteria:*

1. A tool backed by a `delegatedTokenExchange` connector, with no `${user}` reference, projected
   to a `mixed` surface, is **visible** to an anonymous session and **raises `auth_requested`**
   (the sign-in card) when called — never `credential_unavailable`.
2. Deploy preflight **rejects** a delegated-auth tool projected to a *pure public* surface,
   where no sign-in can ever exist.
3. The classification joins on deploy-time connector binding data, so no authoring change is
   required on our side.

**Fix 3 — Issuer rebind to the elevating client.**

*Problem, as you found:* elevation kept the public session's client id, so a post-elevation
delegated token exchange asserted `customer_identity.issuer = …assistant-client:<embedId>` while
fresh mints assert the backend client's issuer — and our token endpoint at
`https://app.tivmark.com/api/assistant/oauth/token` pins on issuer. Doctor would have reported
green while this was broken.

*Acceptance criteria:*

1. After elevation via our backend client (`embed_0b8a5f33-…`), a delegated exchange asserts the
   **same issuer** a fresh authenticated mint asserts.
2. Concretely: a visitor signs in mid-conversation and then asks for `time_off_balance`; the
   delegated exchange against our issuer-pinning token endpoint succeeds.

### 2.5 The end-to-end sequence we will run the day this releases

So you can see exactly what "done" exercises on the service:

1. Set `signIn: true` on the public surface and add the identity-gated capabilities
   (`time_off_balance`, `my_time_off`, `book_time_off`, `my_teams`) to its allowlist; redeploy.
2. Anonymous visitor on `tivmark.com` asks "how much vacation do I have?" → sign-in card
   (fix 2), carrying a `signInTicket`.
3. Visitor clicks sign in → parent-domain cookie → redirect to `app.tivmark.com/mark` → NextAuth
   login → our session route spends the ticket presenting `origin: app.tivmark.com` (fix 1).
4. The elevated session answers the original question: `time_off_balance` runs through delegated
   token exchange as the signed-in user (fix 3), grounded in their real team.
5. Copy on `/mark` says "Mark remembers your conversation" — per your §3.4 answer, we promise
   memory, never a reappearing transcript.

---

## 3 — Confirmations we need (most are one sentence)

1. **Elevation store on production.** Your reply notes a deployment with no elevation store
   answers `503 elevation_unavailable`. Please confirm the production service backing
   `cloud.noodleseed.dev` has the durable elevation store enabled for tenant
   `noodleseed/tivmark-assistant/prod`, so the first ticket we spend is not a 503.
2. **Knowledge end-to-end for our org — first-ever use.** Our v19 deploy will be this org's
   first `knowledge()` publication: component `tivmark_help`, six UTF-8 Markdown documents
   (2–3 KB each), one `site()` scope (`https://tivmark.com`, `include: ['/']`, `refresh: '24h'`),
   managed crawler and managed index (no BYO config). We have set `NOODLE_KNOWLEDGE_ENABLED=true`
   at cloud env scope. Please confirm (a) that variable is the entire feature gate, (b) managed
   crawler + index provision automatically on first deploy with no org-level entitlement we are
   missing, and (c) `noodle knowledge list/status/refresh` will operate for us afterwards.
   Ideally: **watch our v19 deploy land** and confirm publication and first crawl succeed.
3. **Embed provisioning and default budgets.** Confirm that deploying a server whose assistant
   declares a public/mixed surface provisions the embed id in the same deploy (and prints it),
   and tell us the **default** daily turn/session caps a new surface gets. We will set explicit
   caps via `noodle assistant budget set` before publishing the id either way — we just need to
   know whether the defaults could throttle a demo in between.
4. **Release coordinates and date.** Which `@noodleseed/one` / `@noodleseed/assistant` versions
   carry the service-coupled fixes in §2.4, and when do they reach production? We will pin to
   those versions rather than polling npm.
5. **`routing` on both arms** (§2.1). The shipped 1.20.0 types allow it at elevation; your email
   said excluded. Confirm the shipped behaviour is the intended one.
6. **"Remembers but does not replay," in writing.** Your §3.4 answer changed our UI copy and will
   surprise other integrators: no transcript is streamed to the browser, the `replayed: true`
   flags belong to idempotent re-POSTs of interaction decisions, and after a redirect the visitor
   sees an empty panel attached to an assistant that remembers. If the skill reference's "same
   history" sentence is corrected as you described, that closes this.

**Offer, if it accelerates anything:** if you can point our org at the dev environment where the
ten changes are already merged — or stand up a preview tenant — we will run the full §2.5
sequence against it this week and hand you a verification report before your production release,
so the release ships pre-validated by a real integration.

---

## 4 — Welcome, not blocking (defer freely)

- **`embed --check` corrections:** `script-src` joins the checked directives for public/mixed
  surfaces; the literal substring match becomes a real CSP parse (our correct
  `https://*.noodleseed.dev` wildcard currently *fails* while a missing CSP *passes*); env-name
  aliasing for hosts whose variables are not named `NOODLE_SERVICE_URL`/`PUBLIC_APP_ORIGIN`;
  public-only surfaces stop requiring a client id/secret they do not have. We currently alias env
  names at the call site.
- **Doctor probes:** the synthetic elevation probe (sequenced after fix 3, as you said — probing
  before it would certify the lie) and an anonymous-principal leg for public/mixed surfaces.
- **Documentation pass:** the npm README's backend-elevation section with the refusal-code table;
  the public-embed story (`embedId`, `publicWebsite`, `embed.js`, sign-in); and the explicit
  paragraph that the redirect handoff is **mandatory, not stylistic**, because the widget calls
  its session endpoint with `credentials: 'same-origin'`.
- **Papercut — ambient context pays a doomed exchange per anonymous turn.** Our
  `context.ambient` fulfils through the delegated connector; for an anonymous principal the
  broker fails and the runtime correctly degrades to `ambientStatus: 'unavailable'`. Correct
  behaviour, but every anonymous turn pays one guaranteed-failed token-exchange round trip first.
  Consider skipping delegated ambient fulfilment when the principal is anonymous.
- **Papercut — deploy `--version` ergonomics.** 0.128 requires an explicit `--version` once an
  app has multiple server versions, and the deployment sequence number must be tracked out of
  band (`noodle status`, since local `.noodle/deployment.json` drifts). A `--version next`
  convenience — or including the next expected version in the `ambiguous_server_version`
  error — would remove a manual lookup from every deploy.
- **Papercut — the CLI-version treadmill during incidents.** Mid-outage, the required CLI moved
  0.127.0 → 0.127.2 → (0.128.0 published). Each bump costs an `npm install` and briefly changes
  the failure signature, which complicates incident triage on both sides. A window of N
  supported minor versions would help.

---

## 5 — Definition of done: every demo scenario, its gate, and our follow-up

When every row is green, the demo is complete end to end and we anticipate **no further asks**.

| # | Demo scenario | Gated on (Noodle) | Our action when it clears | Verified by |
| :-- | :-- | :-- | :-- | :-- |
| A | Anonymous visitor on `tivmark.com` asks product questions, gets **cited** answers from `search_tivmark_help` | §1 outage; §3.2 knowledge confirmation | Deploy v19; take embed id; swap one string in drafted marketing PR; merge (auto-deploys) | Live browser session on tivmark.com; `noodle knowledge status tivmark_help` |
| B | Anonymous visitor gets the `talk_to_sales` widget with working handoff links | §1 outage only | Same deploy + embed PR as A | Live browser; links open via host with no safe-link interstitial |
| C | Public surface is budget-capped with a working kill switch | §1 outage; §3.3 defaults answer | `noodle assistant budget set --turns-per-day N` before publishing the id | `noodle assistant embeds list` shows caps and spend |
| D | Signed-in user on `app.tivmark.com` is greeted by name; Mark knows their teams by slug and their reviewer role | §1 outage only (v19 declares `sessionClaims`; `apps/web` already sends them) | Nothing — activates on deploy | Live signed-in session; greeting uses the real name; queue offered only to OWNER/ADMIN |
| E | Time-off and equipment flows with one-click review queues and confirmations | Nothing — live on v18 today | Redeploy keeps them; v19 adds the equipment-queue widget parity | Existing checks + live session |
| F | External MCP hosts (ChatGPT, Claude) connect via customer OAuth | Nothing — live today | None | Existing `noodle assistant doctor` / host connection |
| G | **Mid-conversation sign-in**: anonymous → sign-in card → login on `app.tivmark.com` → same conversation, elevated, delegated calls succeed | §2.4 fixes 1–3 in production; §3.1 elevation store; §3.4 release coordinates | Set `signIn: true` + add identity-gated capabilities to the mixed allowlist; bump pinned SDKs; redeploy; run §2.5 | The §2.5 sequence in a live browser, both origins |
| H | Knowledge stays fresh (daily crawl, on-demand refresh) | §3.2 confirmation | Operate via `noodle knowledge refresh` | `noodle knowledge status` shows crawl timestamps |

---

## 6 — Context: the integration as it stands (nothing here is a request)

**One assistant, two front doors**, from a single `embeddedAssistant` — 18 tools (16
model-visible + 2 app-only review helpers), 8 widget-linked tools, one knowledge component:

```ts
access: [
  publicWebsite({
    origins: ['https://tivmark.com', 'https://www.tivmark.com'],
    capabilities: [tivmarkHelp, publicTools.talkToSales],   // the ENTIRE public surface
  }),
  authenticatedWebsite({
    origins: ['http://localhost:4002', 'https://app.tivmark.com'],
    sessionClaims: {
      displayName: { exposeToModel: true },
      teamSlugs: { exposeToModel: true },
      reviewerTeamSlugs: { exposeToModel: true },
    },
  }),
],
privacyUrl: 'https://tivmark.com/privacy',
```

The public allowlist is two entries because every other tool reaches our API through
`delegatedTokenExchange` — which, per §2.4 fix 2, would compile cleanly onto a public surface
today and then fail at runtime. We carry a repo test asserting **no public-surface capability
reaches a connector at all**; when your fix 2 lands it becomes belt-and-braces rather than the
only guard.

Already live and verified in production on our side: `tivmark.com` serves a single CSP response
header (nginx) that already allowlists `https://cloud.noodleseed.dev` in `script-src`,
`connect-src`, and `frame-src`; real 404s (previously every path answered 200, which would also
have poisoned your crawler); build files no longer publicly served; a `/privacy` page that is the
`privacyUrl` above; and marketing CI that asserts the *served* CSP header. `app.tivmark.com`
redeployed this morning with the claims wiring and the dormant elevation seam.

---

## Appendix A — Version and target inventory

| Component | Value |
| :-- | :-- |
| `@noodleseed/one` (npm latest / our devDep) | 0.128.0 / ^0.128.0 |
| `@noodleseed/assistant` (npm latest / our dep) | 1.20.0 / ^1.20.0 |
| `@noodleseed/agent-kit` (npm latest / installed kit) | 0.76.0 / 0.76.0 |
| Node (local and CI) | v24.16.0 |
| Service | `https://cloud.noodleseed.dev` |
| Target | org `noodleseed` / app `tivmark-assistant` / env `prod` / access `customers` |
| Active deployment | v18, `tivmark-assistant-bda5b673d8ff1a1e`, created 2026-07-31 |
| Waiting to deploy | v19: public surface, knowledge, sessionClaims, equipment-queue widget |
| Backend session client | `embed_0b8a5f33-1bf3-4d65-99bb-2853142e664e` (the `web` client) |
| Delegated exchange client | `tivmark-assistant-deleg` → `https://app.tivmark.com/api/assistant/oauth/token` |
| Customer auth | `customerAuth.oidc`, issuer `https://app.tivmark.com/oauth`, audience `tivmark-api-prod` |

## Appendix B — Reproduce and verify

```bash
# The failure. --version is REQUIRED on 0.128 or you get a client-side error instead (§1.6).
noodle deploy --org noodleseed --app tivmark-assistant --env prod \
  --access customers --version 19 --json

# The §1.4 contradiction: this reports Endpoint health 503 …
noodle doctor --service https://cloud.noodleseed.dev --json

# … while this answers 401, correctly, at the same moment.
curl -s -o /dev/null -w '%{http_code}\n' -X POST \
  -H 'content-type: application/json' -d '{}' \
  https://noodleseed.cloud.noodleseed.dev/tivmark-assistant/mcp

# Healthy control plane and deployment record, for contrast.
noodle status  --org noodleseed --app tivmark-assistant --env prod --json
noodle service capabilities --json

# Post-fix, the checks we will run immediately (in ladder order):
noodle assistant embeds list --json
noodle knowledge status tivmark_help --org noodleseed --app tivmark-assistant --env prod --json
noodle assistant doctor --origin https://app.tivmark.com \
  --org noodleseed --app tivmark-assistant --env prod --json
noodle metrics --agent-output
```
