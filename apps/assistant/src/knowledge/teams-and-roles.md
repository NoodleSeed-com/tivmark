# Teams, roles, and access

## Teams

Everything in Tivmark belongs to a team. A team has a display name and a short URL-safe
**slug** (for example `engineering`). Policies, allowances, request queues, and approvers
are all per team.

A person can belong to several teams at once. When someone asks Tivmark for a balance or a
queue and belongs to more than one team, Tivmark asks which team they mean rather than
picking one.

## Roles

Three roles, assigned per team:

| Role | Can do |
| :-- | :-- |
| `MEMBER` | Raise time-off and equipment requests, see their own requests and balances, cancel their own pending requests |
| `ADMIN` | Everything a member can, plus review the team's queues, approve or decline, and mark equipment fulfilled |
| `OWNER` | Everything an admin can, plus manage the team itself and its members |

Because roles are per team, the same person can be an owner of one team and a member of
another. Tivmark evaluates permissions against the team the request belongs to, not
against a single global role.

## Reviewers

Only owners and admins are reviewers. Tivmark does not offer review actions to a member —
and if one were attempted anyway, the API rejects it. Permission is enforced by the
Tivmark backend, never by the interface asking.

## Enterprise access

- **SAML single sign-on** — sign in through your existing identity provider.
- **SCIM provisioning** — create, update, and deactivate users automatically from your
  directory, so leavers lose access without a manual step.
- **API keys and a REST API** — read and write the same data the UI uses.
- **Webhooks** — subscribe to events in Tivmark from your own systems.

## Agent access

Tivmark exposes its capabilities to AI assistants over the Model Context Protocol, which
means the same permission model applies in conversation as in the UI. An assistant acts
**as the signed-in person**: it can only see and do what that person could see and do, and
consequential actions still require explicit confirmation.

An assistant on a public page — such as this website — has no signed-in user at all. It
can answer questions about how Tivmark works, but it has no access to anyone's balance,
requests, or team data.
