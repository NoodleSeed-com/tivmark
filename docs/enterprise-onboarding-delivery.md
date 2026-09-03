# Enterprise onboarding delivery and verification

## Release status

Implemented in the isolated `codex/enterprise-onboarding` task branch. **Not deployed or ready for
production testing yet.** Production target/configuration confirmation and live checks remain required.
Do not merge this release before provisioning the approved Google queue and IAM: the deploy workflow
intentionally fails before schema changes if the research queue is unavailable.

The implementation does not depend on new Noodle Seed capabilities. It composes today's typed,
confirmed, delegated tools with application-owned state and a Google Cloud research adapter.
The [scenario-led Noodle Seed asks](noodle-seed-research-assisted-onboarding-capability-asks.md)
remain feedback about reusable platform outcomes, not prerequisites for this application.
The [design and audit](superpowers/specs/2026-09-02-enterprise-onboarding-design.md) records the boundary.

## What is implemented

- Optional Enterprise Launch entry from the marketing site, quick-start receipt, and team navigation.
- Fourteen stages and 48 required fields covering context, stakeholders, security, privacy, access,
  integrations, migration, operations, pilot, enablement, and final handoff.
- Shared manual/Mark API, team membership and ownership checks, optimistic concurrency,
  idempotent HTTP writes, prerequisite validation, and dependent approval invalidation.
- Three Noodle tools: inspect the plan, make one confirmed change, and request consented research.
- Persistent background research with explicit opt-in, at most three runs/team/24 hours,
  three attempts/run, two bounded Gemini calls/attempt, cancellation and late-result protection.
- Public-homepage analysis, structured proposals, unknowns, model/usage data, source links, human
  acceptance, and source context retained with accepted fields after later research runs.

Research uses `gemini-3.8-flash` through the Google Cloud project, not an OpenAI or AI Studio key.
The existing Mark conversation model is unchanged. Cloud credits apply only if the customer's grant
covers the selected service/SKU. Billing enabled is not proof of credit eligibility or model access.
No live Google generation was executed during local validation.

The default is **URL context, not Google Search grounding**. The latter's evidence-reuse terms need
separate approval for a durable shared onboarding database. Competitors not named by the supplied
site stay unknown; research does not discover private customer lists or investigate individuals.

## Local evidence

Validated on 2026-09-02:

- Web: 153 unit tests; lint, formatting, locale, TypeScript, OpenAPI freshness/lint and API-first checks.
- Web production build passed. Existing SDK/Sentry build warnings remain.
- Both web lockfiles validated using `scripts/sync-web-lockfile.sh --check` and `npm ci --dry-run`.
- Noodle: schema/compile validation, app-readiness check, and 112 unit/render tests passed.
  Existing broad tool-count and unrelated unbounded-output warnings remain.
- Marketing Docker image built and nginx configuration validated.
- Disposable local PostgreSQL API test passed: unauthenticated and cross-team denial, role/owner
  enforcement, rollback on rejected updates, all 14 stages, duplicate/replayed writes, stale revisions,
  dependency invalidation, explicit research acceptance, and durable source attribution.
- Browser: manual/assisted mode switch, saved drafts, unsaved-change protection, research disclosure,
  accepted synthetic proposal, source links, actual attribution counts, invalidated sign-offs,
  and return to the saved enterprise plan after signing out and back in.
- Deployment workflow YAML and `actionlint` passed.

The database integration script is `apps/web/scripts/test-enterprise-onboarding.ts`. It refuses any
database except `enterprise_onboarding` on localhost port 55432, and only resets its named synthetic
fixture journey. Run against a locally built web server on port 4002. Its research results are visibly
labeled synthetic; these tests do not prove a live provider call.

## First unproven layers

Noodle local smoke and Devtools cannot start without the existing local `ASSISTANT_MODEL_API_KEY`
and `TIVMARK_DELEG_CLIENT_SECRET`. Hosted secret values were not exported to work around this.
The initial Devtools discovery timeout was separately checked: the live RFC 8414 metadata URL
returned valid JSON. A subsequent preview attempt reached the missing-local-credentials boundary.
Offline validation and render tests are not a substitute for the signed-in embedded host test.

Google queue/IAM, live model access, production schema/revision, domain entry, and Mark's complete
authenticated research journey have not been verified. No live deployment success is claimed.

## Approved-target rollout checklist

Proposed targets requiring confirmation: Google Cloud project `tivmark-app`, Cloud Run `tivmark-web`
in `us-central1` serving `app.tivmark.com`; Noodle Seed `noodleseed/tivmark-assistant/prod`.

1. Enable Vertex AI and Cloud Tasks APIs in the approved project. Do not change global gcloud defaults.
2. Create the dedicated `onboarding-research` OIDC service account and queue in `us-central1`.
   Queue bounds: at most two concurrent tasks, one dispatch/second, eight deliveries, 30-second minimum
   retry backoff. The application limits provider attempts to three and worker requests to 180 seconds.
3. Give the Cloud Run workload only prediction permission, enqueue permission on this queue, and
   permission to act as this dedicated task identity. Verify the Cloud Tasks service agent can issue
   its OIDC token. Do not create downloadable service-account keys or broaden existing roles.
4. Verify a bounded live `gemini-3.8-flash` URL-context request on public non-sensitive test data.
   Confirm the model's successful retrieval metadata shape and Google project billing attribution.
5. Pass every applicable PR check, update through the PR if main has advanced, and enable merge-commit
   auto-merge. Verify the PR is merged and its merge commit is reachable from `origin/main`.
6. Confirm `deploy-web.yml` ran on the merged SHA. It applies the additive schema, builds the web
   image, probes a no-traffic candidate, and then routes traffic. Verify the marketing deployment too.
7. Deploy the Noodle app to the confirmed target using the supported public deployment flow. Preserve
   customer-authenticated access and existing credentials. The web OAuth allowlist reserves v32 after
   the inspected v31 deployment; recheck the actual next version if another deployment occurred.
8. Test the real domain as a signed-in owner: create a test plan, start one public-company run, wait
   for completion, inspect sources, accept one proposal, and confirm no stage was silently completed.
   Verify a non-admin cannot approve launch or inspect another tenant's plan.
9. In Mark, inspect the same revision, perform one confirmed safe draft change, refresh the website,
   and verify both surfaces show the same saved result. Check pending, failure and text fallback.
10. Record the deployed revisions, exact test entry point, and result. Only then declare ready to test.

## Demonstration script

Start at `/enterprise-onboarding`. First show Manual mode: the real requirements, different owners,
and blocked stages. Switch to With Mark and ask it to inspect the current plan and help with missing
context. With explicit consent, request public-company analysis; continue another stage while it runs.
Review the evidence and unknowns, accept selected draft values, then return to the plan. Show that
research saved typing but did not invent approval. Complete a stage with actual reviewed evidence;
reopen a prerequisite to demonstrate that dependent sign-offs must be reviewed again.

Use the actual manual/assisted field counts. Do not claim a percentage speedup without a separate,
controlled timing study using equivalent customers, requirements, and completion criteria.
