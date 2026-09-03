# Five-stage onboarding

The default team onboarding plan now has five steps and ten required answers:

1. **Company** — name, public domain, and team size. Industry and location are optional.
2. **Goals** — first workflow, success measure, and target date.
3. **Basic setup** — sign-in approach and intended access roles.
4. **Optional research** — opt into public-homepage analysis, add context yourself, or continue without research.
5. **Review & finish** — review the saved summary, name an onboarding owner, and confirm the plan.

This replaces the fourteen-stage readiness checklist in the main experience. It does
not provision identity, approve legal/security requirements, migrate data, or execute
cutover. Completing the optional research step records a human choice to continue;
it does not claim that a provider query ran.

## Existing plans

Persisted version-1 plans are projected into version 2 without a database write on GET.
Their full previous state, including attestations, is retained in `previousSteps`.
Retired-stage data and fields also remain in the stored state. Active steps require
fresh review; old sign-offs never silently approve the new plan. The conversion is
persisted atomically with the next authorized mutation, under the existing revision
check. No schema migration or bulk data deletion is involved.

The API exposes only current fields and current research suggestions. Stale clients
cannot write retired stages or accept retired-field suggestions. Historical step IDs
remain in the enums so old research records remain readable.

## Research and assistant delivery

Google Cloud research keeps its existing consent, identity matching, bounds, source
provenance, stale-result checks, and explicit acceptance. The manual flow needs no model
call. Changing reviewed values reopens the final review, without invalidating unrelated
completed steps.

The existing three Noodle tools and connector contracts are retained. Their product
guide remains necessary to explain read-before-write, optional research, and human
confirmation; its wording now reflects five steps. No additional tool or widget was
introduced. The initial five-stage rollout left the assistant release pending.
The subsequent [September 3 client update](noodle-preflight-recovery-2026-09-03.md)
published assistant v32 successfully after engineering's preflight repair.

Direct Mark entry points on this page are off by default. Enable
`NEXT_PUBLIC_ENTERPRISE_ASSISTANT_ENABLED=true` at web build time only after the matching
Noodle release is published and the live onboarding journey has been verified. The
normal assistant elsewhere in the app is unchanged. All forms and Google research
remain usable while this flag is off.

## Verification

- Domain tests cover five steps, ten required answers, optional research, legacy
  preservation, rejection of retired-stage writes, and dependent-review invalidation.
- Persistence tests cover version conflicts, roles, legacy projections, and invalid
  research acceptance.
- The isolated API integration script exercises authenticated completion, team
  isolation, assignment, idempotency, stale conflicts, and research provenance.
- Browser checks exercise the manual five-step path, skipping research, final summary,
  saved completion, and narrow-screen layout.

The five-stage web implementation does not bypass Noodle's preflight. The original
incident evidence and the separate recovery ledger remain available for reference.
