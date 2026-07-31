# Assistant Widget Design Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make all four Mark result widgets match Tivmark's product design language and reliably render the signed-in user's time-off balance.

**Architecture:** Keep Noodle host hooks in thin default-export adapters, normalize unknown tool output into explicit typed view states, and render those states through a small Tivmark-specific React component foundation. Mirror the web application's semantic colors and locally bundle its Outfit and Libre Baskerville fonts so widgets remain consistent in isolated MCP hosts.

**Tech Stack:** TypeScript, React, Vitest, Testing Library, jsdom, Noodle Seed MCP Apps, CSS custom properties, Fontsource.

## Global Constraints

- Do not change Mark's conversational scope, assistant-shell behavior, authorization, confirmation gates, tool selection, or deployment topology.
- Preserve the existing model-visible tool set and tool-to-widget mappings.
- Use only public Noodle hooks; do not depend on private `ns-*`, `nsr-*`, or example-local tokens.
- Keep every widget useful at 280 pixels with no horizontal overflow or nested scrolling.
- Keep connector and resource CSP domain lists empty; fonts must be bundled locally.
- Treat both `allowanceHalfDays` and `remainingHalfDays` as nullable, where null means unlimited.
- Every production behavior change follows red-green-refactor.

---

## File structure

### Create

- `apps/assistant/src/views/widget-data.ts` — validates unknown tool results, formats business values, and returns explicit typed view states.
- `apps/assistant/src/views/widget-ui.tsx` — reusable Tivmark frame, feedback, balance tile, request row, status badge, and action components.
- `apps/assistant/test/widget-data.test.ts` — pure normalizer and formatting behavior.
- `apps/assistant/test/widget-ui.test.tsx` — visible semantics of the reusable widget foundation.
- `apps/assistant/test/time-off-balance.test.tsx` — populated, unlimited, empty, and incomplete balance rendering.
- `apps/assistant/test/request-widgets.test.tsx` — time-off and equipment request rendering and partial-data feedback.
- `apps/assistant/test/review-time-off-queue.test.tsx` — interactive approve/decline pending, success, and failure behavior.

### Modify

- `apps/assistant/package.json` and `apps/assistant/package-lock.json` — add local fonts and DOM test dependencies.
- `apps/assistant/vitest.config.ts` — discover TSX tests and load jest-dom matchers.
- `apps/assistant/test/setup.ts` — install jest-dom matchers and test cleanup.
- `apps/assistant/src/server.ts` — publish `${user.subject}` for the balance widget.
- `apps/assistant/test/server.test.ts` — protect the compiled identity contract.
- `apps/assistant/src/views/widget-style.css` — replace the legacy purple/rounded system with Tivmark themes, typography, responsive rules, and accessible states.
- `apps/assistant/src/views/time-off-balance.tsx` — thin host adapter plus typed balance view.
- `apps/assistant/src/views/time-off-requests.tsx` — thin host adapter plus typed request view.
- `apps/assistant/src/views/equipment-requests.tsx` — thin host adapter plus typed equipment view.
- `apps/assistant/src/views/review-time-off-queue.tsx` — thin host adapter plus testable interactive review view.

---

### Task 1: Repair the balance identity contract and normalize tool data

**Files:**

- Modify: `apps/assistant/src/server.ts`
- Modify: `apps/assistant/test/server.test.ts`
- Create: `apps/assistant/src/views/widget-data.ts`
- Create: `apps/assistant/test/widget-data.test.ts`

**Interfaces:**

- Produces: `type LoadState<T> = { kind: "loading" } | { kind: "error"; message: string } | { kind: "empty"; message: string } | { kind: "partial"; data: T; message: string } | { kind: "ready"; data: T }`
- Produces: `normalizeBalanceResult(input: unknown, status?: ToolResultStatus): BalanceViewState`
- Produces: `normalizeTimeOffRequests(input: unknown, status?: ToolResultStatus): TimeOffRequestsViewState`
- Produces: `normalizeEquipmentRequests(input: unknown, status?: ToolResultStatus): EquipmentRequestsViewState`
- Produces: `formatHalfDays(value: number): string`
- Produces: `formatDateRange(startDate: string, endDate: string): string`
- Consumes later: every widget view uses these states rather than casting `structuredContent`.

