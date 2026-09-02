# Mark MCP surface

Authentication: required (OIDC).

## Tools

| Tool | Description | Behavior | Visibility |
| --- | --- | --- | --- |
| `action_desk_guide` | Show how Tivmark turns a plain-language need into a routed, trackable business request. Use this for public questions about customer support, sales, employee services, or the Action Desk. | read-only; idempotent | model and app |
| `action_desk_services` | List the signed-in team’s live service catalog. Use this to match a natural-language need to a service id before creating a request. The team value must be the exact slug from my\_teams or verified teamSlugs context; never use a display name and never invent a service id. | read-only; idempotent | model and app |
| `book_time_off` | Submit an eligible full-day request. Resolve dates to YYYY-MM-DD and the team to its slug. For generic “time off,” use VACATION. When booking was conditional, call time\_off\_balance with the dates first and call this only when assessment.eligible is true. The user confirms the exact type, dates, and team before this authenticated write. | write; open-world; confirmation required | model and app |
| `book_time_off_guided` | Book time off when the leave type or dates are missing. Opens a short form, then asks the user to confirm. Use book\_time\_off when every detail is known. | write; open-world; confirmation required | model and app |
| `cancel_equipment_app` | Cancel one of the signed-in user's equipment requests by id. | write; open-world | app only |
| `cancel_equipment_request` | Cancel one of the signed-in user's equipment requests by id. The user confirms first. | write; destructive; open-world; confirmation required | model and app |
| `cancel_time_off_app` | Cancel one of the signed-in user's time-off requests by id. | write; open-world | app only |
| `cancel_time_off_request` | Cancel one of the signed-in user's time-off requests by id. The user confirms first. | write; destructive; open-world; confirmation required | model and app |
| `complete_business_onboarding` | Create or configure the signed-in owner’s Tivmark workspace from an existing blueprint. Preserve every blueprint value exactly and call only after the user asks to create it. This authenticated action shows the complete business profile and leave allowances for confirmation. | write; open-world; confirmation required | model and app |
| `design_business_workspace` | Turn the collected business name, size, IANA time zone, first workflow, and starter leave allowances into a Tivmark workspace blueprint. Ask concise questions until every field is known. This is anonymous planning only and does not create an account or change data. | read-only; idempotent | model and app |
| `equipment_guide` | Show a card explaining equipment requests in Tivmark: the six categories and the request lifecycle. Use this when someone asks how equipment or hardware requests work. | read-only; idempotent | model and app |
| `explore_tivmark` | Show an overview card of Tivmark: what it does, its features, and how to open the portal. Use this when someone asks what Tivmark is or what it can do. | read-only; idempotent | model and app |
| `fulfill_equipment` | Mark an approved equipment request as fulfilled by id \(OWNER/ADMIN only\). The user confirms first. | write; open-world; confirmation required | model and app |
| `get_new_hire_status` | Look up the verified readiness receipt for a launched new hire by team and work email. Use to verify the launch after creation or to answer whether the invitation was accepted. | read-only; idempotent | model and app |
| `getting_started_guide` | Show the five-step checklist for setting up a Tivmark workspace. Use this when someone asks how to get started, set up, or onboard their team. | read-only; idempotent | model and app |
| `launch_new_hire` | Atomically create the reviewed new-hire invitation, team role, leave-policy inheritance plan, equipment request, and readiness checklist. OWNER or ADMIN only. Call only after plan\_new\_hire\_launch and preserve every reviewed value exactly; the user must explicitly confirm the complete launch. | write; open-world; confirmation required | model and app |
| `my_equipment` | List the signed-in user's own equipment requests and their status for a team. | read-only; idempotent | model and app |
| `my_service_requests` | List the signed-in user's service requests, current status, and activity for a team. | read-only; idempotent | model and app |
| `my_teams` | List the teams the signed-in user can access, including each exact slug. Call this before any team-scoped tool when a user gives a display name or trusted team context is unavailable; copy the returned slug exactly. | read-only; idempotent | model and app |
| `my_time_off` | List the signed-in user's own time-off requests and their status for a team. | read-only; idempotent | model and app |
| `order_equipment` | Request equipment for the signed-in user. Resolve the team to its slug. The user confirms the exact request. | write; open-world; confirmation required | model and app |
| `order_equipment_guided` | Request equipment when the category, item, or quantity is missing. Opens a short form, then asks the user to confirm. Use order\_equipment when every detail is known. | write; open-world; confirmation required | model and app |
| `plan_new_hire_launch` | Prepare a grounded, read-only launch plan for one new hire in a trusted team. Use after collecting name, work email, title, concrete start date, location, IANA time zone, team role, and equipment package. This verifies manager access and reads the team’s real leave policies; it does not create anything. | read-only; idempotent | model and app |
| `review_equipment` | Approve or decline a pending equipment request by id \(OWNER/ADMIN only\). The user confirms first. | write; open-world; confirmation required | model and app |
| `review_equipment_app` | Approve or decline a pending equipment request by id \(OWNER/ADMIN only\). | write; open-world | app only |
| `review_service_request` | Move a team service request to in progress, waiting on requester, resolved, canceled, or reopen it. OWNER/ADMIN only. The operator confirms the exact status and note. | write; open-world; confirmation required | model and app |
| `review_service_request_app` | Move a team service request to its next status \(OWNER/ADMIN only\). | write; open-world | app only |
| `review_time_off` | Approve or decline a pending time-off request by id \(OWNER/ADMIN only\). The user confirms first. | write; open-world; confirmation required | model and app |
| `review_time_off_app` | Approve or decline a pending time-off request by id \(OWNER/ADMIN only\). | write; open-world | app only |
| `start_service_request` | Create a durable service request for the signed-in user. First call action\_desk\_services, select an exact active service id, collect a short subject and useful detail, then show all fields for confirmation. | write; open-world; confirmation required | model and app |
| `talk_to_sales` | Show the ways to reach Tivmark: book a walkthrough, start a workspace, or contact support. Use this when someone wants to try Tivmark or talk to a person, rather than asking how the product works. | read-only; idempotent | model and app |
| `team_equipment_queue` | List pending equipment requests awaiting review for a team. Only useful to an OWNER or ADMIN. | read-only; idempotent | model and app |
| `team_service_request_queue` | List the team service-request queue. Only useful to an OWNER or ADMIN of that team. | read-only; idempotent | model and app |
| `team_time_off_queue` | List pending time-off requests awaiting review for a team. Only useful to an OWNER or ADMIN. | read-only; idempotent | model and app |
| `time_off_balance` | Show the signed-in user's balances or assess whether specific dates fit the policy, existing requests, and available balance. For generic “time off,” use VACATION. Pass both dates and their year for an assessment; call this before book\_time\_off when the user says “if I can,” “if eligible,” or otherwise makes booking conditional. | read-only; idempotent | model and app |
| `time_off_guide` | Show a card explaining how time off works in Tivmark: the four leave types and how balances are counted. Use this when someone asks how time off, leave, or balances work. | read-only; idempotent | model and app |
| `trust_and_security` | Show a card summarizing Tivmark's security and privacy posture: sign-in, per-team visibility, and what the assistant can and cannot do. Use this when someone asks about security, privacy, or data handling. | read-only; idempotent | model and app |

