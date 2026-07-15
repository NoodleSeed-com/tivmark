# NoodleSeed platform feedback — making it world-class for AI agents to build on, first-go

> From a design partner (Tivmark). We build with AI coding agents, so our north star is: **an agent
> should be able to build the right thing on the first pass**, without reverse-engineering your source
> or discovering invariants by hitting them in production. Everything below is grounded in things we
> actually hit shipping a single MCP server that serves both our embedded portal assistant *and*
> external MCP clients (ChatGPT/Claude) with BYO identity. Each item is written so it helps **any** SaaS
> builder, not just us.

## What's already excellent — please keep leaning into it
- **Agent-native `--json` contract** across `validate` / `check` / `test` / `auth doctor` / `events` /
  `logs`, with `error.code` / `error.fix` / `error.next`. This is the single best thing you have for
  agents — extend it *everywhere* (see error-observability below).
- **Responsiveness to real gaps.** In this engagement you shipped, on request, delegated token exchange
  (RFC 8693), temporal grounding, per-user timezone/locale, a trusted ambient-context provider,
  model-visible widget state + lifecycle, a runtime confirmation gate, and elicitation. That turnaround
  is the reason we can build on you.
- **Clean architecture** — `customerAuth.oidc` as a pure resource server (advertise the customer AS,
  verify the JWT) is exactly right conceptually. The issues below are about **composition, fail-fast,
  and docs**, not the core design.

## The one principle behind almost all of this
Every hour we lost was one of two things: **(a) a runtime failure that should have been a
compile/deploy/doctor-time error**, or **(b) an undocumented invariant that should have been a
scaffolded, machine-readable recipe.** An agent-native platform wins by moving every invariant *left*
(to author/deploy time) and making the golden paths *discoverable* (in the skill), so the agent gets it
right before it ever deploys.

---

## Prioritized recommendations

### 1. Make auth + delegation COMPOSE — or fail fast (highest impact)
We wired `--access customers` + `customerAuth.oidc` + a `delegatedTokenExchange` connector. Inbound auth
worked, but **every tool call failed at runtime** with `credential_unavailable`. Root cause: an
`oidc`-verified caller is never tagged `identityKind: 'customer'`, and
`delegated-token-exchange.js`'s guard requires exactly that. `identityKind` is only derived from a
`noodle_identity: 'customer'` claim, which you stamp on tokens **you** mint (bridge / assistant-session
— e.g. `routes/assistant.js:198`), but never backfill for a third-party oidc token. Confirmed unchanged
in 0.38.1.
- **Best fix:** backfill `identityKind: 'customer'` for verified oidc customer callers (mirror what
  `routes/assistant.js:198` already does for assistant sessions) so **oidc + delegatedTokenExchange
  composes out of the box.**
- **If a token claim must be required instead:** have `noodle validate` / `noodle auth doctor` detect
  the `customers + oidc + delegatedTokenExchange` combination and emit an error naming the exact fix
  ("your IdP must mint `noodle_identity: 'customer'`"), and document it in the oidc recipe. We had to
  diagnose this from live `events` + a source trace; an agent would never guess it.

Related: **`customerAuth.bridge({ verifyUrl })` with a custom provider has a deny-all inbound verifier**
(only `firebase`/`microsoft` verify inbound). So a "custom bridge" silently cannot serve a direct MCP
client — no error, it just never authorizes. Either implement the custom-bridge inbound verifier, or
make `validate`/`deploy` reject it with "custom bridge cannot serve direct MCP clients; use
`customerAuth.oidc`."

### 2. `noodle auth doctor` should verify the whole chain, not just reachability
Today it confirms issuer / `openid-configuration` / `jwks` are reachable — all of which passed for us
while the integration was still completely broken. It does **not** verify that a token from the IdP will
actually authorize *and delegate*. Add an optional **live round-trip**: accept (or mint) a test user
token → verify it as the resource server → run a dummy delegated exchange → report PASS/FAIL **with the
real reason**. That single check would have caught our `credential_unavailable` before we ever shipped
to ChatGPT. "Doctor passes but production fails" is the worst possible outcome for an agent that trusts
green checks.

### 3. Stop swallowing runtime errors — surface the actionable cause
`runtime/dist/execute.js` wraps `broker.getCredential(...)` in a **bare `catch`** and returns a generic
`credential_unavailable`, discarding the real message (`delegated token exchange requires a verified
customer caller`). We only diagnosed it by tracing your source. Preserve and surface the specific,
redaction-safe reason in the tool error **and** in the `events` stream, with a `fix`/`next` hint — the
same quality your CLI errors already have. For agents, a precise error *is* the fix.