- [ ] **Step 1: Add a failing compiled-contract assertion**

Add this behavior to `test/server.test.ts`:

```ts
it('publishes the verified Tivmark subject for balance lookup', async () => {
  const manifest = await app.toManifest();
  const balanceTool = manifest.tools.find(
    (tool: { name: string }) => tool.name === 'time_off_balance'
  ) as {
    fulfilment?: { output?: { userId?: string } };
  };

  expect(balanceTool.fulfilment?.output?.userId).toBe('${user.subject}');
});
```

- [ ] **Step 2: Run the contract test and verify RED**

Run: `npm --prefix apps/assistant test -- test/server.test.ts`

Expected: FAIL because the manifest currently contains `${user.id}`.

- [ ] **Step 3: Make the minimal identity fix**

Change the `time_off_balance` fulfilment output in `src/server.ts`:

```ts
return {
  team: input.team,
  userId: user.subject,
  balances: res.balances,
};
```

- [ ] **Step 4: Run the contract test and verify GREEN**

Run: `npm --prefix apps/assistant test -- test/server.test.ts`

Expected: PASS.

- [ ] **Step 5: Write failing normalizer tests**

Create `test/widget-data.test.ts` with literal fixtures covering:

```ts
import {
  formatHalfDays,
  normalizeBalanceResult,
  normalizeEquipmentRequests,
  normalizeTimeOffRequests,
} from '../src/views/widget-data.js';

const balance = {
  allowanceHalfDays: 40,
  approvedHalfDays: 12,
  pendingHalfDays: 2,
  remainingHalfDays: 28,
};

it('selects the signed-in user balance and preserves unlimited values', () => {
  expect(
    normalizeBalanceResult({
      team: 'acme',
      userId: 'user-1',
      balances: {
        'user-1': {
          VACATION: balance,
          SICK: {
            allowanceHalfDays: null,
            approvedHalfDays: 4,
            pendingHalfDays: 0,
            remainingHalfDays: null,
          },
        },
      },
    })
  ).toEqual({
    kind: 'ready',
    data: {
      team: 'acme',
      balances: [
        {
          type: 'VACATION',
          label: 'Vacation',
          allowanceHalfDays: 40,
          approvedHalfDays: 12,
          pendingHalfDays: 2,
          remainingHalfDays: 28,
        },
        {
          type: 'SICK',
          label: 'Sick',
          allowanceHalfDays: null,
          approvedHalfDays: 4,
          pendingHalfDays: 0,
          remainingHalfDays: null,
        },
      ],
    },
  });
});

it('reports a missing signed-in-user balance as incomplete data', () => {
  expect(
    normalizeBalanceResult({
      team: 'acme',
      userId: 'user-1',
      balances: { 'user-2': { VACATION: balance } },
    })
  ).toEqual({
    kind: 'error',
    message: "We couldn't match these balances to your account.",
  });
});

it('does not coerce malformed nullable fields to zero', () => {
  expect(
    normalizeBalanceResult({
      team: 'acme',
      userId: 'user-1',
      balances: {
        'user-1': {
          VACATION: { ...balance, remainingHalfDays: '28' },
        },
      },
    })
  ).toEqual({
    kind: 'error',
    message: 'The balance result was incomplete.',
  });
});

it('formats half-days without losing halves', () => {
  expect(formatHalfDays(1)).toBe('0.5 days');
  expect(formatHalfDays(2)).toBe('1 day');
  expect(formatHalfDays(5)).toBe('2.5 days');
});
```

Add table-driven cases for loading, host error, no policies, valid/malformed time-off rows, and valid/malformed equipment rows. A malformed row among valid rows must produce `kind: "partial"` and keep the valid data.

- [ ] **Step 6: Run normalizer tests and verify RED**

Run: `npm --prefix apps/assistant test -- test/widget-data.test.ts`

Expected: FAIL because `widget-data.ts` does not exist.

- [ ] **Step 7: Implement the minimal normalizers**

Create `src/views/widget-data.ts`. Use explicit type guards:

```ts
export type ToolResultStatus = {
  readonly pending?: boolean;
  readonly error?: boolean;
};

export type LoadState<T> =
  | { readonly kind: 'loading' }
  | { readonly kind: 'error'; readonly message: string }
  | { readonly kind: 'empty'; readonly message: string }
  | { readonly kind: 'partial'; readonly data: T; readonly message: string }
  | { readonly kind: 'ready'; readonly data: T };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const isNumberOrNull = (value: unknown): value is number | null =>
  value === null || (typeof value === 'number' && Number.isFinite(value));
```

Define `TIME_OFF_TYPES`, `TIME_OFF_LABELS`, `EQUIPMENT_LABELS`, request types, and normalizers in this module. Iterate known leave types in product order. Never mutate the tool result.

- [ ] **Step 8: Run normalizer and server tests and verify GREEN**

Run: `npm --prefix apps/assistant test -- test/widget-data.test.ts test/server.test.ts`

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add apps/assistant/src/server.ts apps/assistant/src/views/widget-data.ts apps/assistant/test/server.test.ts apps/assistant/test/widget-data.test.ts
git commit -m "fix(assistant): normalize widget data and balance identity"
```

---

### Task 2: Build the Tivmark widget foundation and local typography

**Files:**

- Modify: `apps/assistant/package.json`
- Modify: `apps/assistant/package-lock.json`
- Modify: `apps/assistant/vitest.config.ts`
- Create: `apps/assistant/test/setup.ts`
- Create: `apps/assistant/test/widget-ui.test.tsx`
- Create: `apps/assistant/src/views/widget-ui.tsx`
- Modify: `apps/assistant/src/views/widget-style.css`

**Interfaces:**

- Produces: `WidgetFrame`, `WidgetFeedback`, `StatusBadge`, `RequestRow`, `BalanceTile`, `WidgetAction`.
- Consumes: display-ready data from `widget-data.ts`.
- Produces: semantic DOM roles and visible labels used by widget tests.

- [ ] **Step 1: Install the bounded test and font dependencies**

Run:

```bash
npm --prefix apps/assistant install --save-dev @fontsource/outfit @fontsource/libre-baskerville @testing-library/react @testing-library/jest-dom jsdom
```

Expected: `package.json` and `package-lock.json` update without a second lockfile.

- [ ] **Step 2: Configure TSX DOM tests**

Update `vitest.config.ts`:

```ts
export default defineConfig({
  test: {
    include: ['test/**/*.test.{ts,tsx}'],
    setupFiles: ['./test/setup.ts'],
  },
});
```

Create `test/setup.ts`:

```ts
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(cleanup);
```

- [ ] **Step 3: Write the failing foundation render test**

Create `test/widget-ui.test.tsx` with `// @vitest-environment jsdom` and:

```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import {
  BalanceTile,
  StatusBadge,
  WidgetAction,
  WidgetFeedback,
  WidgetFrame,
} from '../src/views/widget-ui.js';

it('renders Tivmark widget semantics through reusable components', () => {
  const onClick = vi.fn();
  render(
    <WidgetFrame
      theme="light"
      title="Your time-off balance"
      subtitle="Team acme · this year"
      icon={<span aria-hidden="true">T</span>}
    >
      <BalanceTile
        label="Vacation"
        value="14 days"
        detail="of 20 days left"
        progress={70}
        pending="1 day pending"
      />
      <StatusBadge status="APPROVED" />
      <WidgetAction tone="success" onClick={onClick}>
        Approve
      </WidgetAction>
    </WidgetFrame>
  );

  expect(screen.getByRole('heading', { name: 'Your time-off balance' })).toBeVisible();
  expect(screen.getByText('14 days')).toBeVisible();
  expect(screen.getByText('Approved')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Approve' }));
  expect(onClick).toHaveBeenCalledOnce();
});

it('gives failures alert semantics and loading status semantics', () => {
  const { rerender } = render(
    <WidgetFeedback kind="loading">Loading your balance…</WidgetFeedback>
  );
  expect(screen.getByRole('status')).toHaveTextContent('Loading your balance…');

  rerender(<WidgetFeedback kind="error">Could not load your balance.</WidgetFeedback>);
  expect(screen.getByRole('alert')).toHaveTextContent('Could not load your balance.');
});
```

- [ ] **Step 4: Run the foundation test and verify RED**

