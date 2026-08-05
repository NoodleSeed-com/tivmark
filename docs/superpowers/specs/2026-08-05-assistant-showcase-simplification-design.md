# Assistant Showcase Simplification Design

## Summary

Keep Mark as a polished, complete Noodle Seed people-ops demo while making the
opening of `apps/assistant/src/server.ts` a concise composition overview. Preserve the
employee and manager workflows, guided forms, confirmation gates, widgets,
customer auth, delegated connector auth, ambient context, and embedded
assistant. Remove the redundant greeting tool and conversational
personalization.

## Experience boundary

Mark remains a two-way assistant for signed-in Tivmark users. Employees can
inspect and manage their time-off and equipment requests. Owners and admins can
inspect review queues, approve or decline requests, and mark approved equipment
as fulfilled. All facts and actions are grounded in Tivmark's delegated,
user-scoped API.

The welcome heading, message, composer labels, and suggested prompts remain.
Mark no longer receives an extra display-name claim, is not instructed to
address users by name, and does not expose a greeting-only tool.

## Architecture

Noodle's authoring compiler stages `server.ts` independently, so server-side
local imports are not a supported deployable boundary. The file therefore opens
with the Noodle server composition—branding, instructions, customer OIDC,
embedded assistant, ambient team context, Tivmark connector binding, and named
tool groups—then keeps contracts, connector operations, and capability builders
in clearly labeled, foldable sections below it. React widgets remain separate
supported entry modules.

`my_teams` is the single `contextProvider: true` tool. The embedded host can
preload it and external hosts can call it normally, so team slugs and reviewer
roles remain portable application context.

## Retained interfaces

The retained model-visible tools are:

- `my_teams`
- `time_off_balance`
- `my_time_off`
- `book_time_off`
- `book_time_off_guided`
- `cancel_time_off_request`
- `my_equipment`
- `order_equipment`
- `order_equipment_guided`
- `cancel_equipment_request`
- `team_time_off_queue`
- `team_equipment_queue`
- `review_time_off`
- `review_equipment`
- `fulfill_equipment`

The app-only `review_time_off_app` helper remains for the approval widget.
Existing inputs, outputs, connector operations, confirmation behavior, widget
bindings, and welcome UI remain unchanged. Every retained tool receives a
business-facing title.

## Explicit non-goals

- Do not add pagination, truncation, or compute transforms to silence the
  existing unbounded-list advisory; Tivmark's APIs currently return complete
  lists without cursor semantics.
- Do not remove widgets, guided forms, manager tools, authentication, ambient
  context, or delegated downstream authorization.
- Do not change hosted configuration or deploy as part of this refactor.

## Acceptance

The assistant manifest exposes the exact retained tool surface, omits `greet`,
declares titles, designates `my_teams` as the context provider, preserves every
confirmation gate and widget binding, and omits embedded session claims. The
web session route retains verified identity and preferences but does not send a
personalization claim. Assistant tests, focused web tests and type checking,
Noodle validation/smoke tests, and ChatGPT, Claude, and embedded-assistant
checks must pass.
