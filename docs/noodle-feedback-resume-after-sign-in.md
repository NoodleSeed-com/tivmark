# Feature request: after mid-conversation sign-in, the assistant should answer the pending question itself

**From:** Tivmark (Noodle Seed sample customer site)
**To:** Noodle Seed engineering
**Date:** 2026-08-20
**Refs:** fb-1174 (related cosmetics); prior: `docs/noodle-assistant-elevation-gap.md`,
`docs/noodle-seed-response-aug-19-2026.md`, `docs/noodle-production-release-brief.md`
**Against:** `@noodleseed/one@0.129.2` (system-r601), `@noodleseed/assistant@1.20.0`

---

## 0 — Summary

r601's mid-conversation sign-in works, and works every time — we have five clean
`assistant.session.elevated · allow` audit entries and zero refusals from a night of real
testing. Thank you; the hard part is genuinely done.

But the first thing every real user says afterwards is the thing we are writing about. Our
founder's verbatim reaction, on the first real use:

> "Mark should have answered my last question proactively once logged in. Not waiting for me
> to ask."

Today the elevated session sits silent. The visitor asked a question, was told to sign in,
did everything right — and lands on an empty panel that *knows* the answer and says nothing.
The "remembers but does not replay" contract explains why the transcript is empty; nothing
explains to the user why the assistant doesn't just finish what it started.

**The ask (§1): when a spent ticket elevates a session, resume the intercepted tool call
under the new principal and stream it as the elevated session's first turn.** The service
has everything it needs — it *recorded the tool name in the audit event*. Every host that
wants a decent sign-in UX currently has to rebuild this client-side, and §2 documents in
detail what that cost us in one evening, as the evidence for why it belongs in the platform.

§3 collects smaller, separately-verified findings from the same night (each with repro), and
§4 is the praise section, which you have earned.

---

## 1 — The feature: server-side resume of the intercepted call

### 1.1 What the service already knows at elevation time

When `interceptForElevation` raises the sign-in card, the service records the elevation with
**the exact capability the visitor was refused** — your own audit event carries it:

```json
{ "eventType": "assistant.session.elevated", "decision": "allow",
  "details": { "tool": "time_off_balance", "sessionId": "session_72f2be14-…" } }
```

The conversation history (which the model keeps — "remembers") also contains the
interception's own guidance to the model: *"Ask them to sign in using the card shown, then
offer to try again."* So at the moment `completeElevation` succeeds, the service holds: the
conversation, the pending intent, the tool that was intercepted, and — now — a verified
principal allowed to run it.

Everything required for the obvious next step exists server-side. The step just isn't taken.

### 1.2 Proposed behaviour

On a successful ticket spend, the service starts one assistant turn on the elevated session
— as if the system (not the visitor) had said "the visitor has signed in; continue" — so the
model re-attempts the intercepted intent under the new principal and the result streams to
whichever client holds the elevated token.

Semantics that we think fall out naturally, and that we would like confirmed in the design:

- **Read-only tools run.** `time_off_balance` just answers. This is the demo-magic case:
  the visitor signs in and the panel's first content is the answer to the question they
  asked on the marketing site.
- **Confirm-gated tools propose.** If the intercepted tool was `book_time_off`, the resume
  turn should end at the standard confirmation card, exactly as if the signed-in user had
  asked — sign-in must never convert into implicit consent for a write. (This mirrors the
  rule you already enforce: `assistant_public_effect_unconfirmed` requires read-only or
  confirm on public/mixed projections, so every resumable tool is one of the two.)
- **Opt-in, per surface or per exchange.** `publicWebsite({ signIn: true, resume: 'auto' })`
  or a `resume: boolean` on the elevation arm of `createAssistantSession`. Hosts that
  built their own affordance (us, currently) can turn it off.
- **One-shot and expiring.** The pending intent resumes at most once, only on the elevation
  that spent the ticket, never on later exchanges.
- **Audited** like everything else — `assistant.session.resumed`, with the tool.

### 1.3 Why this belongs in the service and not in hosts

We built the host-side version tonight. It works (§2.4), but look at what it took, and
remember we are the *best-case* integrator — we had your engineers answering mail the same
day:

1. A parent-domain handoff cookie whose *presence at first render* must be captured before
   the element's eager session exchange spends it (a race we shipped wrong once).
2. A mount-effect that waits on `customElements.whenDefined` plus a poll for the element
   handle, because relying on a wrapper callback proved undiagnosable in the field (§3.1).
