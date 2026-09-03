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

## Follow-up: strict response projection

PR #131 merged as `9252502e3d9c3d19d2a788c76bda737ef66641ba`. Its web
deployment succeeded in [run 33775310002](https://github.com/NoodleSeed-com/tivmark/actions/runs/33775310002),
with 100% of traffic on healthy revision `tivmark-web-00097-huq`.

The current browser client completed a fresh conversation, revealing the actual
tool failure: `enterprise_onboarding` returned `output_invalid` (calls
`call_59793` and `call_51425`). The delegated-token exchange and both underlying
API reads returned HTTP 200. This is separate from the repaired deployment
preflight.

The API's `view=assistant` response still included undeclared properties:
workspace timestamps and events, field `optional` flags, research timestamps,
and `research.evidence.report`. Emptying the report string did not remove its
property. The compiled MCP JSON Schema rejects additional properties. A normal
Zod parse appeared to pass because it silently stripped those properties; the
unparsed object sent by the connector did not satisfy the published contract.

The follow-up fix projects assistant responses to the declared shape before
serialization, for both GET and POST. Full website responses retain their
timestamps, activity, optional-field flags, and raw report. Required answers
remain available to Mark through `steps[].missing`; source provenance, reviewed
suggestions, revisions, assignments, and permissions are retained.

Regression tests cover populated research, no research, pending evidence,
unexpected fields, and non-mutation of the website response. The actual loaded
demo response was also projected locally and validated against v32's SDK output
contract, including deep equality with the parsed result to prove there were no
undeclared properties. It retained all five stages and revision 5. No customer
data was written by these checks.

OpenAPI and generated client types now describe both the full website response
and the compact assistant response. No database migration, new Noodle release,
provider change, or authentication change is needed for this API-side repair.

## Verified production journey and activation

PR #132 merged as `7bd20858fde16b5b3441f8bbc46da62e5ee3715d`; all required CI,
including browser end-to-end tests, passed. [Deployment 33778499909](https://github.com/NoodleSeed-com/tivmark/actions/runs/33778499909)
succeeded and moved 100% of traffic to healthy revision `tivmark-web-00099-geh`.

Live verification on the signed-in demo team established:

- Mark read the saved company name, all five stages, and revision 5 successfully.
- The embedded progress widget rendered the team, stage count, saved revision,
  research status, and the link to the full plan.
- A draft save paused at Noodle's runtime confirmation UI. The reviewed command
  contained only `values: {companyName: "Tivmark"}`, `save-step`, revision 5,
  the organization stage, and the exact demo team.
- After confirmation, the backend advanced to revision 6 and the page recorded
  the assistant draft-save event. It still showed zero of five stages reviewed.
- An independent before/after comparison confirmed that every stage's values,
  origins, source references, assignments, and completion state, plus the entire
  saved research record, were unchanged. No new research call or final sign-off
  was performed.
- A fresh operator status check still reported Noodle v32 active, healthy,
  customer-only, with all required configuration present.

These checks satisfy the gate for enabling the existing per-stage Mark entry
points. The follow-up production build sets
`NEXT_PUBLIC_ENTERPRISE_ASSISTANT_ENABLED=true`; no assistant redeployment is
required. The entry-point unit test already verifies that opening Mark passes
the current team/stage and read-first instruction without directly changing a
plan. Verify the visible button once this activation build is live.
