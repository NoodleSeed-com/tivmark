# Production release request: restore deploys, then ship the sign-in release

**From:** Tivmark (Noodle Seed sample customer site)
**To:** Noodle Seed engineering
**Date:** 2026-08-19
**Refs:** fb-1163, fb-1164 (both P0, area `deploys`)
**Prior correspondence:** `docs/noodle-assistant-elevation-gap.md` and your reply of 2026-08-19

---

## Summary

Two asks, in priority order.

1. **Restore the deploy preflight.** It has returned HTTP 503 continuously for ~9 hours. Nothing
   ships for `apps/assistant` until it works, and it is the last step between us and a complete
   multi-surface demo.
2. **Release the mixed-mode sign-in work to production.** You merged it on dev this morning. We
   have built the entire host half against `@noodleseed/assistant@1.20.0` and are holding
   `signIn: true` off until three specific fixes land in production. Those three are named in
   §2.4 so you can scope or cherry-pick rather than waiting on a full release.

Everything else on our side is merged, green, and deployed. Section 4 is the current state of the
integration if it is useful context; sections 1 and 2 are the actual requests.

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
2–3 minutes throughout, roughly 200 attempts.

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
`client_version_unsupported` (HTTP 409, asking for `@noodleseed/one@0.127.2`), then reverted to
503 after we upgraded. That is the only variation observed, and it suggests a service roll-forward
happened during the window without clearing the underlying condition.

The **`dev` environment failing identically** is what rules out anything specific to our prod
configuration, our knowledge component, or our access mode.

### 1.3 Everything else is healthy — which is why this looks scoped to the preflight path

**Control-plane reads all succeed** (same credentials, same service URL, same session):

```console
$ noodle whoami                    # → orgs: acme, demo, fahdrafi, mash, noodleseed, …
$ noodle status  --org noodleseed --app tivmark-assistant --env prod --json    # → ok
$ noodle envs    list --org noodleseed --app tivmark-assistant --json          # → ok
$ noodle apps    list --org noodleseed --json                                  # → 18 apps
$ noodle service capabilities --json
{"ok":true,"data":{"capabilities":["controls","audit","observability","secrets","connectors","apps"],
 "service":"https://cloud.noodleseed.dev"}}
```

A control-plane **write** also succeeds — we set a variable during this window without trouble:

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

**And the data plane genuinely works.** Probed directly, the deployed endpoint enforces the
customer-auth boundary exactly as it should:

```text
GET   /tivmark-assistant/mcp        → 405     (method not allowed)
GET   /tivmark-assistant/v18/mcp    → 405
POST  /tivmark-assistant/mcp        → 401     (auth required — correct)
POST  /tivmark-assistant/v18/mcp    → 401
```

`https://cloud.noodleseed.dev/v1/assistant/embed.js` also serves 200.

### 1.4 The contradiction worth chasing first

`noodle doctor` reports **Endpoint health → HTTP 503** for an endpoint that answers **401**
correctly when we probe it directly, in the same minute, from the same machine.

Those two cannot both be describing the same thing. Whatever upstream the doctor probe and the
deploy preflight are calling is not the MCP endpoint that is actually serving. We would start
there: it is the shortest path to whichever dependency is down, and it explains why a deployment
that reports `ready` cannot be redeployed.

### 1.5 Where the preflight goes

Read out of the shipped CLI (`@noodleseed/one` `dist/`), the deploy path POSTs under
`/v1/orgs/{org}/apps/{app}/envs/{env}/`:

- `assets/preflight` — always, for widget assets. We have 7 widgets, so this always runs. **This
  is the one that ran on the very first failure, before we had any knowledge component**, which is
  why we do not think knowledge is implicated.
- `knowledge/preflight` — only when a `knowledge()` component is declared
  (`@noodle-borg/deploy-client/dist/deploy-knowledge.js`, `${base}/preflight`).
- `deploy` — the actual deploy, which we never reach.

The 503 surfaces through `preflightError()` in `dist/commands/deploy-first-flow.js`, which maps a
non-401/403 `ServiceRequestError` onto `deploy_preflight_failed`. The `detail.status` is the raw
upstream status, so the 503 is coming back from the service rather than being synthesised locally.

### 1.6 Triage warning — 0.128 masks this

**CLI 0.128 added a local pre-check that fires before any network call:**

```console
$ noodle deploy --org noodleseed --app tivmark-assistant --env prod --json
{"ok":false,"error":{"code":"ambiguous_server_version",
 "message":"This app already runs 17 server versions (1, 10, 11, …), so the target is ambiguous.",
 "fix":"Pass the server version you intend to deploy."}}
```

That is a **client-side** error. It looks like the 503 has cleared. **It has not** — we misread it
that way for a minute this morning before passing `--version` and getting the 503 back.

Anyone verifying a fix must pass `--version` explicitly, or they will get a client-side error,
never reach the service, and conclude it is healthy.

