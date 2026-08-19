# Security and privacy

## Signing in

Tivmark supports password sign-in and **SAML single sign-on** through your existing
identity provider. Workspaces on SSO can require it for everyone, so access follows your
directory rather than a separate password list.

**SCIM provisioning** keeps user accounts in step with your directory automatically. When
someone leaves, deactivation flows through without anyone remembering to do it by hand.

## Who can see what

Tivmark's permission model is per team, not per company:

- Your own requests and balances are visible to you.
- Team owners and admins see their team's review queues.
- Nobody sees another team's data unless they belong to that team.

Permissions are enforced by the Tivmark API. Any interface — the web app, the API, or an
AI assistant — is subject to the same checks, so a client asking for something it should
not have is refused rather than trusted.

## Audit logs

Tivmark records what happened and who did it: requests raised, approvals and declines,
fulfilment, and administrative changes. Audit logs are readable by workspace
administrators and through the API.

## The assistant and your data

Mark, the Tivmark assistant, acts **as the signed-in person**. It sees exactly what that
person could see through the UI and nothing more. Two properties are worth being explicit
about:

- **Consequential actions require confirmation.** Booking leave, cancelling a request,
  ordering equipment, approving, declining, and fulfilling all show exactly what will
  happen and wait for the person to confirm. The assistant cannot take a write action on
  someone's behalf without that confirmation.
- **Identity is never asserted by the browser.** The signed-in identity is established by
  Tivmark's backend and passed through a verified channel. Page content and anything typed
  into the assistant is treated as untrusted input, never as authorization.

## The assistant on this public website

The assistant on the Tivmark marketing site has **no signed-in user**. It is deliberately
limited to answering questions about how Tivmark works and pointing you at the team. It
has no access to any workspace, any balance, or any person's requests — not because it
declines to use it, but because it is not granted it.

Anything you type into the public assistant is sent to Tivmark's assistant service to
produce a reply. Do not enter passwords, payment details, or other people's personal
information into it.

## Reporting a problem

If you believe you have found a security issue, use the contact details on the Tivmark
site rather than filing it publicly.

## A note on this sample

Tivmark is a fictional sample business created by Noodle Seed. It holds no real personal
data.
