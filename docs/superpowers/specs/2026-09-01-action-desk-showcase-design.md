# Tivmark Action Desk Showcase Design

## Showcase boundary

Tivmark expands from two people-operations workflows into a configurable Action
Desk: a person explains what they need, Tivmark routes it to the right business
service, and Mark can create, track, and help an authorized operator resolve the
resulting request. The first catalog works for software and consumer businesses:
sales consultation, customer support, software access, and a general request.

## Target users and job

- A customer or employee wants one place to ask for help without learning a
  company's org chart or ticket taxonomy.
- An owner or administrator wants a clear queue and enough context to act.
- A Noodle Seed evaluator wants to see the same business operation work through
  a normal web app and through a portable AI surface.

The core job is: “Tell the business what you need and receive either a completed,
confirmed outcome or a context-rich handoff.”

## Product journey

1. A public visitor asks Mark what Tivmark can help with. `action_desk_guide`
   returns a useful, anonymous-safe service menu and examples.
2. A signed-in user asks Mark for help in natural language. Mark calls
   `action_desk_services` to ground routing in that team's live catalog.
3. Mark summarizes the chosen service, subject, detail, and priority.
4. `start_service_request` is confirmation-gated and creates one idempotent,
   delegated Tivmark API write.
5. A receipt displays the durable request id, status, expected response window,
   and next actions. `my_service_requests` retrieves it later.
6. Owners and admins use either the Action Desk web queue or Mark's manager tools
   to move requests through open, in-progress, waiting, resolved, or canceled.
7. Every transition creates an immutable request event so the web page and AI
   timeline are grounded in the same system of record.

## Data and authorization

- `ActionService` is team-scoped and configurable. Defaults are created lazily
  and idempotently for existing and new teams.
- `ServiceRequest` belongs to a team, service, requester, and optional assignee.
- `ServiceRequestEvent` records creation and later status changes.
- Members can read and create their own requests. Owners and admins can read and
  operate the whole team queue and configure the catalog.
- Tivmark's API session, OAuth token, or service credential supplies identity;
  Noodle never becomes the authorization authority.
- `service_requests` and `service_requests.manage` scopes separate request use
  from queue administration.

## Web experience

`/teams/[slug]/action-desk` presents a responsive service catalog, a short
request form, personal request history, and—for owners/admins—a team queue and
catalog controls. It consumes only the versioned `/api/v1` contract.

## AI tools and widgets

- `action_desk_guide` — public, read-only examples and capability card.
- `action_desk_services` — authenticated catalog and routing context.
- `my_service_requests` — authenticated request status and timeline.
- `start_service_request` — authenticated, confirmation-gated creation.
- `team_service_request_queue` — manager-only operational queue.
- `review_service_request` — manager-only, confirmation-gated transition.
- App-only action twins let widgets invoke the same writes without polluting
  model tool selection.

Compact inline cards are used for discovery, receipt, personal status, and queue
review. They remain useful at narrow host widths and never claim success before
the delegated API response returns.

## Failure and recovery

- An ambiguous need is clarified before submission rather than guessed.
- A missing or inactive catalog service fails with a specific recovery message.
- Duplicate retries use an idempotency key and return the first response.
- A member cannot see or mutate another member's request.
- A stale status transition returns a conflict and prompts a queue refresh.
- Connector or API failure produces no success receipt.

## Acceptance

In production, a user can open Tivmark's Action Desk, submit a support, sales,
access, or general request, and see its durable timeline. The same user can ask
Mark to discover services, submit a confirmed request, and retrieve it. An owner
or admin can view and resolve the same request in the web queue or through Mark,
with the result reflected consistently on both surfaces.
