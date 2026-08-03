# Widget Contract Guardrails Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix time-off mutation rendering and make CI reject any widget-producing tool whose declared output does not satisfy its widget's consumed data contract.

**Architecture:** Public time-off resources are serialized once at the model boundary, so list and mutation paths share date-only calendar fields. The assistant defines reusable Zod contracts for every widget payload and uses them in both tool output schemas and widget normalizers. A manifest-driven registry test requires every widget-producing tool to declare and exercise its contract.

**Tech Stack:** TypeScript, Prisma, Next.js API routes, Zod via `@noodleseed/one`, Vitest, Testing Library, Jest, Noodle CLI.

## Global Constraints

- Work only in `.worktrees/widget-contract-guardrails` on `fix/widget-contract-guardrails`.
- Keep connector schemas permissive about harmless upstream fields.
- Keep widget loading, empty, partial, and error behavior.
- Do not change widget visuals, authorization, confirmation gates, or hosted configuration.
- Use failing tests before every production behavior change.
- Integrate only through a merge-commit pull request with all applicable checks passing.

---

### Task 1: Canonical time-off resource serialization

**Files:**
- Modify: `apps/web/lib/timeOff.ts`
- Modify: `apps/web/models/timeOff.ts`
- Modify: `apps/web/__tests__/lib/timeOff.spec.ts`

**Interfaces:**
- Produces: `serializeTimeOffRequest(request): TimeOffRequestData`, accepting a request whose `startDate`, `endDate`, `createdAt`, and optional `reviewedAt` are `Date` values and whose requester/reviewer relations are loaded.
- Consumes: existing `formatDateOnly()` and `TimeOffRequestData`.

- [ ] **Step 1: Write the failing serialization regression test**

Add a test with a complete Prisma-shaped request fixture:

```ts
expect(
  serializeTimeOffRequest({
    id: 'leave-1',
    type: 'UNPAID',
    status: 'PENDING',
    startDate: new Date('2026-08-07T00:00:00.000Z'),
    endDate: new Date('2026-08-07T00:00:00.000Z'),
    duration: 'FULL_DAY',
    halfDayPeriod: null,
    requestedHalfDays: 2,
    reason: null,
    reviewNote: null,
    reviewedAt: null,
    createdAt: new Date('2026-08-03T18:00:00.000Z'),
    requester: { id: 'user-1', name: 'Ada', email: 'ada@example.com' },
    reviewer: null,
  })
).toEqual({
  id: 'leave-1',
  type: 'UNPAID',
  status: 'PENDING',
  startDate: '2026-08-07',
  endDate: '2026-08-07',
  duration: 'FULL_DAY',
  halfDayPeriod: null,
  requestedHalfDays: 2,
  reason: null,
  reviewNote: null,
  reviewedAt: null,
  createdAt: '2026-08-03T18:00:00.000Z',
  requester: { id: 'user-1', name: 'Ada', email: 'ada@example.com' },
  reviewer: null,
});
```

- [ ] **Step 2: Run the focused Jest test and verify RED**

Run:

```bash
npm run test:web -- --runInBand __tests__/lib/timeOff.spec.ts
```

Expected: FAIL because `serializeTimeOffRequest` is not exported.

- [ ] **Step 3: Implement the serializer and route all model results through it**

In `apps/web/lib/timeOff.ts`, add a structural input type and the pure
serializer. In `apps/web/models/timeOff.ts`:

- define one reusable Prisma `include` for requester/reviewer;
- apply it to create, update, cancel, review, and workspace list queries;
- return `serializeTimeOffRequest(...)` from mutation functions;
- replace the workspace's inline request mapper with
  `requests.map(serializeTimeOffRequest)`.

The public GET, POST, and PATCH handlers already return model results, so they
will all receive the same DTO without route-specific formatting.

- [ ] **Step 4: Run the focused Jest test and verify GREEN**

Run:

```bash
npm run test:web -- --runInBand __tests__/lib/timeOff.spec.ts
```

Expected: 11 tests pass.

- [ ] **Step 5: Run web type checking**

Run:

```bash
npm run check-types:web
```

Expected: exit 0 with no TypeScript errors.

- [ ] **Step 6: Commit the API contract fix**

```bash
git add apps/web/lib/timeOff.ts apps/web/models/timeOff.ts apps/web/__tests__/lib/timeOff.spec.ts
git commit -m "fix(api): serialize time-off resources consistently"
```

---

### Task 2: Reusable widget-consumed schemas