3. A synthetic user message ("I've just signed in — please pick up where we left off and
   answer my last question") that shows up in the transcript as something the user never
   typed, and whose effectiveness depends on prompt phrasing.
4. Two TS2774 build breaks, one ESLint round, and three production deploys to get right.

And the result is still worse than what the service could do: our resume message is a
*guess* at the pending intent relayed through the model, while the service knows the
intercepted call *exactly*. Every mixed-surface integrator will either rebuild this
scaffolding or ship the silent-panel experience that made our founder file this feedback.

---

## 2 — Evidence: one evening of building the host-side workaround

Timeline (2026-08-19/20 UTC), all verifiable in our repo history and your audit log:

| Time | Event |
| :-- | :-- |
| 23:48 | First real sign-in: `elevated · allow · my_equipment`. Panel silent; user reports "conversation didn't transfer". |
| 23:51 | We type into the silent panel: *"Hi Fahd! Welcome back. We were checking on how much vacation you have left on the Noodle team"* — memory fully intact, purely invisible. |
| 00:0x | PR #87: resume message driven by wrapper `onReady`, gated on live cookie. Deployed. |
| 00:19 | Real sign-in: `elevated · allow`. Panel still silent. |
| 00:2x | PR #88: cookie captured at first render (race theory). Deployed. |
| 00:40 | Real sign-in: `elevated · allow · time_off_balance`. **Panel still silent.** |
| 00:4x | Controlled experiment: planted fake ticket on `/mark`, reloaded. Cookie present through entire load; still no send. Backend refused the fake ticket and failed open to a fresh session — resilience path proven live, thank you. |
| 00:5x | Bundle forensics: the deployed async chunk **contains** the current wrapper (string-level greps for `assistant-ready` and the shadowRoot fallback both hit). |
| 01:0x | Live element probes: wrapper effect demonstrably ran (`element.appearance` set), `assistant-ready` fires on reconnect, `shadowRoot` open. Mechanism healthy when probed. |
| 01:1x | PR #89: resume driven from a mount effect (`customElements.whenDefined` + bounded poll), independent of `onReady`. |

The honest residual: we cannot cleanly attribute the 00:19/00:40 silent failures between
(a) a wrapper-callback issue and (b) our own Cloud Run rollout timing (testing a
just-promoted revision that wasn't yet serving). The probes in the 01:0x row say the
mechanism is healthy *when inspected*; the field failures say something in the
first-mount path was not. Which is precisely the problem: **this flow currently has no
observability** (§3.1's ask). A service-side resume would eliminate the entire class.

---

## 3 — Smaller findings from the same night, each separately actionable

### 3.1 The `onReady` contract is undocumented and unobservable

`NoodleAssistantProps.onReady?: () => void` has no documented contract: does it fire once
per mount? After element upgrade? Is it guaranteed if the element was defined before the
wrapper mounted? We read the implementation (listener for `assistant-ready` + a synchronous
`if (element.shadowRoot) ready()` fallback, deduped by a `readyNotified` ref) and *still*
could not attribute a field failure to it or exonerate it, because nothing it does is
observable from outside.

Asks: document the contract; emit one debug-level breadcrumb when ready fires (you already
log appearance warnings); and cover "element defined before wrapper mount" and "strict-mode
double-effect" with integration tests.

### 3.2 `assistant-ready` re-fires on every reconnect, undeduped at the element

`connectedCallback` dispatches `assistant-ready` unconditionally — verified live: removing
and reinserting the element fires it again. The React wrapper dedupes with `readyNotified`,
but a wrapperless integrator (your own embed loader docs encourage direct element use)
who treats it as once-per-lifetime will double-run their setup on any reparent (which
routers and portal libraries do). Either dedupe at the element or document "fires on every
connect".

### 3.3 `sendMessage` racing the eager session exchange — please document the ordering

An open panel eagerly runs its session exchange on mount. Our resume calls
`element.sendMessage(...)` as early as possible — potentially while that exchange (which is
also the one *spending the elevation ticket*) is in flight. Empirically it has behaved well
(message queued onto the resulting session), but we found no documented guarantee that a
concurrent `sendMessage` cannot trigger a second exchange or race the elevation. One
paragraph in the README would let integrators lean on it.

### 3.4 Already filed as fb-1174, restating for the same fix window

- `noodle assistant embeds list` reports the **provisioning-time** `surfaceMode`
  (`public`) after a redeploy changed it (`mixed`), while `capabilities` on the same row
  did refresh. Repro: deploy public → redeploy with `signIn: true` → list.
- Knowledge site crawl for a single-page site (`include: ['/']`) reports
  `crawl.status: "completed"` with `pagesIndexed: 0`. Documents ground fine; the site half
  indexed nothing.

---

## 4 — What held up under fire

Worth saying, because all of it was load-bearing for the diagnosis:

- **The elevation audit trail is excellent.** `assistant.session.elevated` with the tool
  name and session id is the single reason we could distinguish "sign-in broken" from
  "sign-in silent" in minutes. It is also, per §1.1, the proof the service already knows
  what to resume.
- **Ticket security behaved exactly as designed**: five spends, zero refusals; a planted
  fake ticket refused server-side with clean fail-open to a fresh session; the parent-domain
  cookie handoff worked every single time including through a login redirect.
- **The dual-emitted `signInTicket`/`continuation` SSE detail** meant our
  pre-rename-compatible listener needed no coordination with your release timing.
- **`noodle assistant doctor`'s elevation probe** (`elevation: { ok, issuerRebound: true }`)
  certified the server half independently of our client bugs — which is exactly what a
  doctor is for.

---

## Appendix — reproduction commands

```bash
# The five elevations and zero refusals:
noodle audit events --org noodleseed --app tivmark-assistant --env prod \
  --event-type assistant.session.elevated --limit 10 --json
noodle audit events --org noodleseed --app tivmark-assistant --env prod \
  --event-type assistant.session.elevation_refused --limit 10 --json

# fb-1174 embeds staleness:
noodle assistant embeds list --org noodleseed --app tivmark-assistant --env prod --json
# → surfaceMode "public", capabilities include the five identity-gated tools of the mixed surface

# The reconnect re-fire (browser console, any page with the element):
#   el = document.querySelector('noodle-assistant');
#   el.addEventListener('assistant-ready', () => console.log('fired again'));
#   p = el.parentElement; n = el.nextSibling; p.removeChild(el); p.insertBefore(el, n);
```
