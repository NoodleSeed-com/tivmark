# Enterprise onboarding implementation contract

## Outcome and boundary

Ship a real, persistent enterprise-readiness journey on `app.tivmark.com`, discoverable from
the existing quick-start onboarding and team navigation. Conventional forms and Mark use the
same versioned API and requirements. Keep the existing workspace-creation flow unchanged.

This is a readiness workspace, not a claim that external SSO, legal, migration, or third-party
integrations have been provisioned. Each external requirement records an explicit customer
attestation and evidence. Launch approves the documented plan; existing Tivmark settings remain
managed through their existing product flows.

## Audit of the previous experience

The existing `/onboarding` experience has three visible phases: design a business blueprint,
authenticate an owner, then confirm and apply configuration. Its blueprint asks for company name,
team size, timezone, product goal, and three leave allowances. Mark's existing tools and delegated
API apply that business-specific configuration. The website shows a persisted completion receipt.
This is a useful fast activation demo, but it does not represent an enterprise implementation with
multiple reviewers, prerequisites, evidence, external work, or delayed research.

Keep that short activation path. Adding friction to every new signup would undermine the product.
The new Enterprise Launch workspace provides an optional, deliberately richer reference journey:
14 stages and 48 required fields, with manual and assisted paths sharing exactly the same rules.

| Concern | Noodle Seed contribution used now | Tivmark application responsibility |
| --- | --- | --- |
| Conversational guidance | Typed tools, source-authored product guide, compact progress widget | Define stages, dependencies, questions, and the meaning of completion |
| Safe actions | Explicit confirmation annotations and identity-based delegated connector | Recheck tenant membership, role, revision, and stage ownership on every write |
| Resume across sessions | Read the authoritative journey through the same tool | Persist stage drafts, assignments, research, and history in PostgreSQL |
| Background website analysis | Confirmed tool starts the existing application API | Cloud Tasks, Google workload auth, scope limits, bounded retries, and review |
| Evidence and approval | Make proposed findings and useful next actions available to the conversation | Keep proposals separate; retain source context; invalidate dependent sign-offs |

This composition is independent of future Noodle Seed development. The capability-asks brief
describes where horizontal support could reduce repeated implementation work across SaaS companies;
it does not claim those proposed platform capabilities already exist.

## Journey and UI

An authenticated team member opens Enterprise launch, creates a plan as an administrator,
and chooses Manual or With Mark. Fourteen meaningful stages cover organization, objectives,
stakeholders, company research, security, privacy, access, integrations, migration, operating
policy, pilot, enablement, approval, and launch. Each stage exposes required fields, owner,
dependencies, review state, and blockers. Automated research is optional; users can enter their own
context and record the limitations in the research caveats field.

The full workspace stays on the website. The assistant shows one compact progress card with a
next-action summary and a website handoff. Plain structured results remain useful without widgets.
Loading, missing journey, denied access, stale revision, research pending/failed/cancelled,
incomplete evidence, and completed readiness states are explicit.

## Authority

- The database, not chat or browser storage, is authoritative.
- Every write is authorized by team membership; administrator-only approval and launch.
- Revisions protect against stale edits. Changing prerequisites invalidates dependent approvals.
- Research and proposed values do not silently change approved data.
- Mark's mutations remain confirmation-gated and each invokes one atomic backend operation.
- A guided product workflow is required because tool order and evidence/approval boundaries matter.
  Extend the existing source guide; do not overwrite separately installed generated product skills.

## Research

Use Google Cloud Vertex AI with the user-requested rolling alias `gemini-flash-latest`, on project
`tivmark-app`. Use Google workload credentials, not OpenAI or AI Studio keys. Retain a configurable
model ID and the provider-reported model version. Google controls alias updates, which can include
preview or experimental releases and change behavior or pricing; do not silently change providers.
Do not send version-specific thinking parameters to the rolling alias. The live Vertex endpoint
accepted this alias but rejected `thinkingLevel`; it may return the alias rather than a concrete
version in its metadata. Record exactly what Google reports, without inventing a resolved version.

Cloud Tasks runs a durable, bounded organization-only job independently of a browser session.
First analyze the supplied public company homepage using Gemini URL context; then extract
schema-validated proposals. Retain successfully retrieved source URLs, model-proposed source
associations, unknowns, model, timestamps, and token usage. Never research individuals or infer sensitive attributes. Prompt injection from
external material cannot select tools, endpoints, permissions, or write actions.

Limit runs per team/day and per journey, input/output sizes, retries, and request duration.
Cancellation prevents late results from applying. No automatic promotion of findings.
Customer data sent to Google is disclosed before each requested research run. Credits are subject
to the billing grant's eligibility; Cloud billing and model availability are verified separately.

### Research finding that changed the implementation

The initial Google Search-grounding design was revised before any production use.
[Google's service-specific terms, section 20(k)](https://cloud.google.com/terms/service-terms)
appear incompatible with extracting shared, durable onboarding records from Search-grounded output.
The default implementation therefore does **not** invoke Google Search grounding or retain its output.
[URL context](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/url-context)
supports analysis of an explicitly supplied public website. This narrower scope is disclosed in
the UI and tool description: it does not discover competitors across the web. URLs and retrieved
page content are handled as Service Data; confidential sources must not be supplied. Company claims
and inferred source associations still require human review. Broader search needs an independently
approved source/provider whose contract permits this persistence and reuse. This is an operational
precaution, not a legal opinion about a customer's negotiated agreement.

## API and assistant surface

Versioned team-scoped API: read/create journey, update/review stages, assign existing members,
start/cancel/review research, and approve launch. Zod/OpenAPI and generated types precede UI.
Use the existing principal, role, scope, idempotency, and rate-limit conventions.

Mark tools: inspect enterprise onboarding, create it, update a stage, start/review/cancel company
research, and approve readiness. Backend performs all business validation. Tools return progress,
next steps, explicit boundaries, and the authenticated workspace URL.

## Measurement

Show observed counts: fields completed manually or with assistance, draft suggestions accepted,
stages complete, blockers, research status, and the journey start timestamp. Never fabricate a speedup
percentage or baseline. Both interfaces must satisfy identical requirements.

## Delivery sequence

1. Implement typed domain contract, dependency/revision rules, persistence, and API tests.
2. Implement bounded Google research adapter and durable worker with mocked failure tests.
3. Build the manual/assisted workspace and navigation/domain entry points.
4. Expose the same journey through Noodle tools and one progress widget.
5. Validate schemas/OpenAPI, lint/types/unit tests/builds, Noodle gates, and browser journeys.
6. Push a task PR, pass required checks, merge by merge-commit auto-merge.
7. Verify additive database deployment and Cloud Run candidate health; deploy the Noodle app to
   `noodleseed/tivmark-assistant/prod`; verify live domain, authorization, research, and UI.
8. Record exact test entry points and any honestly labeled external/manual boundaries.

## Acceptance tests

- Unauthorized and cross-team requests fail; non-admin cannot approve launch.
- Reopening a session preserves progress; parallel tasks remain independent.
- Required fields/dependencies block premature approval; editing invalidates descendants.
- Duplicate research delivery cannot duplicate a result; cancellation wins over late completion.
- Missing sources never become verified facts; unsupported/malformed provider results fail safely.
- Both website and Mark mutations return the same persisted journey and evidence.
- A complete readiness plan can be approved without claiming external systems were configured.
- Production route and assistant return the new version, with live Google research or an exact
  surfaced provider failure, never a simulated success.
