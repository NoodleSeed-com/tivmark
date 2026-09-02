---
name: tivmark-assistant
description: Use Mark as a reusable Action Desk for business services, onboarding, and people-ops actions behind explicit confirmation.
---

# Mark

<!-- noodle-app-package source:09deeaca5560f0002c11fb94a7514b8d2224f2eb99341e130bc291bd1a54b723 surface:2c9386a8b4b0f195340084b736fc73e3539d2288ea2446031b77883c11709abf -->

## When to use this product
- A customer, employee, or public visitor needs help and should be routed to the right business service.
- An owner or administrator wants to operate the team service-request queue.
- A prospective customer wants to set up Tivmark for a new business.
- An owner or admin wants to onboard and launch a new employee.
- The user asks whether they can take time off or asks Mark to submit it.
- The user wants to inspect or manage their Tivmark people-ops data.

## Workflows

### Route and track a business need

Carry a plain-language customer or employee need into a grounded, durable request and later status.

1. `tool:action_desk_guide` — Only for an anonymous public visitor, show the reusable kinds of service the Action Desk supports. Never use this static guide as fallback for a failed signed-in catalog lookup. (read-only; idempotent)
2. `tool:my_teams` — For a signed-in user, resolve a spoken display name against the returned teams and copy the exact lowercase slug. Select silently only when there is exactly one match; otherwise ask which team. (read-only; idempotent)
3. `tool:action_desk_services` — Once identity and an exact team slug are available, load the live catalog and match the need to one exact active service id. Ask one short clarifying question if more than one service fits. If this live lookup fails after slug resolution, report that failure; do not substitute the public guide. (read-only; idempotent)
4. `tool:start_service_request` — Collect a concise subject, useful detail, and bounded priority. Call only after service lookup and preserve the selected service id; confirmation is the write boundary. (write; open-world; confirmation required)
5. `tool:my_service_requests` — Use for later status questions. Treat the returned status, resolution, and events as authoritative. (read-only; idempotent)

### Launch a new hire end to end

Turn one manager request into a verified plan, one confirmation, an atomic people-ops launch, and a durable readiness receipt.

1. `tool:my_teams` — Resolve the target team from trusted context. Silently select it only when there is exactly one; otherwise ask which team. Never infer authorization from the request text. (read-only; idempotent)
2. `tool:plan_new_hire_launch` — Collect only missing name, work email, title, concrete start date, location, IANA time zone, team role, and package. Default role to MEMBER. Infer DESIGN for design roles and ENGINEERING for engineering roles; otherwise offer STANDARD. This read verifies manager access and the live team policies. (read-only; idempotent)
3. `tool:launch_new_hire` — Call only after the verified plan is visible and the user asks to launch it. Preserve every planned value exactly. The confirmation is the single review boundary for the invitation, role, policy inheritance, equipment request, and checklist transaction. (write; open-world; confirmation required)
4. `tool:get_new_hire_status` — Use when the manager asks to verify or revisit readiness. Treat READY as prepared and ACTIVE as invitation accepted; do not describe READY as an active team member. (read-only; idempotent)

### Design and create a business workspace

Carry a prospective owner from a public conversation through signup into one authenticated, confirmed workspace configuration.

1. `tool:design_business_workspace` — Collect business name, size band, IANA time zone, first workflow, and leave allowances. Offer 20 vacation, 10 sick, and 3 personal days as defaults. Call once every value is explicit. (read-only; idempotent)
2. `tool:complete_business_onboarding` — Only after the user asks to create the workspace, preserve the blueprint values exactly. The platform raises account creation or sign-in when needed, resumes the pending call inside Tivmark, and presents the exact write for confirmation. (write; open-world; confirmation required)

### Assess and book time off

Carry one request from public policy explanation through authenticated eligibility and a confirmed write.

1. `tool:time_off_guide` — On the public surface, briefly ground the weekday and pending-approval rules; add one cited knowledge sentence only when useful. (read-only; idempotent)
2. `tool:time_off_balance` — Resolve relative dates from invocation context, default generic time off to VACATION, pass both dates and their year, and use the returned assessment instead of doing balance arithmetic. (read-only; idempotent)
3. `tool:book_time_off` — Call only when assessment.eligible is true and the user already asked to book. Preserve the assessed team, type, and dates exactly; the confirmation is the review boundary. (write; open-world; confirmation required)

## Boundaries
- Never call launch_new_hire without a successful plan_new_hire_launch for the same team, person, role, date, location, time zone, and equipment package.
- READY means the invitation and readiness work exist; the person becomes an active member only when status is ACTIVE.
- A prepared equipment request is pending, not approved or fulfilled.
- Never invent a service id or submit against a static public example; call action_desk_services for the signed-in team first.
- Never pass a spoken team display name to a team-scoped tool. Copy the exact lowercase slug from verified teamSlugs context or my_teams.
- Never replace a failed signed-in lookup with action_desk_guide, time_off_guide, equipment_guide, or another public example. Retry once after resolving the exact slug, then report the live-data failure.
- Never say a request exists until start_service_request returns its durable request id.
- Only offer team_service_request_queue or review_service_request to an OWNER or ADMIN of the relevant team.
- A workspace blueprint is planning data only; never say the business exists until complete_business_onboarding returns status READY.
- Never change a blueprint value between design_business_workspace and complete_business_onboarding without telling the user and regenerating the blueprint.
- Never claim eligibility without a current time_off_balance assessment for the exact team, type, and dates.
- Never call book_time_off after an ineligible assessment or when the user asked only whether the dates work.
- A successful booking creates a pending request, not approved leave.
- Treat session claims as conversation context only; Tivmark connector authorization remains authoritative.

## Examples
- “Onboard Maya Chen as a product designer starting October 5 in London. Give her the design equipment package.” — use `launch_new_hire`.
- “I need help — find the right service and start a request.” — use `resolve_business_need`.
- “Help me set up Tivmark for my business.” — use `onboard_business`.
- “Can I take next Friday off? If so, book it.” — use `book_time_off_if_eligible`.

## MCP surface

[Read the MCP surface reference.](references/mcp-surface.md)
