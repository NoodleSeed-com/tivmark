# Mixed-mode sign-in: the service is complete, the npm helper cannot reach it

**From:** Tivmark (Noodle Seed sample customer site)
**Against:** `@noodleseed/one@0.127.0`, `@noodleseed/assistant@1.19.0`, `@noodleseed/agent-kit@0.75.0`
**Date:** 2026-08-19

---

> ## RESOLVED — 2026-08-19
>
> Noodle Seed accepted every item and shipped the blocker the same day. The report below is
> kept as written; this box records what changed and what it means for our integration.
>
> **Shipped in `@noodleseed/assistant@1.20.0`** (verified on npm, not just announced):
>
> - **§3.1** — `createAssistantSession` takes the elevation as a discriminated union, exactly
>   the shape asked for. **The field is `signInTicket`, not `continuation`.**
> - **§3.2** — `AssistantSessionExchangeError` with an `elevationRefusal` getter narrowed to
>   `ASSISTANT_ELEVATION_REFUSAL_CODES`. Two refusals were renamed with the field:
>   `elevation_ticket_invalid` / `elevation_ticket_expired`.
> - **§3.8** — accepted in full. "Continuation" now refers only to the server-held interaction
>   state that never reaches browser code. They noted this was the last cheap moment to
>   rename it.
>
> They also found four defects on top of our eight. **Three change how we must build:**
>
> 1. **Sessions are origin-pinned at mint, and CORS is emitted only for the pinned origin.**
>    Our elevated token — minted against `tivmark.com` — would have been unusable from
>    `app.tivmark.com`: every turn blocked by the browser, *after a sign-in that appeared to
>    succeed*. Their fix re-pins the session origin to whatever the backend presents at
>    elevation. So the exchange must present **the origin the conversation will continue on**,
>    not the one it began on.
> 2. **The elevated session remembers, but does not replay.** No transcript is ever streamed
>    to the browser; the `replayed: true` flags we found belong to idempotent re-POSTs of
>    interaction decisions, not history. After the redirect the visitor sees an *empty panel
>    attached to an assistant that remembers*. Copy must say "the assistant remembers your
>    conversation" and never "your conversation will reappear".
> 3. **Our `${user}`-reference trick is currently the only thing that raises the sign-in
>    card.** The `authorization` branch of `anonymousBehavior` is dead on the model path.
>    Their fix classifies on the connector's auth kind too; until it ships, the trick stays
>    correct and later becomes redundant rather than wrong.
>
> Their fourth finding: elevation kept the public session's client id, so a post-elevation
> delegated token exchange would assert the wrong issuer **while doctor reported green**.
> Fixed by rebinding the session to the elevating client.
>
> ### What we built against it
>
> - `apps/web/lib/assistant/elevation.ts` + the session route spend a `signInTicket`, with
>   refusals handled by kind (four recover into a fresh conversation; `tenant_mismatch` is
>   escalated and never retried).
> - `apps/marketing/index.html` carries the ticket to `app.tivmark.com` on a short-lived
>   parent-domain cookie and redirects, because the widget's `credentials: 'same-origin'`
>   makes a cross-origin session endpoint a guaranteed 401.
>
> ### Still off, deliberately
>
> `signIn: true` is **not** enabled. The service-side origin re-pin, issuer rebind, and
> classification fixes are merged on Noodle Seed's dev environment and ship "in the next
> approved release". Enabling it against today's production would produce a sign-in that
> appears to succeed and then breaks — the exact trap in finding 1. Flipping it is one flag
> plus the identity-gated capabilities once that release lands.

## Summary

We are adopting the multi-surface embedded assistant on Tivmark — one assistant projected
onto the marketing site (`tivmark.com`, anonymous) and the product (`app.tivmark.com`,
signed in), with `publicWebsite({ signIn: true })` so a visitor can sign in mid-conversation.

The feature is **built and shipping on the service side**. It is **not reachable from the
published npm package**, because `createAssistantSession` has no way to spend the
continuation. Everything below is read out of the shipped artifacts, not inferred.

---

## 1. What already ships

### Service side — complete

`@noodle-borg/assistant-gateway`, bundled inside `@noodleseed/one@0.127.0`:

- **`dist/elevation-store.d.ts`** — `AssistantElevationStore` with `request()` / `claim()`.
  The continuation is stored **hashed** (`elevationDigest`), is **single-use**, is claimed
  **atomically** ("two backends racing the same value must not both win"), and is
  **tenant-checked**. `ASSISTANT_ELEVATION_TTL_MS = 10 * 60 * 1000`. At most one elevation
  is live per session — a second `request()` supersedes rather than accumulates.