**Files:**
- Create: `apps/assistant/src/views/widget-contracts.ts`
- Modify: `apps/assistant/src/views/widget-data.ts`
- Modify: `apps/assistant/src/server.ts`
- Create: `apps/assistant/test/widget-contracts.test.ts`
- Modify: `apps/assistant/test/widget-data.test.ts`

**Interfaces:**
- Produces: `timeOffRequestSchema`, `equipmentRequestSchema`,
  `timeOffRequestsOutputSchema`, `equipmentRequestsOutputSchema`, and
  `timeOffBalanceOutputSchema`.
- Consumes: connector results at tool boundaries and unknown host
  `structuredContent` at widget boundaries.

- [ ] **Step 1: Write failing contract tests for production-shaped payloads**

Add tests that prove:

```ts
expect(timeOffRequestSchema.safeParse({
  id: 'leave-1',
  type: 'UNPAID',
  status: 'PENDING',
  startDate: '2026-08-07',
  endDate: '2026-08-07',
  requestedHalfDays: 2,
  extraUpstreamField: true,
}).success).toBe(true);

expect(timeOffRequestSchema.safeParse({
  id: 'leave-1',
  type: 'UNPAID',
  status: 'PENDING',
  startDate: '2026-08-07T00:00:00.000Z',
  endDate: '2026-08-07T00:00:00.000Z',
}).success).toBe(false);
```

Add equivalent valid/invalid fixtures for equipment requests and time-off
balances. Extra upstream fields must be allowed; malformed fields consumed by
the widget must be rejected.

- [ ] **Step 2: Run the focused Vitest test and verify RED**

Run:

```bash
npm --prefix apps/assistant test -- --run test/widget-contracts.test.ts
```

Expected: FAIL because `widget-contracts.ts` does not exist.

- [ ] **Step 3: Implement reusable contracts and use them in normalizers**

Create schemas with these required consumed fields:

- time off: `id`, `type`, `status`, valid date-only `startDate`/`endDate`,
  optional non-negative integer `requestedHalfDays`, nullable `reason`, and
  optional requester identity;
- equipment: `id`, non-empty `category`, non-empty `item`, integer quantity
  from 1 through 20, non-empty `status`, nullable justification, and optional
  requester identity;
- balance: nullable finite allowance/remaining values plus non-negative finite
  approved/pending values.

Allow extra properties on resource rows. Update the normalizers to parse rows
through these schemas while preserving their existing output model and
partial-row behavior.

- [ ] **Step 4: Run widget contract and normalization tests and verify GREEN**

Run:

```bash
npm --prefix apps/assistant test -- --run test/widget-contracts.test.ts test/widget-data.test.ts
```

Expected: all focused tests pass.

- [ ] **Step 5: Add the contracts to every widget-producing tool output**

Replace unconstrained widget-consumed output fields in `server.ts`:

```ts
output: timeOffRequestsOutputSchema
```

for `my_time_off` and `team_time_off_queue`, and:

```ts
output: timeOffRequestsOutputSchema.extend({
  status: z.string(),
  request: timeOffRequestSchema,
})
```

for `book_time_off`. Apply the equivalent balance and equipment contracts to
`time_off_balance`, `my_equipment`, and `order_equipment`.

- [ ] **Step 6: Run assistant tests and Noodle validation**

Run:

```bash
npm run test:assistant
npm --prefix apps/assistant run validate -- --json
```

Expected: all assistant tests pass and Noodle returns `{ "ok": true }`.

- [ ] **Step 7: Commit the shared contracts**

```bash
git add apps/assistant/src/views/widget-contracts.ts apps/assistant/src/views/widget-data.ts apps/assistant/src/server.ts apps/assistant/test/widget-contracts.test.ts apps/assistant/test/widget-data.test.ts
git commit -m "fix(assistant): enforce widget payload contracts"
```

---

### Task 3: Manifest-driven completeness and render gate

**Files:**
- Create: `apps/assistant/test/widget-contract-coverage.test.tsx`
- Modify: `apps/assistant/test/server.test.ts`
- Modify: `apps/assistant/test/request-widgets.test.tsx`
- Modify: `apps/assistant/test/time-off-balance.test.tsx`
- Modify: `apps/assistant/test/review-time-off-queue.test.tsx`

**Interfaces:**
- Consumes: `app.toManifest()`, `manifest.widgets`, canonical contract
  fixtures, widget normalizers, and rendered view components.
- Produces: a CI gate whose registry keys exactly equal all manifest widget
  tool names.

- [ ] **Step 1: Write the failing manifest completeness test**

Create a registry keyed by the six current widget tool names:

