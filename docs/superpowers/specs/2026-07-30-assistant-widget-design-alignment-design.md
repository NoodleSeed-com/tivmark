# Assistant Widget Design Alignment

**Date:** 2026-07-30

**Status:** Approved design

## Product boundary

**Funnel boundary:** Mark remains a two-way, authenticated people-operations assistant: users inspect and act on Tivmark time-off and equipment data inside the conversation, while Tivmark's existing API remains the authoritative system of record and enforces every permission.

This project aligns the four current React result widgets with Tivmark's product design language and repairs the time-off balance widget's empty-result defect. It does not change Mark's conversational scope, the assistant shell's behavior, authorization rules, confirmation gates, tool selection, or deployment topology.

## Goals

- Make every current assistant widget visibly belong to the Tivmark product.
- Use the same light and dark semantic palette, typography, geometry, spacing rhythm, and interaction language as the web application.
- Replace unexplained blank or incomplete surfaces with explicit loading, empty, incomplete-data, error, and success states.
- Repair the time-off balance identity contract so the signed-in user's balances render.
- Establish a small reusable foundation that future Tivmark widgets can follow.
- Preserve compact, accessible behavior across embedded, ChatGPT, and other MCP Apps hosts.

## Non-goals

- Redesigning the assistant conversation panel or launcher.
- Changing Mark's tools, funnel, permissions, or confirmation behavior.
- Extracting a repository-wide design-system package.
- Redesigning the web application's existing time-off or equipment workspaces.
- Adding fullscreen, carousel, picture-in-picture, or nested-scroll experiences.
- Addressing unrelated Noodle readiness warnings such as tool titles or list pagination.

## Selected approach

Build a focused Tivmark widget foundation inside `apps/assistant`. The foundation will use small React components and semantic CSS variables that deliberately mirror the canonical web theme in `apps/web/styles/globals.css` and `apps/web/tailwind.config.js`.

This approach is preferred over:

1. A primitives-only Noodle redesign, which would remain portable but would not reproduce Tivmark's square, editorial product language closely enough.
2. A new cross-application design-system package, which would provide a stronger single source of truth but is disproportionate for four compact widgets and would broaden this project into a web-platform refactor.

The explicit user request for close product alignment is the deliberate exception to Noodle's default of styling exclusively through host-native primitives. The widgets will still use public Noodle hooks and host semantics; they will not use private `ns-*`, `nsr-*`, or example-local tokens.

## Visual language

### Semantic themes

The widget foundation mirrors these established product roles:

| Role | Light | Dark |
| --- | --- | --- |
| Canvas | `#f7f5f0` | `#0b1222` |
| Surface | `#ffffff` | `#111c33` |
| Muted surface | `#ece8df` | `#1a2744` |
| Border | `#d8d0c0` | `#3d4f6b` |
| Body text | `#2a2a2a` | `#f7f5f0` |
| Muted text | `#6b6b6b` | `#c4c0b8` |
| Heading | `#1a2744` | `#ffffff` |
| Accent | `#b08d57` | `#c9a96e` |
| Success | `#2f7d57` | `#67b58d` |
| Warning | `#b08d57` | `#c9a96e` |
| Danger | `#b84a4a` | `#e47777` |

The gold accent is reserved for identity, focus, selected emphasis, and primary actions. Statuses retain semantic green, gold, red, or neutral treatments.

### Typography

- Body, labels, data, and controls use Outfit.
- Widget and section headings use Libre Baskerville.
- Only the weights used by the widgets are bundled locally so rendering does not depend on a host font or a remote font request.
- System sans-serif and Georgia remain fallbacks.
- Headings use the web product's regular editorial weight; labels and controls use restrained medium or semibold weights.

### Geometry and elevation

- Widget frames, tiles, rows, badges, and buttons use square corners, matching Tivmark's current application workspaces and shared cards.
- Thin semantic borders provide most separation.
- Shadows are restrained and appear only where the product already uses elevation.
- Pills are not used for ordinary cards, rows, or buttons. Status labels may use compact rectangular badges.

### Spacing and responsive behavior