## Resources

| Resource | Description |
| --- | --- |

## Prompts

| Prompt | Description | Arguments |
| --- | --- | --- |

## Widgets

| Widget | Description | Opening tool |
| --- | --- | --- |
| `action_desk_guide_widget` | Tivmark Action Desk | Open with `action_desk_guide`. |
| `action_desk_services_widget` | Action Desk services | Open with `action_desk_services`. |
| `book_time_off_widget` | Authenticated time-off receipt | Open with `book_time_off`. |
| `complete_business_onboarding_widget` | Workspace ready | Open with `complete_business_onboarding`. |
| `design_business_workspace_widget` | Tivmark workspace blueprint | Open with `design_business_workspace`. |
| `equipment_guide_widget` | Equipment in Tivmark | Open with `equipment_guide`. |
| `explore_tivmark_widget` | What Tivmark does | Open with `explore_tivmark`. |
| `get_new_hire_status_widget` | New-hire readiness | Open with `get_new_hire_status`. |
| `getting_started_guide_widget` | Getting started | Open with `getting_started_guide`. |
| `launch_new_hire_widget` | New hire ready | Open with `launch_new_hire`. |
| `my_equipment_widget` | Your equipment requests | Open with `my_equipment`. |
| `my_service_requests_widget` | Your Action Desk requests | Open with `my_service_requests`. |
| `my_time_off_widget` | Your time-off requests | Open with `my_time_off`. |
| `order_equipment_widget` | Equipment request submitted | Open with `order_equipment`. |
| `plan_new_hire_launch_widget` | New-hire launch plan | Open with `plan_new_hire_launch`. |
| `start_service_request_widget` | Action Desk request created | Open with `start_service_request`. |
| `talk_to_sales_widget` | Talk to Tivmark | Open with `talk_to_sales`. |
| `team_equipment_queue_widget` | Equipment approvals | Open with `team_equipment_queue`. |
| `team_service_request_queue_widget` | Action Desk queue | Open with `team_service_request_queue`. |
| `team_time_off_queue_widget` | Time-off approvals | Open with `team_time_off_queue`. |
| `time_off_balance_widget` | Time-off eligibility and balance | Open with `time_off_balance`. |
| `time_off_guide_widget` | Time off in Tivmark | Open with `time_off_guide`. |
| `trust_and_security_widget` | Security and privacy | Open with `trust_and_security`. |