Run: `npm --prefix apps/assistant test -- test/widget-ui.test.tsx`

Expected: FAIL because `widget-ui.tsx` does not exist.

- [ ] **Step 5: Implement the minimal reusable components**

Create typed components in `src/views/widget-ui.tsx`. `WidgetFrame` renders one `<main>` and one `<section>`, applies `dark` only when the host theme is dark, and uses `aria-labelledby`. `StatusBadge` maps raw statuses to title case and semantic classes. `WidgetAction` sets `aria-busy` while pending and preserves native button semantics.

- [ ] **Step 6: Replace the legacy stylesheet**

At the top of `widget-style.css`, import only required local weights:

```css
@import '@fontsource/outfit/400.css';
@import '@fontsource/outfit/500.css';
@import '@fontsource/outfit/600.css';
@import '@fontsource/libre-baskerville/400.css';
```

Define Tivmark light and dark variables from the specification. Remove purple values and all ordinary corner rounding. Include:

```css
:root {
  color-scheme: light;
  --tv-canvas: #f7f5f0;
  --tv-surface: #ffffff;
  --tv-surface-muted: #ece8df;
  --tv-border: #d8d0c0;
  --tv-text: #2a2a2a;
  --tv-muted: #6b6b6b;
  --tv-heading: #1a2744;
  --tv-accent: #b08d57;
  --tv-success: #2f7d57;
  --tv-danger: #b84a4a;
}

.dark {
  color-scheme: dark;
  --tv-canvas: #0b1222;
  --tv-surface: #111c33;
  --tv-surface-muted: #1a2744;
  --tv-border: #3d4f6b;
  --tv-text: #f7f5f0;
  --tv-muted: #c4c0b8;
  --tv-heading: #ffffff;
  --tv-accent: #c9a96e;
  --tv-success: #67b58d;
  --tv-danger: #e47777;
}
```

Use one-column defaults and an `@media (min-width: 440px)` two-column balance grid. Add `overflow-wrap: anywhere`, 44-pixel minimum interactive targets, gold `:focus-visible` outlines, disabled/pending states, and `prefers-reduced-motion`.

- [ ] **Step 7: Run the foundation test and full unit suite**

Run: `npm --prefix apps/assistant test`

Expected: PASS with no warnings.

- [ ] **Step 8: Commit**

```bash
git add apps/assistant/package.json apps/assistant/package-lock.json apps/assistant/vitest.config.ts apps/assistant/test/setup.ts apps/assistant/test/widget-ui.test.tsx apps/assistant/src/views/widget-ui.tsx apps/assistant/src/views/widget-style.css
git commit -m "feat(assistant): add Tivmark widget foundation"
```

---

### Task 3: Migrate and repair the time-off balance widget

**Files:**

- Create: `apps/assistant/test/time-off-balance.test.tsx`
- Modify: `apps/assistant/src/views/time-off-balance.tsx`

**Interfaces:**

- Produces: `TimeOffBalanceView({ theme, state }: { theme: "light" | "dark"; state: BalanceViewState })`.
- Default export remains the Noodle-connected widget and consumes `useLayout()` plus `useToolInfo("time_off_balance")`.

- [ ] **Step 1: Write failing real-view tests**

Create `test/time-off-balance.test.tsx` with `// @vitest-environment jsdom`. Render `TimeOffBalanceView` with literal states and assert:

```tsx
expect(screen.getByRole('heading', { name: 'Your time-off balance' })).toBeVisible();
expect(screen.getByText('14 days')).toBeVisible();
expect(screen.getByText('of 20 days left')).toBeVisible();
expect(screen.getByText('1 day pending')).toBeVisible();
```

For an unlimited Sick policy:

```tsx
expect(screen.getByText('2 days used')).toBeVisible();
expect(screen.getByText('Unlimited allowance')).toBeVisible();
expect(screen.queryByText(/of .* days left/)).not.toBeInTheDocument();
```

Also assert distinct visible messages for loading, empty policies, incomplete data, and host error states.

- [ ] **Step 2: Run the balance view tests and verify RED**

Run: `npm --prefix apps/assistant test -- test/time-off-balance.test.tsx`

Expected: FAIL because `TimeOffBalanceView` is not exported and the legacy view bypasses normalized states.