### 1.7 Impact

Direct: **nothing ships for `apps/assistant`.**

The chain matters because it is longer than it looks:

1. We cannot deploy the assistant.
2. So the new `publicWebsite` surface never goes live.
3. So `noodle deploy` never provisions the non-secret embed id.
4. So the marketing embed on `tivmark.com` cannot be published — the snippet needs that id.
5. So `tivmark.com` continues serving the **legacy share-code widget**
   (`app.noodleseed.com/widget/loader.js`, `data-share-code=Z2G688FI`), and the public demo keeps
   showing a superseded product beside the current one.

Everything for steps 2–5 is merged, green, and waiting. The marketing PR is drafted with a
placeholder and needs exactly one string replaced.

Secondary: the `sessionClaims` personalization we shipped in `apps/web` this morning is inert,
because the deployed v18 manifest declares no `sessionClaims` and the service correctly drops
undeclared claims. That is by design and not a complaint — but it means our signed-in demo cannot
greet users by name until a deploy succeeds either.

---

## 2 — Please release the mixed-mode sign-in work to production

### 2.1 What we verified shipped

Thank you for turning our report around the same day. We checked the published artifacts rather
than taking the announcement's word for it. In **`@noodleseed/assistant@1.20.0`** on npm:

- **§3.1** — `CreateAssistantSessionInput` is the discriminated union, with `signInTicket` on the
  elevation arm and `signInTicket?: undefined` on the fresh-mint arm. `user` required on both.
- **§3.2** — `AssistantSessionExchangeError` with `detail: { code, status, retryable, serviceCode? }`
  and an `elevationRefusal` getter narrowed to `ASSISTANT_ELEVATION_REFUSAL_CODES`.
- **§3.8** — the rename landed: `elevation_ticket_invalid` / `elevation_ticket_expired`, and
  "continuation" now refers only to the server-held interaction state.

One detail is **ahead of your email**: the shipped types allow `routing` on **both** arms, with
the comment that elevation is the first authenticated moment and therefore the only chance a
routed connector's session gets its backend-verified routes. Your email said it was excluded from
the elevation arm. The shipped behaviour is the better one; flagging only so your release notes
match the package.

### 2.2 What we built against it

Both halves are merged and dormant:

**Host backend** — `apps/web/lib/assistant/elevation.ts` plus `pages/api/assistant/session.ts`:

- Reads a single-use ticket from a short-lived, parent-domain cookie and clears it in the same
  response, unconditionally — a presented ticket is spent whether or not the exchange succeeded.
- Passes `origin` as **`app.tivmark.com`**, the origin the conversation will *continue* on, not
  `tivmark.com` where it began. This is entirely because of your origin-pinning finding (§2.4.1).
- Handles refusals **by kind**, which is the whole point of the typed errors:

  | Refusal | Handling |
  | :-- | :-- |
  | `elevation_ticket_expired` | Mint a fresh session. The visitor took too long; they lose the thread, never the assistant. |
  | `elevation_ticket_invalid` | Fresh session. |
  | `elevation_already_signed_in` | Fresh session. |
  | `elevation_session_unavailable` | Fresh session. |
  | `elevation_tenant_mismatch` | **Logged and never retried.** A client reaching for another tenant's conversation is a boundary event. |
  | `elevation_unavailable` (503) | Falls through to the error path deliberately — your note that it sits outside the refusal union to page an operator rather than degrade a visitor is exactly right, and we treat it that way. |

**Marketing page** — `apps/marketing/index.html` listens for `assistant-sign-in-requested`, writes
the ticket to a `Domain=.tivmark.com; Secure; SameSite=Lax; Max-Age=600` cookie, and redirects to
`https://app.tivmark.com/mark`. Never a URL parameter: that would put the ticket in access logs,
in the `Referer` of every subresource, and in browser history. It reads `signInTicket` and falls
back to `continuation` for widgets deployed before the rename, and no-ops off the tivmark.com
domain so local browsing cannot strand someone on a redirect that cannot work.

### 2.3 Why `signIn: true` is still off

Enabling it against today's production would produce **a sign-in that appears to succeed and then
breaks** — precisely the trap your own finding described. We would rather ship an honestly
anonymous public surface than a sign-in card that leads somewhere broken.

### 2.4 The three fixes that gate us, in priority order

**1. Origin re-pin at elevation — the single blocker.**
Sessions are origin-pinned at mint and every session-authenticated route emits CORS only for the
pinned origin. Our elevated token would be minted against `tivmark.com` and then used from
`app.tivmark.com`, so every turn would be blocked by the browser *after* a successful sign-in.
Your fix re-pins the session to the origin the backend presents at elevation. Our code already
presents `app.tivmark.com`, so this is the only thing standing between us and turning it on.