### 4. Encode end-to-end RECIPES in the skill (for agents and humans)
The flagship SaaS pattern — **"one MCP server, customer's own IdP, calls the customer's API as the
signed-in user, working in BOTH the embedded portal and external MCP clients"** — currently has to be
reverse-engineered across `customer-verifier.js`, `registry-targets.js`, `handler.js`,
`delegated-token-exchange.js`, `verify.js`, etc. Make it a **named, machine-readable recipe** with the
full contract in one place:
- `--access customers` + `customerAuth.oidc({ issuer, audience })`;
- the `noodle_identity: 'customer'` requirement (until #1 lands);
- the IdP must expose discovery + JWKS + **RFC 7591 Dynamic Client Registration** + PKCE (you do **not**
  proxy DCR for oidc — this surprised us);
- audience rules (literal `aud` match, **no** RFC 8707 resource-indicator substitution);
- the `delegatedTokenExchange` token-endpoint contract.
Then ship a **`noodle init` scaffold** for it, including a "reference IdP checklist." An agent handed
this recipe builds it correctly in one pass instead of five.

### 5. Publish a host/transport capability matrix + graceful degradation
`annotations.action({ confirm: true })` and `ctx.elicit(...)` "fail closed" on hosted/stateless
transports (e.g. ChatGPT's MCP connection can't carry server-initiated forms). Today an author can't
tell which tools will silently break on which host. Publish a **feature × host/transport matrix**, have
`noodle check --target <host>` **report at author time** which authored tools will degrade, and offer a
documented **graceful fallback** (e.g. a confirm-required action auto-degrades to an in-band text
confirmation when the transport can't carry the native one) so builders don't ship dead flows.

### 6. Connector DX — strict output validation clarity + the list pattern
Strict connector output validation silently rejects real, field-rich API objects (our team-list "came
back invalid"). It cost a debugging cycle to learn the "bind the whole array as `z.array(z.unknown())`
and narrow in a compute connector" pattern. Two asks: (a) make the validation error **name the offending
field/path** and suggest the fix; (b) provide a first-class "lenient passthrough → narrow" helper so
that pattern isn't tribal knowledge every builder rediscovers.

### 7. `auth doctor` discovery-URL consistency
The runtime verifier accepts the `/.well-known/oauth-authorization-server` fallback, but `auth doctor`
only probes `/.well-known/openid-configuration` — so a perfectly working IdP can get a **false FAIL**
from doctor. Align the two (and document which paths you probe).

### 8. CLI/service version skew — degrade, don't hard-break
Mid-incident, `noodle logs`/`events` refused to run: *"CLI 0.37.0 is not compatible with this service;
install 0.38.1."* Being blocked from reading logs *because* you need to read logs is painful. Keep
**read-only** commands forward-compatible across a minor skew, surface the required version proactively
in `deploy` output, and make the incompatibility a warning rather than a hard block for diagnostics.

### 9. Embed SDK parity
The React `<NoodleAssistant>` wrapper exposes no `clientContext` prop — only the low-level
`createAssistantClient` does — so per-turn browser hints (timezone/locale) can't flow through the
wrapper; we had to route them via backend `preferences`. Add `clientContext` to the React wrapper for
parity so the common embed path can pass live hints without dropping to the low-level client.

### 10. Semver / release-channel clarity
A `^0.34.1` range silently capped us below the `0.35.0` that contained the feature we needed. Pre-1.0
caret behavior is surprising to agents and humans alike. A machine-readable **release-notes/changelog
feed** plus a "minimum version for feature X" note in each doc lets an agent pick the correct version
deterministically.

---

## The meta-ask: three levers for "correct in the first go"
1. **Fail-fast at author/deploy/doctor time for every runtime invariant.** If an invariant can fail in
   production (auth composition, transport capability, output shape), it should first fail in
   `validate`/`check`/`auth doctor` with a `fix`. Green checks must mean "it will actually work."
2. **Machine-readable recipes + scaffolds for the top SaaS patterns.** BYO-IdP + delegated API +
   embed-and-external in one server is the pattern every SaaS builder wants; make it a named recipe and
   an `init` template, not an archaeology exercise.
3. **Never swallow an error.** Every failure an agent can hit should carry its specific cause and a fix.

If every invariant we hit at runtime this month had instead been a `validate`/`auth doctor` error with a
`fix`, an AI agent would have built this correctly on the first attempt — which is exactly the promise
that makes NoodleSeed worth building our platform on. Happy to pair on any of these.