- **`dist/elevation.d.ts` / `.js`** — `completeElevation({ continuation, tenant, caller })`.
  The ordering is deliberate and documented in-source: the continuation is claimed *before*
  the session is touched, so a refused elevation cannot leave a spent continuation behind.
- **`dist/postgres-elevation-store.js`** — the durable implementation is wired.

Refusal codes, already distinct and already audited
(`assistant.session.elevation_refused`):

| Code | Status |
| :-- | :-- |
| `elevation_continuation_invalid` | 403 |
| `elevation_continuation_expired` | 403 |
| `elevation_tenant_mismatch` | 403 |
| `elevation_session_unavailable` | 409 |
| `elevation_already_signed_in` | 409 |

### The HTTP route — complete, and it is the *same* endpoint

`@noodle-borg/service/dist/routes/assistant.js:304`:

```js
// Mid-conversation sign-in (5.6b).
if (parsed.continuation !== undefined) {
  return elevateAssistantSession(res, deps, { continuation: parsed.continuation, client, caller, … });
}
```

So the wire protocol is simply: **POST the existing session-exchange endpoint, with the
existing client credentials and the existing `user` object, plus a top-level
`continuation`.** The response is parsed through the same `assistantSessionResponseSchema`
— deliberately, per the in-source comment: *"the widget cannot tell the two apart, so they
must not differ."*

### Browser side — complete

`@noodleseed/assistant@1.19.0` parses an `auth_requested` SSE event and dispatches
`assistant-sign-in-requested` (bubbling and composed) plus `assistant-sign-in-required`,
with `detail: { id, tool, continuation, expiresAt }`. `AssistantAuthRequestedDetail` is a
published type in `dist/client-*.d.ts`, and the built-in renderer already draws a
"Sign in to continue" card.

---

## 2. The gap

**A customer backend has no supported way to spend the continuation.**

- `CreateAssistantSessionInput` (`@noodleseed/assistant@1.19.0`, `dist/server.d.ts`) has
  exactly these keys: `serviceUrl`, `clientId`, `clientSecret`, `origin`, `user`, `context`,
  `preferences`, `routing`, `claims`. There is no `continuation`.
- `grep continuation dist/server.js dist/server.cjs` → **0 hits**. The string does not occur
  in the server build at all.

The skill reference (`references/embedded-assistant.md`) describes the round trip as
finished: *"its backend POSTs that continuation to the session exchange with its own client
credentials."* The shipped helper cannot do that. Every host that follows the documentation
will get as far as the sign-in card and stop.

---

## 3. What we are asking for

### 3.1 Accept a `continuation` (the blocker)

Ideally as a discriminated union, mirroring the precedent the client already sets with
`AssistantSessionSourceOptions` (`sessionEndpoint` XOR `embedId`) — a fresh mint and an
elevation are different operations and the wrong pair should not typecheck:

```ts
type CreateAssistantSessionInput =
  | { serviceUrl; clientId; clientSecret; origin; user; /* … */ continuation?: undefined }
  | { serviceUrl; clientId; clientSecret; origin; user; /* … */ continuation: string };
```

Given the route already branches on the field's presence, we expect this to be a
pass-through.

### 3.2 Type the failures

Surface the five `completeElevation` codes as a discriminated error rather than a generic
throw. A host needs to tell "the visitor took too long" (`elevation_continuation_expired` →
re-prompt, mint a fresh session) from "a client reached for a conversation it does not own"
(`elevation_tenant_mismatch` → alert someone). Today every failure is an opaque `Error` and
the two are indistinguishable. The service already separates them precisely because, in its
own words, `tenant_mismatch` *"is the one worth alerting on, so it must not collapse into
the first."* That distinction dies at the package boundary.

### 3.3 Document the cross-origin shape — it works, but by accident-looking means

The docs assume the login page and the public embed share an origin. Our shape is the one
we think is actually common: public surface on `tivmark.com`, login on `app.tivmark.com`.

Reading the code, this **does** work — but only because of an interaction nothing states:

- `routes/assistant.js:253` checks `assistant.allowedOrigins.includes(parsed.origin)`.
- `allowedOrigins` is the **union of every surface's origins**
  (`authoring/dist/assistant.js`: `surfaces.flatMap(s => s.origins)`).

So an elevation presenting `https://app.tivmark.com` passes even though the conversation
began on `https://tivmark.com`. That is load-bearing behavior that reads like a side effect
of the union rather than a decision. Please confirm it is intended and write it down.

