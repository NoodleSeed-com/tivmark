# NoodleSeed feedback — MCP host compatibility + developer-experience retrospective

> For the NoodleSeed developers, from the Tivmark design-partner rebuild (2026-07-16). The clean-slate
> rebuild shipped in roughly one working day: a people-ops MCP app (time-off + equipment + admin review),
> 4 widgets, the embedded assistant live in the portal, and a direct ChatGPT connection that authenticates
> and renders read widgets in-chat. This document covers four things: **(A)** one hard host-compatibility
> gap that currently makes *every write tool* dead in ChatGPT, **(B)** confirmed platform bugs and
> misleading errors found along the way, **(C)** a candid retrospective of where the build time actually
> went — each point of friction, what it cost, and the platform change that would have eliminated it, and
> **(D)** what worked well. Section **E** is a prioritized ask list. Everything here is backed by
> `noodle events` / `noodle check` output and reproducible commands, not impressions.

## Environment

- `@noodleseed/one` **0.44.0** (project-local CLI + SDK), Node 24.
- Deployment: `noodleseed/tivmark-assistant/prod` **v10** (`tivmark-assistant-b8f2b82b`), access
  `customers`, `customerAuth.oidc` against Tivmark's own OAuth server (BYO IdP with RFC 7591 DCR).
- Hosts exercised: embedded assistant (portal embed), **ChatGPT developer mode** (`openai-mcp (ChatGPT)`),
  curl/JSON-RPC + MCP semantics probes.
- Connector: `delegatedTokenExchange` (RFC 8693) → every tool call runs as the signed-in Tivmark user;
  Tivmark's v1 API enforces its own per-user/per-team authz.

---

## A. The blocker: confirm-gated and elicit tools fail closed in ChatGPT — 100% of writes are dead

This is the headline. An app authored to NoodleSeed's *own recommended best practice* — confirm-gate
every write, use `ctx.elicit(...)` for under-specified input — is completely unusable for writes in the
flagship third-party host. Reads work; every write throws `mcp_error`.

### What the end user sees (verbatim, real ChatGPT conversation, 2026-07-16 ~02:05–02:09 UTC)

- ✅ "Your Noodle team balance is: Vacation 15 days, Sick 10, Personal 3…" — `time_off_balance` rendered.
- ❌ "Can you help me request a new laptop?" → *"the guided form couldn't open here, so please tell me…"*
- ❌ After collecting details conversationally: *"Tivmark's confirmation window couldn't open. Reply
  'Confirm'…"* → user replies Confirm → *"The request could not be submitted because Tivmark's required
  confirmation interface isn't supported in this chat. No equipment request was created."*

The model degraded politely, then dead-ended — and the "reply Confirm" fallback it invented *also* failed,
producing a frustrating loop.

### Server-side proof (`noodle events`, same timestamps)

| tool | annotation | outcome |
| --- | --- | --- |
| `time_off_balance` | `readOnly()` | **ok** (816 ms) |
| `my_teams` | `readOnly()` | **ok** (882 ms) |
| `order_equipment` | `action({ confirm: true })` | **mcp_error** ×4 |
| `order_equipment_guided` | `action({ confirm: true })` + `elicit` | **mcp_error** ×2 |

The full confirm-gated surface (per `noodle check --target embedded-assistant`) — `book_time_off`,
`book_time_off_guided`, `cancel_time_off_request`, `order_equipment`, `order_equipment_guided`,
`cancel_equipment_request`, `review_time_off`, `review_equipment`, `fulfill_equipment` — is every write in
the app. All of it fails in ChatGPT.

### Root cause (and why it's a design decision, not just a missing feature)

Your own `references/embedded-assistant.md` states it plainly:

> "Bidirectional MCP transports map missing input to standard form `elicitation/create`; an adapter that
> cannot carry that request fails before executing the tool. The same negotiated form capability carries a
> final affirmative confirmation and **fails closed when unavailable**."

ChatGPT's MCP client does not implement `elicitation/create`, and does not expose whatever interaction
channel the runtime uses for the confirmation gate. So the runtime fails closed — correctly, per its
contract. The problem is the *contract*: **fail-closed is the wrong default for a capability the flagship
host lacks**, especially when that host offers two perfectly good substitutes:

1. **ChatGPT already gates non-`readOnly` tool calls behind its own native user-approval UI.** For
   `confirm: true`, the human-in-the-loop guarantee you want *already exists at the host layer*. The
   runtime is refusing to execute a write that the host would itself have confirmed.
2. **ChatGPT supports MCP Apps widgets** (our read widgets render in-chat — proven). An elicitation form or
   a confirmation card is exactly a widget.

### The ask (ranked)

1. **Negotiate down instead of failing closed.** When a host advertises no `elicitation`/interaction
   capability but *is* a known write-confirming host (or declares MCP Apps support), execute the confirmed
   action directly and rely on the host's native approval. Gate this on a capability check at `initialize`,
   not a hard fail. This single change resurrects the entire write surface in ChatGPT.
