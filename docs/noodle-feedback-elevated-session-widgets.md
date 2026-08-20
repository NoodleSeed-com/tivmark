# Elevated sessions deliver no widget views — every card vanishes after sign-in

**From:** Tivmark
**Date:** 2026-08-20
**Severity:** P0 for us — it breaks the hero moment of the mixed-surface demo
**Related:** fb-1177 (now shipped — thank you; verified live and the resume is lovely),
fb-1178 (the new `onReady` contract reads exactly right), fb-1188

## One-line summary

A session created by **spending a sign-in ticket** (`createAssistantSession({ ...,
signInTicket })`) never delivers `view_available` for any tool with a `view`, for the
entire life of the session. The identical tools on a **fresh** session (same deployment,
same surface, same browser, minutes apart) render their widgets normally. The model
plainly believes the card is there — it answers "Here are your current time-off balances
for team Noodle." with no numbers — but no view event, no `.noodle-app-card`, no sandbox
iframe ever reaches the transcript.

## Reproduction (deterministic, reproduced 4/4 across two stacks)

Stack A: server v21, `@noodleseed/one` 0.129.2, `@noodleseed/assistant` 1.20.0.
Stack B (today): server **v22** (`deploymentId tivmark-assistant-c32d62e97cce8524`),
`one` 0.131.0, `assistant` 1.21.0. Org `noodleseed`, app `tivmark-assistant`, env
`prod`. Same Chrome profile throughout. Our tests ran ~08:30–09:10 UTC, 2026-08-20.

1. **Control (fresh session).** Load `app.tivmark.com` signed in — the widget mints via
   our session endpoint, no ticket present. Ask "Show me my time off balance."
   → `time_off_balance` runs, and the transcript gets a `section.noodle-app-card`
   wrapping an `iframe[src="https://cloud.noodleseed.dev/v1/assistant/sandbox"]`
   (`sandbox="allow-scripts"`), which sizes itself normally. **Card renders. Every
   time.**
2. **Elevated session.** Start anonymous on `www.tivmark.com` (embed
   `pub_1xtgg5kc470zcficg7iksw7e`), ask "How much vacation do I have left?", take the
   sign-in card, land on `app.tivmark.com` where our session route spends the ticket.
   The v1.21 native resume fires and answers the intercepted question — correct data,
   zero keystrokes, genuinely delightful — **but as bare prose**. Then ask, in the same
   session, "Show me my time off balance."
   → assistant text: *"Here are your current time-off balances for team Noodle."* —
   the card-companion phrasing, with **no balances in the text and no card**: zero
   iframes, zero `.noodle-app-card` nodes in the shadow DOM, and the panel's network
   log shows no sandbox fetch. Every identity-gated widget tool behaves the same, on
   every turn, until the page is reloaded (which mints a fresh session and restores
   widgets — while losing the conversation).

## Why we believe this is service-side

- The host cannot influence view delivery: our session route
  (`apps/web/pages/api/assistant/session.ts`) builds one options object and passes it
  identically on both arms — the only difference is the presence of `signInTicket`. The
  exchange response is forwarded to the browser unchanged.
- The same renderer bundle in the same tab renders cards for fresh sessions and none
  for elevated ones, so it is not a client CSS/version issue.
- Your r601 letter noted elevation is "the only chance a routed connector's session
  gets its backend-verified routes" — the issuer rebind clearly works (delegated calls
  succeed; the data in the prose is correct). It looks like the widget/view resources
  (`ui://` templates, or whatever gates `view_available` emission) are **not** attached
  during the elevation exchange the way they are during a fresh mint.

## Ask

1. Bind view/widget resources during the sign-in-ticket exchange exactly as a fresh
   mint does, so `view_available` fires for tools with views on elevated sessions —
   including the native-resume first turn, which is precisely the moment the demo
   audience is watching.
2. A regression test on your side: elevated session → call a tool with a `view` →
   assert `view_available` (and the sandbox document request) reaches the client.

## Two smaller asks, batched

- **Citation cards for knowledge.** `search_<knowledge>` output (`hits[]` with title,
  excerpt, `uri`) is begging for a native source-card rendering; today knowledge
  answers are the only high-traffic path that cannot be carded at all, since the
  generated tool accepts no `view`.
- **Per-turn suggestion chips.** `suggestedPrompts` are welcome-screen-only
  (`:host([has-messages])` hides them forever after the first message). A per-turn
  follow-up chip surface — even just an assistant-authored array on a turn — would
  replace the in-widget workaround everyone will otherwise build.

## Question

`noodle intents status --org noodleseed --app tivmark-assistant` (CLI 0.131.0) returns
`auth_failed: "intent capture preview is unavailable"` while every other command
authenticates fine. Is the preview org-gated, and if so may we have it? We'd love to
show intent analytics in this demo.