**And please document that the redirect handoff is mandatory, not stylistic.** The shipped
client calls session exchange with `credentials: 'same-origin'`, so a marketing page
pointing `sessionEndpoint` at another origin sends no cookies and gets a guaranteed 401 —
no CORS configuration changes this. In-place elevation on the public origin is therefore
impossible, and every multi-origin integrator has to discover that by failing. One paragraph
in `embedded-assistant.md` would save that.

### 3.4 Does the elevated session replay history?

This is the question that decides our user-facing copy. `AssistantToolCompletedDetail` and
`AssistantViewAvailableDetail` both carry `replayed?: true`, so the protocol clearly
contemplates replay — but we could find no rendering path in the managed element keyed on
it, and the element exposes no API to adopt a new token in place (only `reconnect()` /
`resetSession()`, and `#ensureClient()` keys the client on
`` `${embedId}|${serviceUrl}|${sessionEndpoint}` ``).

The skill says *"The conversation is kept: same history, new token, the anonymous one
dead."* If that history is not **rendered** after a navigation, the visitor sees an empty
panel that merely behaves as if it remembers. Please confirm what a host should expect.

### 3.5 `noodle assistant doctor` cannot prove this layer

It validates the authenticated exchange but never exercises an elevation, so there is no way
to prove the round trip before shipping to real visitors. A `--continuation` flag or a
synthetic-elevation probe would close the gap.

### 3.6 `noodle assistant embed --check` skips `script-src`

`@noodleseed/one@0.127.0`, `dist/commands/assistant-embed-ops.js:184`:

```js
const missingDirectives = ['connect-src', 'frame-src'].filter(…)
```

For a **public** embed the critical directive is `script-src` — it is what loads
`embed.js`. Your own guidance says a blocked `script-src` runs no widget code at all, *"so
nothing can report it from the page."* The single failure mode that is undetectable from
inside the page is the one the preflight does not check. Please add `script-src` when the
project declares a public or mixed surface.

Two smaller notes on the same command: it hardcodes `NOODLE_SERVICE_URL` and
`PUBLIC_APP_ORIGIN` as the host env names, which forces repos using other names to alias at
the call site; and `inspectNextCsp` does a **literal substring** match on the service
origin, so a perfectly valid wildcard (`https://*.noodleseed.dev`) reports `unverified` and
fails the check.

### 3.7 The npm README documents none of this

In `@noodleseed/assistant@1.19.0`'s README, these appear **zero** times each: `embedId`,
`publicWebsite`, `embed.js`, `sign-in`. An integrator reading only npm cannot discover the
public embed or the elevation flow — even though `embedId` is a published prop in
`dist/react.d.ts` and is half of a documented XOR with `sessionEndpoint`.

### 3.8 "Continuation" now means two opposite things

The README's three uses of the word (lines 258, 396, 410) all refer to the **server-held
interaction continuation**, whose whole security property is that it is *never exposed to
browser code*. The elevation continuation is the exact opposite: a capability that
**deliberately travels through the browser**.

Two opposed security properties under one word will make integrators reason wrongly about
at least one of them. Renaming the newer concept (`signInTicket`, `elevationTicket`) before
it is widely adopted seems cheap now and expensive later.

---

## 4. What we are building in the meantime

We are shipping the mixed surface with the backend leg behind a single seam
(`apps/web/lib/assistant/elevation.ts`) whose only job is to be a one-function change when
3.1 lands. Until then the visitor signs in and continues in a *fresh* conversation rather
than the same one — a graceful degradation, not an error.

We would rather delete that seam than keep it. If 3.1 ships on your side while we finish the
surrounding work, our integration is a single commit.

## 5. One thing that is genuinely good

The public-surface design is the strongest part of the release and worth keeping intact
under review pressure: `capabilities` as a **required** positive allowlist on
`publicWebsite`, the compiler refusing to project a `${user}`-reading tool onto an anonymous
surface, the per-surface daily budget with a real kill switch, and the embed id being
explicitly *not* a credential. Those four choices are why we are comfortable putting this on
a public marketing page at all.

The one place that model has a hole: `interceptForElevation` and the compiler's
`assistant_public_user_reference` share `anonymousBehavior`, which classifies on `${user}`
references and `authorization` — **not** on connector auth kind. A tool backed by a
`delegatedTokenExchange` connector but with no `${user}` in its compiled fulfilment is
classified `public-safe`, so on a `mixed` surface it executes anonymously and fails in the
credential broker with `credential_unavailable` instead of raising the sign-in card. We work
around it by adding a `${user}` reference to such tools, which is effective but is a trick
rather than a declaration. Consider classifying on the connector's auth kind too.