2. **Render elicitation/confirmation as a widget in Apps-capable hosts.** You already have the widget
   channel and it works in ChatGPT. `ctx.elicit(...)` → a form widget; `confirm: true` → a confirm card
   widget. This keeps the exact UX intent across hosts.
3. **At minimum: fail *open to the model*, not closed with an opaque error.** Today the tool returns
   `mcp_error` and the model is left guessing (it invented "reply Confirm", which also failed). Return a
   structured, model-legible result ("this host cannot present a confirmation; call the direct variant / ask
   the user to confirm in words and re-call with `confirmed: true`") so the assistant can self-recover.
4. **Make it visible at author time.** `noodle check --target chatgpt` should warn: "N confirm-gated /
   elicit tools will fail in hosts without interaction capability (e.g. ChatGPT); see host-compat matrix."
   Right now nothing tells the author their whole write surface is host-incompatible until a user hits it.

Net: an app that follows your guidance is broken for writes in ChatGPT, and the author gets no warning.
This is the one item I'd genuinely call **broken on the platform side**.

---

## B. Confirmed platform bugs & misleading errors

1. **`noodle open --print` returns a stale deployment URL.** It printed the **v6** endpoint while v9/v10
   were the active deployment. Reproducible; nearly handed a wrong URL to a host. (The unversioned
   `.../tivmark-assistant/mcp` default URL is correct — `open` should return that or the active version.)

2. **The deploy body-limit 413 error gives wrong advice.** A 7-widget manifest (1.46 MB) failed with:
   `{"code":"deploy_failed","message":"request body too large","fix":"Check the service status and
   retry.","next":"noodle doctor","detail":{"status":413}}`. "Retry" never fixes a size limit. It should
   name the cause and the number: *"manifest 1.46 MB exceeds the deploy limit of X MB; largest
   contributors: 7 widget bundles at ~207 KB each."* **You've since raised the limit (thank you)** — but the
   message is still misleading, and `validate`/`check` should warn locally *before* a failed deploy when the
   manifest approaches the cap. (See also C-2 on *why* it was 1.46 MB.)

3. **`noodle deploy` demands `--version` + positional entrypoint on a linked project.**
   `{"code":"missing_server_version","message":"No server version was provided and no versioned folder was
   found.","next":"noodle deploy <entrypoint> --version 1"}`. For a directory already linked to
   `org/app/env` with a known last version and an `entrypoint` in `noodle.json`, it could infer both (or
   auto-increment). Minor, but it's a required-flag papercut on the single most-run hosted command.

4. **`noodle check --target chatgpt` classifies missing widget `domain` as `warn` — "fine for dev-mode
   testing" — but ChatGPT's dev-mode app-version build *requires* it.** With no `domain`, ChatGPT connected,
   authenticated, and completed `initialize`/`tools/list`/`resources/read` (all ok in events) yet showed
   **"Disconnected / No app actions available yet."** Adding `domain` to the 4 widget tools fixed it. That
   cost a full deploy→re-add→retest cycle to discover. For the `chatgpt` target, missing `domain` should be
   an **error**, and the "fine for dev-mode testing" copy is actively wrong.

5. **A stale global CLI emits misleading errors on correct code (version-skew).** The global `noodle` was
   0.33.0 while the project SDK was 0.44.0. Validating a correct `server.ts` produced
   `read_error: invalid connector catalog: connectors.0: Invalid input` (on a valid `delegatedTokenExchange`
   block) and then `read_error: elicit is not a function`. Both validated **clean** under the project-local
   0.44 CLI; `app.toManifest()` under the 0.44 SDK also succeeded. An older CLI parsing a newer manifest
   should not surface as user-code errors. `validate`/`test`/`deploy` should detect CLI-vs-project-SDK skew
   and say so loudly (*"CLI 0.33.0 is older than this project's @noodleseed/one 0.44.0; run via
   `./node_modules/.bin/noodle`"*). This was the single biggest time-sink in authoring (see C-1).

---

## C. Retrospective — where the day actually went

The build was fast, but ~half the elapsed time was spent on a handful of avoidable frictions. Ranked by
cost:

1. **CLI/SDK version skew (B-5) — biggest single sink.** I bisected the connector (swapped
   `delegatedTokenExchange` → `bearer` to localize the "Invalid input"), then imported the server under Node
   to get a real stack trace for "elicit is not a function," before realizing the *code was fine* and the
   global CLI was stale. A one-line skew warning would have saved all of it.

2. **Per-widget React inlining forced a feature cut.** Each compiled widget embeds its own ~207 KB React
   bundle; 7 widgets = 1.46 MB → 413. To deploy at all I had to trim to 4 widgets (drop two request-form
   widgets + the equipment review queue) — i.e., I shipped *less product* purely to fit the transport. The
   fix isn't only a bigger limit (thank you for that): **dedupe/share React across widget bundles** so N
   widgets aren't N copies of React. 7×207 KB of near-identical runtime is the actual payload problem.

3. **The `customers` + generic-MCP-client + DCR story is undiscoverable.** `--access customers` with
   `customerAuth.oidc` deploys clean and works for the embed, so I believed direct ChatGPT would "just
   work." It dead-ended at ChatGPT's *"Enter a client ID to use a user-defined OAuth client"* because the
   IdP advertised no `registration_endpoint` — generic MCP clients need **RFC 7591 Dynamic Client
   Registration**. Nothing in `noodle deploy`/`check`/`auth` flagged this. `noodle auth` (the customerAuth
   readiness diagnostic) should fetch the configured issuer's discovery doc and, for `customers`-access
   apps, flag a missing `registration_endpoint` as "generic MCP clients (ChatGPT/Claude) will not be able to
   connect." I had to hand-rebuild the DCR endpoint on our IdP to get past it.

4. **The embed go-live is a long, cross-system, easy-to-break runbook with no validator.** Deploy MCP →
   `assistant clients create` → set **6** env vars split across **two credential systems that must not
   cross** (Noodle deployment owns `ASSISTANT_MODEL_*`; the SaaS backend owns `NOODLE_ASSISTANT_CLIENT_*` +
   the delegation client id/secret) → create GCP secrets → set Cloud Run env, which **replaces the whole env
   set on every deploy** (so a manual add is silently wiped next deploy). The two-set separation is *good
   design* but very easy to misconfigure, and there's no end-to-end check. Ask: a `noodle assistant doctor`
   that, given the SaaS backend config, verifies the client is valid against the active deployment, the
   origin is allowlisted, and the delegation secret matches — the equivalent of `noodle doctor` for the
   embed boundary.

5. **Small JSON-shape / status inconsistencies.** `noodle status`/`open` nest their payloads differently
   (`data.deployment` vs top-level), so agent parsing needs per-command shape guesses. Not costly, but it
   adds friction to the otherwise-excellent `--json` contract.

**What "much faster" would have looked like:** the same app in ~2–3 hours instead of a day, if (1) skew was
detected, (2) widgets shared React, (3) `check` flagged the DCR gap and the confirm/elicit host-incompat up
front, and (4) an embed doctor validated the boundary. None of these are core-capability gaps — they're
guardrails and diagnostics around capabilities that already work.

---

## D. What worked well (credit where due)

- **The author→`validate`→`test`→`dev` loop is genuinely fast**, and the `--json` + fix-prompt contract is
  the best agent-native CLI surface I've used. Errors carry `path`/`fix`/`next`.
- **`delegatedTokenExchange` (RFC 8693) is a clean, correct primitive.** Per-user downstream calls with no
  service key, no forwarded/spoofable ids — it worked first try once authored. This is the right shape.
- **`noodle events` is why I could diagnose everything precisely.** "reads ok, writes mcp_error," client =
  `openai-mcp (ChatGPT)`, per-tool outcomes and timings — this telemetry turned every "it doesn't work" into
  a one-line root cause. More of this.
- **The embedded assistant, once wired, is excellent** — per-turn ambient context (the user's teams with
  roles), automatic date/timezone grounding, and read widgets rendering in-chat all work well.
- **`noodle restore` + the versioned deploy model** made recovering the archived app trivial.
- **The bundled examples + self-installing project skill** are high quality and were the reason authoring
  the connector/tools/widgets was mostly copy-adapt.

---

## E. Prioritized asks

| # | Priority | Ask | Eliminates |
| --- | --- | --- | --- |
| 1 | **P0** | Host-capability fallback for `confirm`/`elicit` — negotiate to host-native approval or render as a widget in Apps hosts; never opaque `mcp_error`; warn at author time | §A — all writes dead in ChatGPT |
| 2 | **P1** | Detect CLI↔project-SDK skew in validate/test/deploy and say so | §C-1 — biggest authoring sink |
| 3 | **P1** | Share/dedupe React across widget bundles; honest 413 message; local pre-deploy size warning | §B-2, §C-2 — forced feature cut |
| 4 | **P1** | `customers`-access DCR readiness check (probe issuer discovery for `registration_endpoint`) | §C-3 — silent ChatGPT dead-end |
| 5 | **P2** | `domain` = error for `--target chatgpt`; fix "fine for dev-mode" copy | §B-4 — a wasted deploy cycle |
| 6 | **P2** | `noodle assistant doctor` for the embed boundary; fix `open --print` stale URL; infer deploy version | §B-1, §C-4, §B-3 |

The through-line: NoodleSeed's *capabilities* are solid and mostly worked first try. The lost time was in
**diagnostics and host-compatibility guardrails** — the platform knows enough (via `check`, `auth`,
`events`, and the manifest) to warn about every one of these before a user ever hits them. The P0
confirm/elicit fallback is the one that turns "impressive demo that can only read" into "actually usable in
ChatGPT."