```ts
const contracts = {
  time_off_balance: 'time-off-balance',
  my_time_off: 'time-off-requests',
  book_time_off: 'time-off-requests',
  my_equipment: 'equipment-requests',
  order_equipment: 'equipment-requests',
  team_time_off_queue: 'review-time-off-queue',
} as const;
```

Assert that sorted `[tool, component]` pairs from `manifest.widgets` exactly
equal the registry. Then assert that every registered tool's JSON output schema
has the required top-level fields and typed array-item fields consumed by its
component.

- [ ] **Step 2: Run the coverage test and verify RED**

Run:

```bash
npm --prefix apps/assistant test -- --run test/widget-contract-coverage.test.tsx
```

Expected: FAIL because current request arrays have unconstrained `{}` item
schemas.

- [ ] **Step 3: Add canonical render checks**

For each component, feed a hand-authored contract fixture through its real
normalizer and render the real view. Assert:

- the expected team and primary resource details are visible;
- no incomplete-result alert is present;
- the time-off mutation fixture renders `Unpaid · Aug 7, 2026`;
- the review queue shows its requester and actions.

- [ ] **Step 4: Run the coverage and component tests and verify GREEN**

Run:

```bash
npm --prefix apps/assistant test -- --run test/widget-contract-coverage.test.tsx test/request-widgets.test.tsx test/time-off-balance.test.tsx test/review-time-off-queue.test.tsx
```

Expected: all focused tests pass.

- [ ] **Step 5: Run full local validation**

Run:

```bash
npm run test:assistant
npm run test:web -- --runInBand __tests__/lib/timeOff.spec.ts __tests__/lib/openapi.spec.ts
npm run check-types:web
npm run lint:web
npm --prefix apps/assistant run validate -- --json
npm --prefix apps/assistant run agent:check
git diff --check origin/main...HEAD
```

Expected: every command exits 0; Noodle validate/test return successful JSON.

- [ ] **Step 6: Commit the completeness gate**

```bash
git add apps/assistant/test/widget-contract-coverage.test.tsx apps/assistant/test/server.test.ts apps/assistant/test/request-widgets.test.tsx apps/assistant/test/time-off-balance.test.tsx apps/assistant/test/review-time-off-queue.test.tsx
git commit -m "test(assistant): gate every widget output contract"
```

---

### Task 4: Review, integration, deployment, and cleanup

**Files:**
- Review: all branch changes
- Update only if checks or review find a concrete defect

**Interfaces:**
- Consumes: completed implementation commits and repository GitHub workflows.
- Produces: a merged pull request whose merge commit is present on
  `origin/main`, followed by deployment verification and clean worktree
  removal.

- [ ] **Step 1: Review the complete diff**

Run:

```bash
git diff --stat origin/main...HEAD
git diff --check origin/main...HEAD
git status --short --branch
```

Inspect every changed file for contract gaps, unrelated edits, secrets, and
generated artifacts.

- [ ] **Step 2: Push and open the pull request**

```bash
git push -u origin fix/widget-contract-guardrails
gh pr create --base main --head fix/widget-contract-guardrails \
  --title "Fix widget response contracts and add CI guardrails" \
  --body "## Summary
- serialize time-off mutation and list resources through one date-safe DTO
- enforce consumed payload schemas on every widget-producing tool
- make manifest coverage and production-shaped widget fixtures mandatory in CI

## Validation
- assistant unit and component tests
- web time-off and OpenAPI tests
- web type and lint checks
- Noodle validation and smoke tests"
```

- [ ] **Step 3: Enable required merge-commit auto-merge**

```bash
gh pr merge --auto --merge "$(gh pr view --json number --jq .number)"
```

- [ ] **Step 4: Wait for checks and repair only concrete failures**

Use `gh pr checks --watch` and `gh pr view --json mergeStateStatus,state`.
If `main` advances, update the branch through the pull request with a merge
commit, rerun relevant local validation, and push.

- [ ] **Step 5: Verify merge and deployment**

After GitHub reports `MERGED`:

```bash
git fetch --prune origin
git merge-base --is-ancestor "$(gh pr view --json mergeCommit --jq .mergeCommit.oid)" origin/main
```

Inspect the deployment workflow triggered by the merge and wait until the
applicable assistant/web deployment jobs finish successfully. Report any
external deployment blocker exactly; do not bypass protected workflows.

- [ ] **Step 6: Clean up only this task worktree and branch**

From the primary checkout, first verify the worktree is clean. Then:

```bash
git worktree remove .worktrees/widget-contract-guardrails
git branch -d fix/widget-contract-guardrails
git fetch --prune origin
```

Expected: the task worktree and local topic branch are gone; unrelated
worktrees and branches are untouched.
