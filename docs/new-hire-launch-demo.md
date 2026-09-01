# New Hire Launch demo

## The 90-second scenario

In the signed-in Tivmark app, ask Mark:

> Onboard Maya Chen as a product designer starting October 5 in London. Give
> her the design equipment package.

If Mark needs a work email or a team choice, answer that one missing detail.
Mark then shows a grounded launch plan built from the selected team and its
live leave policies. Choose **Launch this new hire**, review the platform
confirmation, and confirm once.

The resulting receipt verifies that Tivmark prepared:

- a team invitation and member role;
- inheritance of the team's current leave policies after acceptance;
- one pending equipment-package request;
- a durable new-hire readiness checklist.

Open **People readiness** from the receipt to see the same launch inside the
normal Tivmark members experience. After the invitee accepts, the readiness
status becomes `ACTIVE` and the pending equipment request is reassigned from
the manager to the new employee.

## Platform capabilities demonstrated

1. Trusted ambient team context and delegated user identity.
2. A read-only, policy-grounded planning capability.
3. A typed MCP App plan widget that works in light and dark mode.
4. One explicit confirmation for a consequential multi-artifact action.
5. One atomic, idempotent Tivmark transaction behind the action.
6. A structured success receipt with links back into the product.
7. A follow-up status capability that reads durable business state.
8. A product guide that enforces plan → confirm → launch → verify ordering.

## API contract

- `POST /api/v1/teams/{teamId}/new-hire-launches/plan` reads access, duplicate
  state, and current leave policies without changing data.
- `POST /api/v1/teams/{teamId}/new-hire-launches` creates every readiness
  artifact in one database transaction and is safe to retry.
- `GET /api/v1/teams/{teamId}/new-hire-launches/status?email=…` returns the
  current verified receipt.
- `GET /api/v1/teams/{teamId}/new-hire-launches` powers the in-product people
  readiness view.

All endpoints require a signed-in team owner or admin with `invitations`,
`equipment`, and `time_off.policy` scopes. Session claims improve the
conversation but never authorize the operation; the Tivmark API remains the
authorization boundary.
