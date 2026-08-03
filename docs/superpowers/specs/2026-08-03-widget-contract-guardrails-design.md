# Widget Contract Guardrails Design

## Goal

Prevent API-to-tool-to-widget data-shape drift from reaching production. Fix
the current time-off creation failure, then make CI fail whenever a current or
future widget-producing tool does not prove that its output satisfies the
widget contract it invokes.

## Current failure

`book_time_off` forwards the raw response from the create endpoint into the
`time-off-requests` widget. The endpoint returns Prisma `Date` values, which
Next.js serializes as ISO datetimes. Read responses use date-only strings. The
widget correctly accepts only date-only values, so it rejects the created row
and reports an incomplete result even though the write succeeded.

The public OpenAPI schema already declares date-only response fields. The
mutation implementation, assistant tool output, and widget consumer therefore
disagree about one logical resource.

## Design

### 1. Canonical API resource serialization

Create one serializer for public time-off request resources. It will:

- format `startDate` and `endDate` as `YYYY-MM-DD`;
- format timestamp fields as ISO datetimes where the public contract includes
  them;
- emit the same requester and reviewer shape for list and mutation responses;
- omit database-only identifiers and other undocumented fields.

The public v1 GET, POST, and PATCH handlers will all return this serializer's
result. Model functions will fetch the relations required by the documented
resource instead of returning raw Prisma records across the API boundary.

This fixes the source contract rather than weakening widget validation.

### 2. Explicit widget-consumed schemas

Define reusable schemas for the payloads consumed by:

- `time-off-balance`;
- `time-off-requests`;
- `equipment-requests`;
- `review-time-off-queue`.

The six current widget-producing tools are:

- `time_off_balance`;
- `my_time_off`;
- `book_time_off`;
- `my_equipment`;
- `order_equipment`;
- `team_time_off_queue`.

Connector schemas remain permissive at the external boundary so harmless extra
API fields do not break calls. Widget-facing tool output schemas become strict
about every field the corresponding widget consumes. They may allow unrelated
extra fields, but they must reject missing fields, wrong scalar types, invalid
dates, and malformed request rows before rendering.

The widget normalizers will use the same field-level contracts for parsing,
while preserving their existing loading, empty, partial, and error states.

### 3. Manifest-driven completeness gate

Add a contract-test registry keyed by tool name. Each registered entry declares:

- the widget component;
- the widget payload contract;
- realistic successful fixtures for the tool's read or mutation path;
- malformed fixtures that must be rejected or surfaced as partial data.

A test will compare the registry with `manifest.widgets`. Set equality is
required. Therefore:

- adding a widget to a tool without adding contract coverage fails CI;
- removing or renaming a widget leaves a stale registry entry and fails CI;
- wiring a tool to the wrong component fails CI.

This prevents new widget-producing tools from silently bypassing the contract
suite.

### 4. Boundary and rendering tests

Tests will cover each boundary independently:

1. API serialization tests prove GET/POST/PATCH resource shapes use date-only
   calendar fields and do not expose raw Prisma dates.
2. Tool schema tests prove every widget-producing tool declares the fields its
   component consumes.
3. Contract fixtures cover both list payloads and mutation payloads, including
   extra upstream fields, nullable fields, and the ISO-datetime regression
   shape.
4. Widget normalizer tests prove canonical fixtures become ready states and
   malformed rows become partial/error states.
5. Component tests prove every canonical ready state renders without an
   incomplete-result alert.

The original production-shaped timestamp payload must fail before the fix and
the canonical serialized payload must pass afterward.

## Error handling

The layers have distinct responsibilities:

- The API returns a stable documented resource.
- Tool output validation blocks an invalid widget payload.
- Widget normalizers remain defensive for host errors, missing content, and
  mixed-validity lists.
- Widgets never claim an operation failed merely because a presentation row is
  malformed; partial valid data remains visible.

## Scope

This change covers every current manifest widget and establishes the gate for
future ones. It does not redesign widget visuals, change authorization, alter
confirmation behavior, or make connector response validation reject harmless
extra API fields.

## Validation

Required local validation:

- assistant unit and component tests;
- web API/model tests for time-off serialization;
- assistant type/manifest validation through `noodle validate --json`;
- assistant smoke validation through `noodle test --json`;
- relevant web type, lint, and OpenAPI checks;
- all applicable GitHub checks before merge.
