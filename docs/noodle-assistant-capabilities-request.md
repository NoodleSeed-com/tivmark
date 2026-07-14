# NoodleSeed — capabilities delivered & enabled (embedded assistant)

> For the NoodleSeed developers, from a design partner (Tivmark). We filed a capability request after a
> real conversation ("book me time off next Thursday and Friday") hit three walls in v0.35.0: the
> assistant didn't know the date, couldn't tell whether the form it "opened" was on screen, and couldn't
> safely "just book it." **You shipped all seven requested capabilities** in `@noodleseed/one@0.37.0`
> and `@noodleseed/assistant@1.2.0`. This is the record of what landed and what we turned on — thank you.
> (The original request and its evidence map are preserved in git history for this file.)

## What we're running
- `apps/assistant`: `@noodleseed/one` **0.37.0** — deployed as **v7** (`tivmark-assistant`, access
  `customers`).
- `apps/web` (portal): `@noodleseed/assistant` **1.2.0**.

## Capability-by-capability: shipped → enabled

| # | Capability (was missing in 0.35.0) | The API you shipped | What Tivmark enabled |
|---|---|---|---|
| 1 | **Current date/time in every turn** | Automatic `invocationContextSystemMessage()` — "Current server time… User-local date and time…" | Instructions now tell the model to resolve relative dates ("next Thursday") from it; no more "I don't have the date." |
| 2 | **Per-user timezone/locale** | `createAssistantSession({ preferences:{ locale, timeZone } })`; `user.timeZone`/`user.locale` in fulfilments | Portal captures the browser's IANA zone + locale into a cookie and forwards them as trusted `preferences`, so dates resolve in the user's own zone. |
| 3 | **Trusted per-turn ambient context** | `server({ context:{ defaults, ambient:{ output, fulfil } } })` (read-only connectors, validated, frozen per invocation) | `ambient.fulfil` runs `list_teams` under the delegated per-user token and injects the user's teams every turn → the model resolves the team silently, no lookup round-trip. |
| 4 | **Model-visible widget state** | `useUpdateModelContext()` (guarded by `useLayout().supports?.modelContext`) | All three widgets publish a compact model summary; the request form reports its live fields, so the assistant knows a form is open and what it holds. |
| 5 | **Widget lifecycle events** | `useWidgetLifecycle(name)` → mounted/submitted/cancelled/dismissed | The form emits `submitted` (with the request summary); all three auto-emit `mounted`. The assistant reacts after submit without the user re-explaining. |
| 6 | **Confirmation gate (HITL)** | `annotations.action({ confirm:true })` + runtime confirmation (`confirmation_required` → review → execute) | New model-callable `book_time_off` and `cancel_time_off_request`: the model resolves args, the runtime shows a confirm card with the exact request, and only fires on approval. |
| 7 | **Elicitation** | `ctx.elicit({ id, message, input })` (no longer reserved; interactive execution) | New `book_time_off_guided`: for under-specified requests, elicits leave type + dates as one schema-validated form before the single (confirmed) create op. |

Bonus we picked up for free: the reserved read-only `noodle_context` temporal tool is now auto-exposed.

## Notes for your team
- The React `<NoodleAssistant>` wrapper (1.2.0) still exposes no `clientContext` prop, so we route
  timezone through backend `preferences` (the trusted, higher-precedence channel) — which is arguably
  the right default anyway. A first-class `clientContext` prop on the React wrapper would let pure-SPA
  embeds pass the per-turn browser hint without a backend round-trip; minor, optional.
- The confirmation "at most one connector op per confirmed flow" rule shaped our design cleanly: `book`
  and `cancel` each wrap exactly one op. Worth keeping that constraint prominent in the docs — it's the
  one thing that isn't obvious until you hit `invalid_confirmation_flow`.
- Everything still runs **as the signed-in user** through delegated token exchange; the ambient
  provider inherits that same per-user token, so it only ever sees that user's teams.

Net: the three walls are gone. "What's today?", "book Thursday and Friday next week", and "I don't see
what you opened" are all handled now. Thanks for building the infrastructure — it generalizes to every
SaaS customer, not just us.
