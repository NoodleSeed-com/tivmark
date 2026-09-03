# Noodle client update and production recovery

## Scope

Following engineering's September 3 response, the user approved publishing the
new assistant to `noodleseed/tivmark-assistant/prod`, preserving `customers`
access, and explicitly requested the latest available release rather than the
version mentioned in the report. No credentials, access settings, research
provider settings, or five-stage onboarding behavior were changed.

Both package manifests now follow `latest`. Lockfiles record the versions
actually installed and tested: `@noodleseed/one` **0.158.0** and
`@noodleseed/assistant` **1.35.0**. These match the package versions advertised by
the live service, **r876**, checked immediately before publication. Future
updates still require updating the lockfiles and validating the resolved build;
an existing lockfile is not a live update subscription.

The public CLI replaced the installed plugin's older, unsupported 0.156.0
client for this release. Noodle-owned project guidance was regenerated through
`noodle agents setup --write`; the separate app product skill was not regenerated.
The obsolete `probe-preflight-real.mjs`, which imported a private SDK path and
read the CLI credential file directly, was removed. It remains recoverable in
Git history; use the public deployment flow instead.

## Production assistant

One normal public `noodle deploy` invocation, including its built-in preflight,
succeeded. No preflight retry loop or manual service workaround was used.

- Published: September 3, 2026, `15:38:21Z`.
- Deployment: `tivmark-assistant-8c26b7c2a1497ea2`.
- Version: **32**, replacing active v31.
- Endpoint: <https://noodleseed.cloud.noodleseed.dev/tivmark-assistant/v32/mcp>.
- Access: **customers**, unchanged.
- Follow-up status: active, health `ready`, required configuration present.
- Deployment verification: 40 tools, 26 resources/widgets; widget metadata ready.
- Authentication readiness: delegated exchange and customer OIDC metadata passed.

This proves publication and deployment readiness, not by itself a completed
customer conversation. Live browser testing is a separate release gate.

## Fresh build evidence

The manifest and connector catalog were generated using the SDK's public export
command from the five-stage source at base commit
`59ece6d66379dc2161ef339f2e34fb4cf057d188`, with the dependency upgrade in this PR.
This is a fresh build, not the byte-identical artifact used in engineering's
earlier investigation.

| Export | Bytes | SHA-256 |
| --- | ---: | --- |
| Manifest | 14,964,836 | `ab8a5f55ba1fdb9a9087fb44e765be0d857560015ecc7fa9c1f8e8d372d86efd` |
| Connector catalog | 168,592 | `681fee734c8c78db52e2da231249251aea0ed50e7fd9836b31059c120971f256` |

The exported files are retained separately from source control. These checksums
identify those exports, not an independently downloaded hosted artifact.

## Validation ledger

- SDK validation passed; 112 assistant unit tests passed.
- Embedded-assistant check passed with two existing advisory findings: the
  model-visible surface exceeds the recommended tool budget, and some older
  tools expose lists without explicit schema bounds. Neither is a deployment
  rejection, and neither was broadened in this update.
- Local runtime smoke was blocked by absent local managed credentials and
  variables. Production credentials were not copied into the worktree. This
  check is not reported as passing.
- Web lint, formatting, locales, API-first contract, OpenAPI, production build,
  and TypeScript checks passed. All 163 existing web tests passed; an additional
  enabled-button test verifies that Mark receives the current team/stage and a
  read-first instruction without directly modifying the plan.
- Both web lockfiles were regenerated and checked, including the workspace
  `npm ci --dry-run` check.

## Browser release gate

Initial testing on the previous web client successfully exchanged the signed-in
session and reached the new onboarding connector: Tivmark's delegated-token and
`enterprise-onboarding?view=assistant` endpoints returned HTTP 200. The older
client then stalled without rendering a completed answer. This does not yet
establish the cause or prove the full journey.

Publish the updated browser client through the normal PR/CI/deploy workflow,
then repeat the authenticated read and confirmation-gated draft write. Keep
`NEXT_PUBLIC_ENTERPRISE_ASSISTANT_ENABLED` off until those pass. The Docker build
now accepts that flag for the subsequent promotion; this release does not set
it. The five-stage forms and optional Google Cloud research remain available.