- [ ] **Step 3: Implement the typed balance view**

Refactor `time-off-balance.tsx` so the default export:

```tsx
export default function TimeOffBalance() {
  const { theme } = useLayout();
  const toolInfo = useToolInfo('time_off_balance');
  const pending = Object.keys(toolInfo).length === 0;
  const state = normalizeBalanceResult(toolInfo.structuredContent, {
    pending,
    error: toolInfo.isError,
  });
  return <TimeOffBalanceView theme={theme} state={state} />;
}
```

`TimeOffBalanceView` maps every state to `WidgetFeedback`. Ready data maps to `BalanceTile`; limited progress is clamped from 0 through 100, while unlimited policies omit progress.

- [ ] **Step 4: Run balance, normalizer, and server tests**

Run:

```bash
npm --prefix apps/assistant test -- test/time-off-balance.test.tsx test/widget-data.test.ts test/server.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/assistant/src/views/time-off-balance.tsx apps/assistant/test/time-off-balance.test.tsx
git commit -m "fix(assistant): render time-off balances reliably"
```

---

### Task 4: Migrate the time-off and equipment request widgets

**Files:**

- Create: `apps/assistant/test/request-widgets.test.tsx`
- Modify: `apps/assistant/src/views/time-off-requests.tsx`
- Modify: `apps/assistant/src/views/equipment-requests.tsx`

**Interfaces:**

- Produces: `TimeOffRequestsView({ theme, state })`.
- Produces: `EquipmentRequestsView({ theme, state })`.
- Default exports remain host adapters using no-argument `useToolInfo()` so each shared view continues to support both read and confirmed-write tools.

- [ ] **Step 1: Write failing request-view tests**

Render real named views with ready states. Assert visible:

- Time off: `Vacation`, `Jul 30, 2026`, `1 day`, reason, and `Pending`.
- Equipment: `2 × MacBook Pro`, `Laptop`, justification, and `Approved`.
- Empty state messages for both widgets.
- A partial state keeps the valid request visible and also shows a partial-data status message.
- Long metadata remains in the DOM without title-only access.

- [ ] **Step 2: Run request-view tests and verify RED**

Run: `npm --prefix apps/assistant test -- test/request-widgets.test.tsx`

Expected: FAIL because the named typed views do not exist.

- [ ] **Step 3: Implement the time-off typed view**

Use `WidgetFrame`, `RequestRow`, `StatusBadge`, and `WidgetFeedback`. Preserve the pending-count header summary. The default adapter normalizes `useToolInfo().structuredContent`.

- [ ] **Step 4: Run request-view tests**

Run: `npm --prefix apps/assistant test -- test/request-widgets.test.tsx`

Expected: equipment assertions still fail; time-off assertions pass.

- [ ] **Step 5: Implement the equipment typed view**

Use the same foundation and preserve the pending-count summary. Format quantity with spaces around `×`, use the category label from the normalizer, and expose justification as normal wrapped text.

- [ ] **Step 6: Run request-view tests and full suite**

Run: `npm --prefix apps/assistant test`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/assistant/src/views/time-off-requests.tsx apps/assistant/src/views/equipment-requests.tsx apps/assistant/test/request-widgets.test.tsx
git commit -m "feat(assistant): align request widgets with Tivmark"
```

---

### Task 5: Migrate the interactive time-off review queue

**Files:**

- Create: `apps/assistant/test/review-time-off-queue.test.tsx`
- Modify: `apps/assistant/src/views/review-time-off-queue.tsx`

**Interfaces:**

- Produces: `ReviewTimeOffQueueView({ theme, state, onDecision })`.
- `onDecision(requestId, decision)` returns `Promise<void>`.
- Default adapter calls `review_time_off_app` through `useCallTool`.

- [ ] **Step 1: Write failing interaction tests**

With `// @vitest-environment jsdom`, render one pending request and a controlled promise:

```tsx
fireEvent.click(screen.getByRole('button', { name: 'Approve' }));
expect(screen.getByRole('button', { name: 'Approving…' })).toBeDisabled();
expect(screen.getByRole('button', { name: 'Decline' })).toBeDisabled();
```