**2. Connector-auth-kind classification (your §5, fix 2).**
Today `anonymousBehavior` classifies on `${user}` references and `authorization`, not on the
connector's auth kind — and you found the `authorization` branch is dead on the model path
anyway. Every Tivmark tool reaches our API through `delegatedTokenExchange`, so without this fix
a tool with no `${user}` reference is classified public-safe, executes anonymously, and dies in
the broker with `credential_unavailable` instead of raising the card. We are keeping the
`${user}`-reference workaround; per your note it becomes redundant rather than wrong.

**3. Issuer rebind to the elevating client.**
Without it, a post-elevation delegated exchange asserts
`customer_identity.issuer = …assistant-client:<embedId>` against our token endpoint at
`https://app.tivmark.com/api/assistant/oauth/token`, which pins on issuer. Your point that doctor
would have reported green while this was broken is well taken — that is exactly the class of bug
we would not have caught.

### 2.5 Welcome, not blocking

- `embed --check`: `script-src` for public/mixed surfaces, the real CSP parse replacing the
  literal substring match, env-name aliasing, and public-only surfaces no longer requiring a
  client id/secret. We currently work around the env names by aliasing at the call site.
- The doctor elevation probe, sequenced after fix 3 above.
- The README and `embedded-assistant.md` documentation pass, especially the paragraph stating the
  redirect handoff is mandatory rather than stylistic.

### 2.6 One thing we would like confirmed in writing

Your §3.4 answer — **the elevated session remembers but does not replay** — changed our UI copy,
and we suspect it will surprise others. No transcript is streamed to the browser, the
`replayed: true` flags belong to idempotent re-POSTs of interaction decisions, and after a
redirect the visitor sees an empty panel attached to an assistant that remembers.

We have written our copy as "the assistant remembers your conversation" and never "your
conversation will reappear". If the skill reference's "same history" sentence is corrected as you
described, that is enough for us.

---

## 3 — What we need from you

1. **Restore the deploy preflight.** Start with the doctor/direct-probe contradiction in §1.4.
2. **Give us a date** for the release carrying §2.4 items 1–3, so we can schedule turning
   `signIn: true` on rather than polling npm. If a full release is slow, item 1 alone unblocks us.

Once deploys work we can finish in minutes: deploy, take the embed id, publish the marketing
embed, verify live. That work has been ready since last night.

---

## 4 — Context: what Tivmark looks like now

Not a request; included so you know what the demo will exercise once it deploys.

**One assistant, two surfaces**, from a single `embeddedAssistant`:

```ts
access: [
  publicWebsite({
    origins: ['https://tivmark.com', 'https://www.tivmark.com'],
    capabilities: [tivmarkHelp, publicTools.talkToSales],
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

The public surface exposes exactly two capabilities: a `knowledge()` component over six authored
product documents plus a daily crawl of `tivmark.com`, and one anonymous-safe tool that touches no
connector. That second point is load-bearing given §2.4.2 — it is the only reason the public
surface is safe today.

We also added a repo test asserting that **no public-surface capability reaches a connector at
all**, because the compiler cannot catch it. If your fix 2 lands, that test becomes belt-and-braces
rather than the only guard.

Already live and verified in production: the marketing site now serves a real CSP response header
(one copy, in nginx), returns genuine 404s, no longer publishes its own `Dockerfile`/`nginx.conf`,
and has a `/privacy` page — which is the `privacyUrl` the public surface declares.

---

## Appendix A — Version inventory

| Component | Version |
| :-- | :-- |
| `@noodleseed/one` (npm latest) | 0.128.0 |
| `@noodleseed/one` (our devDep) | ^0.128.0 |
| `@noodleseed/assistant` (npm latest) | 1.20.0 |
| `@noodleseed/assistant` (our dep) | ^1.20.0 |
| `@noodleseed/agent-kit` (npm latest) | 0.76.0 |
| Node | v24.16.0 (local and CI) |
| Service | `https://cloud.noodleseed.dev` |
| Target | `noodleseed` / `tivmark-assistant` / `prod`, access `customers` |
| Active deployment | v18, `tivmark-assistant-bda5b673d8ff1a1e`, created 2026-07-31 |

## Appendix B — Commands to reproduce and to verify a fix

```bash
# The failure. --version is REQUIRED on 0.128 or you get a client-side error instead.
noodle deploy --org noodleseed --app tivmark-assistant --env prod \
  --access customers --version 19 --json

# The contradiction in §1.4: this reports Endpoint health 503 …
noodle doctor --service https://cloud.noodleseed.dev --json

# … while this answers 401, correctly, at the same moment.
curl -s -o /dev/null -w '%{http_code}\n' -X POST \
  -H 'content-type: application/json' -d '{}' \
  https://noodleseed.cloud.noodleseed.dev/tivmark-assistant/mcp

# Healthy control plane and deployment record, for contrast.
noodle status  --org noodleseed --app tivmark-assistant --env prod --json
noodle service capabilities --json
```
