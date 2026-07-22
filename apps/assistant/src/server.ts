import {
  annotations,
  connector,
  customerAuth,
  embeddedAssistant,
  openAICompatible,
  secret,
  server,
  tool,
  variable,
  z,
} from '@noodleseed/one';

// Tivmark Assistant — the people-ops MCP app for the Tivmark portal.
//
// Every tool runs AS the signed-in Tivmark user. The connector below reaches Tivmark's public v1 API
// with `delegatedTokenExchange` (RFC 8693): the Noodle broker exchanges a signed, JWKS-verifiable
// assertion of the user for a short-lived user-scoped Tivmark token at our tokenUrl. So each call is a
// *user* principal and Tivmark's API enforces its own per-user / per-team authorization and filtering
// — no service key, no forwarded (spoofable) ids. `team` is a per-call path param (the team slug), so
// any team the user belongs to works.

const leaveType = z.enum(['VACATION', 'SICK', 'PERSONAL', 'UNPAID']);
const equipmentCategory = z.enum([
  'LAPTOP',
  'MONITOR',
  'PHONE',
  'PERIPHERAL',
  'FURNITURE',
  'OTHER',
]);
const decision = z.enum(['APPROVED', 'DECLINED']);

// Connector output validation is strict, and real Tivmark objects (teams, requests, balances) carry
// more fields than we render, so bind whole objects/arrays as `z.unknown()` and let tools/widgets read
// the fields they need.
const tivmark = connector('tivmark')
  .version('1.0.0')
  .http({
    baseUrl: 'https://app.tivmark.com/api/v1',
    allowedOrigins: ['https://app.tivmark.com'],
    auth: {
      kind: 'delegatedTokenExchange',
      tokenUrl: 'https://app.tivmark.com/api/assistant/oauth/token',
      clientId: variable('TIVMARK_DELEG_CLIENT_ID'),
      clientSecret: secret('TIVMARK_DELEG_CLIENT_SECRET'),
      // `teams` to list the user's teams; `time_off*`/`equipment*` for the people-ops endpoints.
      scopes: [
        'teams',
        'time_off',
        'time_off.approve',
        'equipment',
        'equipment.approve',
      ],
      // audience omitted → the assertion is bound to tokenUrl (strongest replay protection).
      authMethod: 'client_secret_basic',
    },
    operations: {
      // --- teams ---
      list_teams: {
        type: 'read',
        method: 'GET',
        path: '/teams',
        input: z.object({}),
        output: z.object({ teams: z.array(z.unknown()) }),
        response: { teams: '${response.data}' },
      },
      // --- time off ---
      get_balances: {
        type: 'read',
        method: 'GET',
        path: '/teams/{team}/time-off/balances',
        query: ['year'],
        input: z.object({ team: z.string(), year: z.number().optional() }),
        output: z.object({ balances: z.record(z.record(z.unknown())) }),
        response: { balances: '${response.data}' },
      },
      list_time_off: {
        type: 'read',
        method: 'GET',
        path: '/teams/{team}/time-off/requests',
        query: ['requesterId', 'status', 'year'],
        input: z.object({
          team: z.string(),
          requesterId: z.string().optional(),
          status: z.string().optional(),
          year: z.number().optional(),
        }),
        output: z.object({ requests: z.array(z.unknown()) }),
        response: { requests: '${response.data}' },
      },
      create_time_off: {
        type: 'action',
        method: 'POST',
        path: '/teams/{team}/time-off/requests',
        input: z.object({
          team: z.string(),
          type: leaveType,
          startDate: z.string(),
          endDate: z.string(),
          reason: z.string(),
        }),
        // No requesterId — the user principal (delegated token) supplies the actor. Full-day only.
        request: {
          type: '${args.type}',
          startDate: '${args.startDate}',
          endDate: '${args.endDate}',
          duration: 'FULL_DAY',
          reason: '${args.reason}',
        },
        output: z.object({ request: z.unknown() }),
        response: { request: '${response.data}' },
      },
      cancel_time_off: {
        type: 'action',
        method: 'PATCH',
        path: '/teams/{team}/time-off/requests/{id}',
        input: z.object({ team: z.string(), id: z.string() }),
        request: { action: 'cancel' },
        output: z.object({ request: z.unknown() }),
        response: { request: '${response.data}' },
      },
      review_time_off: {
        type: 'action',
        method: 'PATCH',
        path: '/teams/{team}/time-off/requests/{id}',
        input: z.object({
          team: z.string(),
          id: z.string(),
          decision,
          reviewNote: z.string(),
        }),
        // Reviewer authority (OWNER/ADMIN) is enforced by Tivmark against the user principal.
        request: {
          action: 'review',
          decision: '${args.decision}',
          reviewNote: '${args.reviewNote}',
        },
        output: z.object({ request: z.unknown() }),
        response: { request: '${response.data}' },
      },
      // --- equipment ---
      list_equipment: {
        type: 'read',
        method: 'GET',
        path: '/teams/{team}/equipment/requests',
        query: ['requesterId', 'status', 'category'],
        input: z.object({
          team: z.string(),
          requesterId: z.string().optional(),
          status: z.string().optional(),
          category: z.string().optional(),
        }),
        output: z.object({ requests: z.array(z.unknown()) }),
        response: { requests: '${response.data}' },
      },
      create_equipment: {
        type: 'action',
        method: 'POST',
        path: '/teams/{team}/equipment/requests',
        input: z.object({
          team: z.string(),
          category: equipmentCategory,
          item: z.string(),
          quantity: z.number(),
          justification: z.string(),
        }),
        request: {
          category: '${args.category}',
          item: '${args.item}',
          quantity: '${args.quantity}',
          justification: '${args.justification}',
        },
        output: z.object({ request: z.unknown() }),
        response: { request: '${response.data}' },
      },
      cancel_equipment: {
        type: 'action',
        method: 'PATCH',
        path: '/teams/{team}/equipment/requests/{id}',
        input: z.object({ team: z.string(), id: z.string() }),
        request: { action: 'cancel' },
        output: z.object({ request: z.unknown() }),
        response: { request: '${response.data}' },
      },
      review_equipment: {
        type: 'action',
        method: 'PATCH',
        path: '/teams/{team}/equipment/requests/{id}',
        input: z.object({
          team: z.string(),
          id: z.string(),
          decision,
          reviewNote: z.string(),
        }),
        request: {
          action: 'review',
          decision: '${args.decision}',
          reviewNote: '${args.reviewNote}',
        },
        output: z.object({ request: z.unknown() }),
        response: { request: '${response.data}' },
      },
      fulfill_equipment: {
        type: 'action',
        method: 'PATCH',
        path: '/teams/{team}/equipment/requests/{id}',
        input: z.object({ team: z.string(), id: z.string() }),
        request: { action: 'fulfill' },
        output: z.object({ request: z.unknown() }),
        response: { request: '${response.data}' },
      },
    },
  });