Resolve the promise and assert the row disappears and `role="status"` announces `Approved Ada Lovelace.`.

Reject a second controlled promise and assert the row remains, actions are enabled again, and `role="alert"` says `Couldn't apply the decision. Try again.`

Also assert empty and partial-data states.

- [ ] **Step 2: Run review tests and verify RED**

Run: `npm --prefix apps/assistant test -- test/review-time-off-queue.test.tsx`

Expected: FAIL because the typed interactive view does not exist.

- [ ] **Step 3: Implement the interactive typed view**

Keep `resolved`, `busy`, and feedback state inside `ReviewTimeOffQueueView`. Disable both actions on the affected row while the promise is pending. Remove only the resolved row on success. Do not swallow the user-visible failure.

The default adapter:

```tsx
const review = useCallTool('review_time_off_app');
const onDecision = (id: string, decision: 'APPROVED' | 'DECLINED') =>
  review.callTool({ team, id, decision });
```

- [ ] **Step 4: Run review tests and full suite**

Run: `npm --prefix apps/assistant test`

Expected: PASS with no React act warnings.

- [ ] **Step 5: Commit**

```bash
git add apps/assistant/src/views/review-time-off-queue.tsx apps/assistant/test/review-time-off-queue.test.tsx
git commit -m "feat(assistant): align time-off approval widget"
```

---

### Task 6: Validate host compatibility and visually inspect the result

**Files:**

- Modify only if a verification finding identifies a defect in an in-scope file.

**Interfaces:**

- Consumes all prior tasks.
- Produces verification evidence for tests, compilation, smoke, host readiness, themes, and responsive behavior.

- [ ] **Step 1: Run formatting and diff checks**

Run:

```bash
git diff --check
npm --prefix apps/assistant test
```

Expected: no whitespace errors; all tests pass.

- [ ] **Step 2: Run Noodle validation and smoke**

Run:

```bash
./node_modules/.bin/noodle validate --json
./node_modules/.bin/noodle test --json
```

Working directory: `apps/assistant`

Expected: both JSON envelopes have `ok` equal to `true`.

- [ ] **Step 3: Run both host checks**

Run:

```bash
./node_modules/.bin/noodle check --target embedded-assistant --json
./node_modules/.bin/noodle check --target chatgpt --json
```

Working directory: `apps/assistant`

Expected: both return `ok: true`; no new widget errors.

- [ ] **Step 4: Start Noodle Devtools for visual verification**

First inspect the discovered `devtools` command from `noodle commands --json`, then run the supported project-local command with both themes and narrow/standard devices. Inspect:

- All four widget component designs.
- Light and dark Tivmark token application.
- 280-pixel and standard inline widths.
- No purple, rounded cards, horizontal overflow, or nested scrolling.
- Visible focus, pending, error, empty, partial, and success states.

- [ ] **Step 5: Verify in Mark surfaces when the authenticated local web app is available**

Open `/mark` for the canvas surface and any team workspace for the floating surface. Trigger each widget with representative assistant prompts. Confirm the balance widget renders actual signed-in-user values.

If the authenticated deployment or local credentials are unavailable, record this host-integrated step as not executable and retain Devtools plus compile/check evidence; do not fabricate success.

- [ ] **Step 6: Review the final diff against the specification**

Check every acceptance criterion in `docs/superpowers/specs/2026-07-30-assistant-widget-design-alignment-design.md`. Confirm no unrelated tool, web-shell, authorization, or deployment changes entered the diff.

- [ ] **Step 7: Commit any verification-only repairs**

If verification required in-scope fixes, stage only the complete in-scope file set (unchanged paths are harmless):

```bash
git add apps/assistant/src/server.ts apps/assistant/src/views/widget-data.ts apps/assistant/src/views/widget-ui.tsx apps/assistant/src/views/widget-style.css apps/assistant/src/views/time-off-balance.tsx apps/assistant/src/views/time-off-requests.tsx apps/assistant/src/views/equipment-requests.tsx apps/assistant/src/views/review-time-off-queue.tsx apps/assistant/test apps/assistant/package.json apps/assistant/package-lock.json apps/assistant/vitest.config.ts
git commit -m "fix(assistant): address widget verification findings"
```

Otherwise make no empty commit.