- Inline widgets use one primary column with compact vertical rhythm.
- At 280 pixels and wider, content remains readable, touch-safe, and free of horizontal overflow.
- Balance tiles render in one column at narrow widths and may use two columns when space permits.
- List rows wrap metadata and move actions beneath content when horizontal space is limited.
- Essential content is never placed in an internally scrolling region.

## Widget foundation

The foundation contains focused, reusable units:

- `WidgetFrame`: theme-aware outer surface with title, subtitle, optional icon, optional summary badge, and content region.
- `WidgetHeader`: Tivmark editorial heading treatment shared by each frame.
- `StatusBadge`: maps request states to accessible semantic tones and human-readable labels.
- `RequestRow`: compact repeated-data row with primary text, metadata, status, and optional actions.
- `BalanceTile`: allowance, remaining/used value, pending amount, and optional progress visualization.
- `WidgetAction`: square Tivmark button treatment with primary, success, danger, quiet, pending, and disabled states.
- `WidgetFeedback`: visible loading, empty, incomplete-data, error, and success messages. Loading and success use `role="status"`; errors and incomplete-data failures use `role="alert"`.

Each unit has one clear purpose and accepts content through typed props. Business-data normalization remains outside presentation components.

## Current widgets

### `TimeOffBalance`

- Inline card only.
- Shows the signed-in user's vacation, sick, personal, and unpaid balances.
- Limited policies show remaining allowance, total allowance, progress, and pending days.
- Unlimited policies show used and pending days without a misleading progress meter.
- Missing policies show an intentional empty state.
- Missing or mismatched signed-in-user data shows an incomplete-data error rather than a blank card.

### `TimeOffRequests`

- Inline list only.
- Continues to support both `my_time_off` and the confirmed `book_time_off` result.
- Shows human-readable leave type, localized date range, duration, optional reason, and status.
- Empty requests show an intentional empty state.

### `EquipmentRequests`

- Inline list only.
- Continues to support both `my_equipment` and the confirmed `order_equipment` result.
- Shows quantity, item, category, optional justification, and status.
- Empty requests show an intentional empty state.

### `ReviewTimeOffQueue`

- Interactive inline list only.
- Shows requester, leave type, dates, optional reason, and approve/decline actions.
- Each row independently reflects pending action state.
- Successful actions remove the resolved row and announce the outcome.
- Failed actions retain the row, restore its actions, and show retryable feedback.
- The caught-up state is explicit and positive.

No current widget requests fullscreen, carousel, or picture-in-picture because each task is compact and benefits from remaining in conversational context.

## Data flow

```text
Verified assistant session
  -> tool input resolves Tivmark team slug
  -> delegated connector calls Tivmark API as the signed-in user
  -> Tivmark API authorizes and returns business data
  -> tool publishes structured widget output
  -> widget normalizer validates and classifies the result
  -> presentation components render an explicit state
```

### Balance defect and repair

The Tivmark balances endpoint returns a map keyed by Tivmark user ID. The assistant session uses that same Tivmark user ID as the verified subject. Noodle's supported runtime identity expression is `${user.subject}`, but `time_off_balance` currently publishes `${user.id}` as `userId`.

The repair is to publish the supported verified subject and use it to select the signed-in user's entry. A boundary test must inspect the compiled manifest and prove the fulfilment output uses `${user.subject}`.

The widget must not rely on a TypeScript cast as validation. A balance-result normalizer will:

1. Classify an absent result as loading.
2. Classify a host-reported tool error as error.
3. Validate `team`, `userId`, the outer balance map, all known leave-type entries, and numeric-or-null balance fields.
4. Classify a missing signed-in-user entry or malformed balance as incomplete data.
5. Classify a valid user entry with no known leave types as empty.
6. Return a typed, display-ready collection for successful rendering.

`remainingHalfDays` and `allowanceHalfDays` are both nullable. Null represents an unlimited policy and must not be coerced to zero.

### Other result normalization

Time-off and equipment request widgets validate that requests are arrays and validate the fields required for each visible row. A malformed top-level result produces incomplete-data feedback. A malformed individual row is omitted only when other valid rows remain; the widget then shows a partial-data note so missing information is never silent.

