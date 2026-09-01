# Public-to-Action Time-Off Demo Design

## Funnel boundary

An anonymous visitor can ask whether they can take a specific day off, learn the
public policy, sign in without losing the request, and complete one confirmed,
authenticated Tivmark action entirely in Mark. Tivmark remains the source of
identity, balances, existing requests, authorization, and the final write.

## Target user and conversational job

The target user is a first-time evaluator on `tivmark.com`. Their job is one
sentence: “Can I take next Friday off? If so, book it.” The explicit UI benefit
is a reviewable eligibility card followed by a durable transaction receipt;
plain prose would hide the balance calculation, confirmation boundary, request
status, and reversible follow-up action.

## Smallest complete experience

1. `time_off_guide` explains the public weekday and approval rules. Mark cites
   `tivmark_help` when a sourced sentence adds useful detail.
2. `time_off_balance` receives the resolved date and vacation type. On an
   anonymous surface, invoking the delegated connector raises Noodle sign-in;
   after elevation the same conversation resumes.
3. The planning result shows the requested duration, overlap result, available
   balance before the request, and projected balance after all pending time.
4. When the result is eligible and the user already asked to book, Mark calls
   `book_time_off`. Noodle presents the exact confirmed write.
5. The resulting `TimeOffReceipt` shows the real request id and pending status,
   projects the remaining balance, and offers an in-card cancel action.
6. The receipt and cancellation publish compact model context and lifecycle
   state so a later “What just happened?” is grounded in the widget action.

## Tools

- `time_off_guide` — public explanation of leave types and request lifecycle.
- `time_off_balance` — authenticated balance read; optional type and date inputs
  turn the same tool into a deterministic eligibility assessment.
- `book_time_off` — confirmed authenticated write, used only after an eligible
  assessment for conditional booking requests.
- `cancel_time_off_app` — app-only reversible action from the receipt card.

No new model-visible tool is added. The existing `my_teams` context provider
resolves the team, while the invocation context resolves relative dates using
the server-authoritative instant and user time zone.

## Widgets and display modes

- `TimeOffBalance` — inline eligibility and balance card.
- `TimeOffReceipt` — inline transaction receipt with at most two visible actions.

Both remain useful inline at narrow widths. Fullscreen and picture-in-picture
are deliberately unused because a one-day request does not need a browsing or
ongoing-live-state surface.

## States and output boundary

Both widgets visibly handle loading, malformed/error, and success. The balance
widget also handles empty policy data and ineligible assessments. Essential
facts—eligibility, reason, dates, request id/status, and projected balance—stay
in model-visible structured output. Presentation, local confirmation state, and
button feedback stay widget-only. Unsupported hosts still receive concise text
and structured results.

## Grounding sources

- Policy explanation: the declared `tivmark_help` knowledge component and
  `time_off_guide` card.
- Identity and team: Tivmark OIDC plus `my_teams` context.
- Balance and overlap: delegated, user-scoped Tivmark API reads.
- Request and cancellation: delegated, user-scoped Tivmark API writes.

## Product-guide decision

Guided. The scenario crosses public knowledge, sign-in elevation, a planning
read, and a consequential write whose ordering matters. Individual tool
descriptions cannot reliably express “assess before conditional booking” across
all hosts, so the server includes a host-neutral product workflow and explicit
boundaries.

## Handoff and exceptions

The flow completes in chat because this is intentionally a two-way showcase;
there is no off-app handoff. Defaulting generic “time off” to vacation is a
deliberate demo convenience, made safe by showing the type in the confirmation
and creating a reversible pending request rather than approved leave.

## Acceptance

From an anonymous `tivmark.com` session, the exact starter prompt can elevate
sign-in, resume on `app.tivmark.com`, show an eligible assessment, require one
confirmation, create a real pending request, render its receipt, cancel it from
the receipt, and leave the model with the correct final state.