const readOnly = annotations.readOnly();
const confirmed = annotations.action({ confirm: true });
const confirmedDestructive = annotations.action({ confirm: true, destructive: true });

// The widgets are self-contained: they render from tool output and call tools through the host bridge,
// never fetching external origins. Declare that explicitly so widget CSP is minimal and reviewable.
const widgetCsp = { connectDomains: [], resourceDomains: [] };
// One https origin per app — ChatGPT's app builder keys the widget identity to this domain.
const widgetDomain = 'https://app.tivmark.com';

export default server(
  'tivmark_assistant',
  {
    title: 'Tivmark Assistant',
    version: '1.0.0',
    // Host-compat for confirm-gated writes. Hosts like ChatGPT can't carry Noodle's standard
    // confirmation form (elicitation/create), so by default a `confirm: true` write fails closed.
    // `confirmationFallback: 'host'` explicitly trusts the host's own native write-approval UX and
    // executes the confirmed action directly there — Tivmark still enforces all authorization on the
    // delegated per-user token. In the portal embed (which carries the form) the normal confirmation
    // still renders.
    interactions: { confirmationFallback: 'host' },
    instructions:
      'You are the Tivmark people-ops assistant. Help the signed-in user with two things: TIME OFF ' +
      '(check balances, review their requests, book new time off, cancel a request) and EQUIPMENT ' +
      '(review their requests, request an item, cancel a request). ' +
      'Each turn includes the current date and the user’s local time zone — use them to resolve ' +
      'relative dates ("today", "tomorrow", "next Thursday", "this Friday") into concrete YYYY-MM-DD ' +
      'dates yourself; never claim you don’t know the date. ' +
      'Everything is per team. The user’s teams (with their role on each) are provided as ambient ' +
      'context (context.ambient.teams) every turn — use them to resolve the team: if there is exactly ' +
      'one, use it silently; if several, ask which. Only call my_teams if the ambient teams are ' +
      'unavailable. Never invent a team. Always pass the resolved team’s "slug" (NOT its display name) ' +
      'as the `team` argument. ' +
      'To book time off, call book_time_off when you know the leave type and both dates (it asks the ' +
      'user to confirm); if the type or dates are missing and you cannot resolve them, call ' +
      'book_time_off_guided, which collects them in a short form and then confirms. To request ' +
      'equipment, call order_equipment when you know the category, item, and quantity; otherwise call ' +
      'order_equipment_guided. ' +
      'APPROVALS: only offer review_time_off, review_equipment, fulfill_equipment, and the team ' +
      'queues to a user who is OWNER or ADMIN of the relevant team (check their role in the ambient ' +
      'teams). If they are not a reviewer, do not offer these; Tivmark will reject the action anyway. ' +
      'Address the user by name.',
    branding: {
      name: 'Tivmark',
      accent: '#7C3AED',
      radius: 'lg',
      density: 'comfortable',
    },
    // Per-turn grounding. The runtime injects the current date/time automatically; `defaults` set the
    // locale/time zone used when the session carries no backend `preferences` (the portal sources those
    // from the browser). `ambient` injects the user's teams (with roles) into every turn as trusted
    // context so the model resolves the team — and whether the user may review — without a lookup. The
    // provider runs the read-only `list_teams` op under the same delegated per-user token, so it only
    // ever sees that user's teams.
    context: {
      defaults: { locale: 'en-US', timeZone: 'UTC' },
      ambient: {
        output: z.object({
          teams: z.array(z.unknown()),
          asOf: z.string(),
        }),
        fulfil: ({ context, connectors }) => {
          const res = connectors.tiv.list_teams({});
          return { teams: res.teams, asOf: context.temporal.instant };
        },
      },
    },
    // 'customers' access with Tivmark's own OAuth server as the identity provider. Generic MCP clients
    // (ChatGPT/Claude) discover it via protected-resource-metadata, sign the user in at app.tivmark.com,
    // and present the resulting token; Noodle (as resource server) verifies it against Tivmark's JWKS.
    // The portal embed works via createAssistantSession (session exchange is independent of this auth
    // kind). Both inbound paths normalize to the same verified customer identity, so the
    // delegatedTokenExchange connector calls the API as that user.
    auth: customerAuth.oidc({
      issuer: 'https://app.tivmark.com/oauth',
      audience: 'tivmark-api',
    }),
    assistant: embeddedAssistant({
      model: openAICompatible({
        baseUrl: variable('ASSISTANT_MODEL_BASE_URL'),
        model: variable('ASSISTANT_MODEL'),
        apiKey: secret('ASSISTANT_MODEL_API_KEY'),
      }),
      allowedOrigins: ['http://localhost:4002', 'https://app.tivmark.com'],
      layout: { mode: 'floating', position: 'bottom-right' },
      labels: {
        welcomeHeading: 'Tivmark Assistant',
        welcomeMessage: 'Ask me about your time off or equipment.',
      },
      // The signed-in name is exposed to the model so it can greet and personalize. Role is per-team,
      // so it flows through the ambient teams rather than a flat session claim.
      sessionClaims: {
        displayName: { exposeToModel: true },
      },
    }),
    use: { tiv: tivmark },
  },
  [
    // ------------------------------------------------------------------ identity / teams
    tool('greet', {
      description: 'Greet the currently signed-in user by name.',
      annotations: readOnly,
      input: z.object({}),
      output: z.object({ message: z.string() }),
      fulfil: ({ user }) => ({ message: `Hello, ${user.name}!` }),
    }),
    tool('my_teams', {
      description:
        'List the teams the signed-in user belongs to, with their role on each. Use this to resolve ' +
        'which team an action applies to when the ambient teams are unavailable.',
      annotations: readOnly,
      input: z.object({}),
      output: z.object({ teams: z.array(z.unknown()) }),
      fulfil: ({ connectors }) => {
        const res = connectors.tiv.list_teams({});
        return { teams: res.teams };
      },
    }),

    // ------------------------------------------------------------------ time off (employee)
    tool('time_off_balance', {
      description:
        "Show the signed-in user's time-off balances (vacation, sick, personal, unpaid) for a team.",
      annotations: readOnly,
      input: z.object({ team: z.string() }),
      output: z.object({
        team: z.string(),
        userId: z.string(),
        balances: z.record(z.record(z.unknown())),
      }),
      fulfil: ({ input, user, connectors }) => {
        const res = connectors.tiv.get_balances({ team: input.team });
        return { team: input.team, userId: user.id, balances: res.balances };
      },
      viewTitle: 'Your time-off balance',
      viewDescription: 'Vacation, sick, personal, and unpaid balances for the year.',
      invoking: 'Loading your balance…',
      invoked: 'Balance ready',
      domain: widgetDomain,
      csp: widgetCsp,
      view: { component: 'time-off-balance', entry: './views/time-off-balance.tsx' },
    }),
    tool('my_time_off', {
      description:
        "List the signed-in user's own time-off requests and their status for a team.",
      annotations: readOnly,
      input: z.object({ team: z.string() }),
      output: z.object({ team: z.string(), requests: z.array(z.unknown()) }),
      fulfil: ({ input, user, connectors }) => {
        const res = connectors.tiv.list_time_off({
          team: input.team,
          requesterId: user.id,
        });
        return { team: input.team, requests: res.requests };
      },
      viewTitle: 'Your time-off requests',
      viewDescription: 'Your submitted time-off requests and their status.',
      invoking: 'Loading your requests…',
      invoked: 'Requests ready',
      domain: widgetDomain,
      csp: widgetCsp,
      view: { component: 'time-off-requests', entry: './views/time-off-requests.tsx' },
    }),
    // Conversational booking. Model-callable and confirm-gated: the runtime shows a confirmation with
    // the exact resolved arguments and only creates the request on approval. One connector op, as a
    // confirmable flow requires.
    tool('book_time_off', {
      description:
        'Book a new full-day time-off request for the signed-in user, conversationally. Resolve ' +
        'relative dates to concrete YYYY-MM-DD and the team to its slug before calling. The user is ' +
        'asked to confirm the exact request before it is created.',
      annotations: confirmed,
      input: z.object({
        team: z.string(),
        type: leaveType,
        startDate: z.string(),
        endDate: z.string(),
        reason: z.string().default(''),
      }),
      // Return the refreshed request list so the shared time-off-requests widget renders the just-created
      // request as the confirmed result (the widget reads the invoking tool's own output via no-arg
      // useToolInfo()).
      output: z.object({
        team: z.string(),
        status: z.string(),
        request: z.unknown(),
        requests: z.array(z.unknown()),
      }),
      // A confirmable flow may contain at most one connector op, so render the just-created request
      // itself (not a re-fetched list) as the result widget's single row.
      fulfil: ({ input, connectors }) => {
        const res = connectors.tiv.create_time_off({
          team: input.team,
          type: input.type,
          startDate: input.startDate,
          endDate: input.endDate,
          reason: input.reason,
        });
        return {
          team: input.team,
          status: `Requested ${input.type} from ${input.startDate} to ${input.endDate}.`,
          request: res.request,
          requests: [res.request],
        };
      },
      viewTitle: 'Time-off request submitted',
      viewDescription: 'Your time-off requests, including the one just submitted.',
      invoking: 'Submitting your time-off request…',
      invoked: 'Request submitted',
      domain: widgetDomain,
      csp: widgetCsp,
      view: { component: 'time-off-requests', entry: './views/time-off-requests.tsx' },
    }),
    // Guided booking for under-specified requests ("book me some time off"). Elicits the leave type and
    // dates as one schema-validated form (all elicited input collected before the single connector op),
    // then the same confirmation gate reviews the exact request before creating it.
    tool('book_time_off_guided', {
      description:
        'Book time off when the user has NOT given a leave type and/or dates and you cannot resolve ' +
        'them from the conversation. Opens a short form to collect the type and dates, then asks the ' +
        'user to confirm before creating the request. If you already know the type and both dates, ' +
        'use book_time_off instead.',
      annotations: confirmed,
      input: z.object({ team: z.string() }),
      output: z.object({ status: z.string(), request: z.unknown() }),
      fulfil: ({ input, elicit, connectors }) => {
        const details = elicit({
          id: 'time_off_details',
          message: 'What time off would you like to book?',
          input: z.object({
            type: leaveType.describe('Leave type'),
            startDate: z.string().describe('Start date').meta({ format: 'date' }),
            endDate: z.string().describe('End date').meta({ format: 'date' }),
          }),
        });
        const res = connectors.tiv.create_time_off({
          team: input.team,
          type: details.type,
          startDate: details.startDate,
          endDate: details.endDate,
          reason: '',
        });
        return {
          status: `Requested ${details.type} from ${details.startDate} to ${details.endDate}.`,
          request: res.request,
        };
      },
    }),
    tool('cancel_time_off_request', {
      description:
        "Cancel one of the signed-in user's time-off requests by id, conversationally. The user is " +
        'asked to confirm before it is cancelled.',
      annotations: confirmedDestructive,
      input: z.object({ team: z.string(), id: z.string() }),
      output: z.object({ status: z.string(), request: z.unknown() }),
      fulfil: ({ input, connectors }) => {
        const res = connectors.tiv.cancel_time_off({
          team: input.team,
          id: input.id,
        });
        return { status: `Canceled request ${input.id}.`, request: res.request };
      },
    }),

    // ------------------------------------------------------------------ equipment (employee)
    tool('my_equipment', {
      description:
        "List the signed-in user's own equipment requests and their status for a team.",
      annotations: readOnly,
      input: z.object({ team: z.string() }),
      output: z.object({ team: z.string(), requests: z.array(z.unknown()) }),
      fulfil: ({ input, user, connectors }) => {
        const res = connectors.tiv.list_equipment({
          team: input.team,
          requesterId: user.id,
        });
        return { team: input.team, requests: res.requests };
      },
      viewTitle: 'Your equipment requests',
      viewDescription: 'Your submitted equipment requests and their status.',
      invoking: 'Loading your requests…',
      invoked: 'Requests ready',
      domain: widgetDomain,
      csp: widgetCsp,
      view: { component: 'equipment-requests', entry: './views/equipment-requests.tsx' },
    }),
    tool('order_equipment', {
      description:
        'Request a piece of equipment for the signed-in user, conversationally. Resolve the team to ' +
        'its slug before calling. The user is asked to confirm the exact request before it is created.',
      annotations: confirmed,
      input: z.object({
        team: z.string(),
        category: equipmentCategory,
        item: z.string(),
        quantity: z.number().int().min(1).max(20).default(1),
        justification: z.string().default(''),
      }),
      // Return the refreshed request list so the shared equipment-requests widget renders the just-created
      // request as the confirmed result (the widget reads the invoking tool's own output via no-arg
      // useToolInfo()).
      output: z.object({
        team: z.string(),
        status: z.string(),
        request: z.unknown(),
        requests: z.array(z.unknown()),
      }),
      // A confirmable flow may contain at most one connector op, so render the just-created request
      // itself (not a re-fetched list) as the result widget's single row.
      fulfil: ({ input, connectors }) => {
        const res = connectors.tiv.create_equipment({
          team: input.team,
          category: input.category,
          item: input.item,
          quantity: input.quantity,
          justification: input.justification,
        });
        return {
          team: input.team,
          status: `Requested ${input.quantity}× ${input.item} (${input.category}).`,
          request: res.request,
          requests: [res.request],
        };
      },
      viewTitle: 'Equipment request submitted',
      viewDescription: 'Your equipment requests, including the one just submitted.',
      invoking: 'Submitting your equipment request…',
      invoked: 'Request submitted',
      domain: widgetDomain,
      csp: widgetCsp,
      view: { component: 'equipment-requests', entry: './views/equipment-requests.tsx' },
    }),
    tool('order_equipment_guided', {
      description:
        'Request equipment when the user has NOT given the category, item, and/or quantity and you ' +
        'cannot resolve them from the conversation. Opens a short form to collect them, then asks the ' +
        'user to confirm before creating the request. If you already know all fields, use ' +
        'order_equipment instead.',
      annotations: confirmed,
      input: z.object({ team: z.string() }),
      output: z.object({ status: z.string(), request: z.unknown() }),
      fulfil: ({ input, elicit, connectors }) => {
        const details = elicit({
          id: 'equipment_details',
          message: 'What equipment would you like to request?',
          input: z.object({
            category: equipmentCategory.describe('Category'),
            item: z.string().describe('Item (e.g. "MacBook Pro 16 inch")'),
            quantity: z.number().int().min(1).max(20).describe('Quantity'),
            justification: z
              .string()
              .default('')
              .describe('Justification (optional)'),
          }),
        });
        const res = connectors.tiv.create_equipment({
          team: input.team,
          category: details.category,
          item: details.item,
          quantity: details.quantity,
          justification: details.justification,
        });
        return {
          status: `Requested ${details.quantity}× ${details.item} (${details.category}).`,
          request: res.request,
        };
      },
    }),
    tool('cancel_equipment_request', {
      description:
        "Cancel one of the signed-in user's equipment requests by id, conversationally. The user is " +
        'asked to confirm before it is cancelled.',
      annotations: confirmedDestructive,
      input: z.object({ team: z.string(), id: z.string() }),
      output: z.object({ status: z.string(), request: z.unknown() }),
      fulfil: ({ input, connectors }) => {
        const res = connectors.tiv.cancel_equipment({
          team: input.team,
          id: input.id,
        });
        return { status: `Canceled request ${input.id}.`, request: res.request };
      },
    }),

    // ------------------------------------------------------------------ admin review (OWNER/ADMIN)
    tool('team_time_off_queue', {
      description:
        'List the PENDING time-off requests awaiting review for a team. Only useful to an OWNER or ' +
        'ADMIN reviewer — Tivmark returns only the caller-visible requests.',
      annotations: readOnly,
      input: z.object({ team: z.string() }),
      output: z.object({ team: z.string(), requests: z.array(z.unknown()) }),
      fulfil: ({ input, connectors }) => {
        const res = connectors.tiv.list_time_off({
          team: input.team,
          status: 'PENDING',
        });
        return { team: input.team, requests: res.requests };
      },
      viewTitle: 'Time-off approvals',
      viewDescription: 'Pending time-off requests to approve or decline.',
      invoking: 'Loading the review queue…',
      invoked: 'Queue ready',
      domain: widgetDomain,
      csp: widgetCsp,
      view: {
        component: 'review-time-off-queue',
        entry: './views/review-time-off-queue.tsx',
      },
    }),
    tool('team_equipment_queue', {
      description:
        'List the PENDING equipment requests awaiting review for a team. Only useful to an OWNER or ' +
        'ADMIN reviewer — Tivmark returns only the caller-visible requests.',
      annotations: readOnly,
      input: z.object({ team: z.string() }),
      output: z.object({ team: z.string(), requests: z.array(z.unknown()) }),
      fulfil: ({ input, connectors }) => {
        const res = connectors.tiv.list_equipment({
          team: input.team,
          status: 'PENDING',
        });
        return { team: input.team, requests: res.requests };
      },
    }),
    // App-only helper the time-off review-queue widget calls (the button click is the user action).
    tool('review_time_off_app', {
      visibility: ['app'],
      description: 'Approve or decline a pending time-off request by id (OWNER/ADMIN only).',
      annotations: annotations.action(),
      input: z.object({
        team: z.string().default(''),
        id: z.string().default(''),
        decision: decision.default('APPROVED'),
      }),
      output: z.object({ status: z.string(), request: z.unknown() }),
      fulfil: ({ input, connectors }) => {
        const res = connectors.tiv.review_time_off({
          team: input.team,
          id: input.id,
          decision: input.decision,
          reviewNote: '',
        });
        return {
          status: `${input.decision} time-off request ${input.id}.`,
          request: res.request,
        };
      },
    }),
    tool('review_time_off', {
      description:
        'Approve or decline a pending time-off request by id (OWNER/ADMIN only). The user is asked to ' +
        'confirm the decision before it is applied.',
      annotations: confirmed,
      input: z.object({
        team: z.string(),
        id: z.string(),
        decision,
        reviewNote: z.string().default(''),
      }),
      output: z.object({ status: z.string(), request: z.unknown() }),
      fulfil: ({ input, connectors }) => {
        const res = connectors.tiv.review_time_off({
          team: input.team,
          id: input.id,
          decision: input.decision,
          reviewNote: input.reviewNote,
        });
        return {
          status: `${input.decision} time-off request ${input.id}.`,
          request: res.request,
        };
      },
    }),
    tool('review_equipment', {
      description:
        'Approve or decline a pending equipment request by id (OWNER/ADMIN only). The user is asked to ' +
        'confirm the decision before it is applied.',
      annotations: confirmed,
      input: z.object({
        team: z.string(),
        id: z.string(),
        decision,
        reviewNote: z.string().default(''),
      }),
      output: z.object({ status: z.string(), request: z.unknown() }),
      fulfil: ({ input, connectors }) => {
        const res = connectors.tiv.review_equipment({
          team: input.team,
          id: input.id,
          decision: input.decision,
          reviewNote: input.reviewNote,
        });
        return {
          status: `${input.decision} equipment request ${input.id}.`,
          request: res.request,
        };
      },
    }),
    tool('fulfill_equipment', {
      description:
        'Mark an approved equipment request as fulfilled/delivered by id (OWNER/ADMIN only). The user ' +
        'is asked to confirm before it is applied.',
      annotations: confirmed,
      input: z.object({ team: z.string(), id: z.string() }),
      output: z.object({ status: z.string(), request: z.unknown() }),
      fulfil: ({ input, connectors }) => {
        const res = connectors.tiv.fulfill_equipment({
          team: input.team,
          id: input.id,
        });
        return {
          status: `Fulfilled equipment request ${input.id}.`,
          request: res.request,
        };
      },
    }),
  ],
);