## Error and interaction behavior

- Loading content uses a visible, non-jarring feedback or skeleton treatment.
- Tool and validation errors use clear user-facing language and do not expose implementation details.
- Empty content explains whether there are no policies, no requests, or no approvals.
- Interactive review actions disable only the affected row.
- Success and failure outcomes are announced through an `aria-live` region.
- Buttons expose visible focus states using the Tivmark gold focus color.
- Disabled and pending states remain readable in both themes.
- Motion respects `prefers-reduced-motion`.

## Grounding and authority

- Team, balance, request, requester, date, and status facts come only from the existing Tivmark connector operations.
- The authenticated Tivmark API remains authoritative for identity, team membership, balances, permissions, and writes.
- Widgets do not fetch data directly or invent business facts.
- `data-llm` remains a compact inspection hint. It is not used as an authorization or business-state channel.

## Tools and widgets

No model-visible tool is added or removed. These existing tool-to-widget mappings remain:

| Tool | Widget |
| --- | --- |
| `time_off_balance` | `TimeOffBalance` |
| `my_time_off` | `TimeOffRequests` |
| `book_time_off` | `TimeOffRequests` |
| `my_equipment` | `EquipmentRequests` |
| `order_equipment` | `EquipmentRequests` |
| `team_time_off_queue` | `ReviewTimeOffQueue` |

`review_time_off_app` remains an app-only helper invoked by explicit Approve or Decline button actions.

## Handoff and external origins

The widgets do not open external destinations. No handoff domain is required. The connector and resource domain lists remain empty because widgets perform no direct network requests and locally bundled fonts add no external origin.

## Testing strategy

### Contract tests

- Compile the real server manifest.
- Assert that `time_off_balance` publishes `userId` from `${user.subject}`.
- Retain the existing tool-surface and connector-wiring coverage.

### Normalizer tests

Use hand-written fixtures and literal expected values for:

- Populated limited balances.
- Unlimited balances.
- Pending balances.
- No configured policies.
- Missing signed-in-user entry.
- Malformed outer result.
- Malformed balance fields.
- Valid and malformed request collections.
- Human-readable status and day/date formatting.

Each test names the production break it catches and exercises the real normalizer.

### Component-render tests

Render the real foundation and widgets with controlled host/tool results. Assert consumer-visible behavior:

- Headings, subtitles, values, labels, and statuses are visible.
- Unlimited balances never display as zero allowance.
- Empty, incomplete, loading, and error messages are distinct.
- Review actions expose pending, success, and retryable error behavior.
- A dark host layout applies the dark Tivmark token values; a light host layout applies the light values.

Tests do not assert private class names or mock-only elements.

### Build and host verification

Run:

- Assistant Vitest suite.
- `./node_modules/.bin/noodle validate --json`.
- `./node_modules/.bin/noodle test --json`.
- `./node_modules/.bin/noodle check --target embedded-assistant --json`.
- `./node_modules/.bin/noodle check --target chatgpt --json`.

Use Noodle Devtools to inspect every widget in light and dark themes at narrow and standard inline widths. Verify the built widgets in both Mark's focused canvas and floating assistant surfaces when the authenticated local application environment is available.

## Acceptance criteria

- No current widget uses the old purple palette, rounded-card language, or Inter typography.
- All four widgets match Tivmark's light and dark semantic themes.
- All four widgets remain usable at 280 pixels without horizontal overflow or nested scrolling.
- The time-off balance widget renders the signed-in user's valid balance data.
- Unlimited balances are represented accurately.
- Missing, malformed, empty, loading, and failed results are visibly distinct.
- Approval actions retain accessible pending, success, and failure feedback.
- New behavior is covered by tests that fail before the implementation is added.
- The assistant test, validation, smoke, and both host checks complete successfully.
- Visual inspection finds no theme mismatch in either assistant surface.

## Future enhancements

- Extracting Tivmark theme values into a shared package if more independent clients need them.
- Adding automated screenshot baselines after the widget preview environment is stable in CI.
- Migrating future interactive widgets to additional public Noodle primitives when those primitives can preserve Tivmark's design language.
