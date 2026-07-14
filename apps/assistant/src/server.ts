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

const leaveType = z.enum(['VACATION', 'SICK', 'PERSONAL', 'UNPAID']);

// Connector/tool list + object outputs bind the raw API values as `z.unknown()`: the connector
// validates outputs strictly and real Tivmark objects (teams, requests, balances) carry more fields
// than we consume. The tools return them as-is and the widgets read the fields they need.

// ---------------------------------------------------------------------------
// Connector: the Tivmark portal's public v1 API, called AS the signed-in end user.
// The Noodle broker exchanges a signed, JWKS-verifiable assertion of the user for a
// short-lived user-scoped Tivmark token at our tokenUrl (RFC 8693). So every call runs
// as a user principal and Tivmark's API enforces its own per-user / per-team security
// and filtering — no service key, no forwarded (spoofable) ids. `team` is a per-call
// path param, so any team the user belongs to works.
// ---------------------------------------------------------------------------
const tivmark = connector('tivmark_timeoff')
  .version('1.0.0')
  .http({
    baseUrl: 'https://app.tivmark.com/api/v1',
    allowedOrigins: ['https://app.tivmark.com'],
    auth: {
      kind: 'delegatedTokenExchange',
      tokenUrl: 'https://app.tivmark.com/api/assistant/oauth/token',
      clientId: variable('TIVMARK_DELEG_CLIENT_ID'),
      clientSecret: secret('TIVMARK_DELEG_CLIENT_SECRET'),
      // `teams` to list the user's teams; `time_off` for the time-off endpoints.
      scopes: ['time_off', 'teams'],
      // audience omitted → the assertion is bound to tokenUrl (strongest replay protection).
      authMethod: 'client_secret_basic',
    },
    operations: {
      list_teams: {
        type: 'read',
        method: 'GET',
        path: '/teams',
        input: z.object({}),
        // Bind the whole array; connector output validation is strict, and real API objects carry
        // more fields than we model. The tools/widgets read the fields they need.
        output: z.object({ teams: z.array(z.unknown()) }),
        response: { teams: '${response.data}' },
      },
      get_balances: {
        type: 'read',
        method: 'GET',
        path: '/teams/{team}/time-off/balances',
        query: ['year'],
        input: z.object({ team: z.string(), year: z.number().optional() }),
        output: z.object({ balances: z.record(z.record(z.unknown())) }),
        response: { balances: '${response.data}' },
      },
      list_requests: {
        type: 'read',
        method: 'GET',
        path: '/teams/{team}/time-off/requests',
        query: ['requesterId', 'year'],
        input: z.object({
          team: z.string(),
          requesterId: z.string(),
          year: z.number().optional(),
        }),
        output: z.object({ requests: z.array(z.unknown()) }),
        response: { requests: '${response.data}' },
      },
      create_request: {
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
        // No requesterId — the user principal (delegated token) supplies the actor.
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
      cancel_request: {
        type: 'action',
        method: 'PATCH',
        path: '/teams/{team}/time-off/requests/{id}',
        input: z.object({ team: z.string(), id: z.string() }),
        // No actorUserId — derived from the user principal.
        request: { action: 'cancel' },
        output: z.object({ request: z.unknown() }),
        response: { request: '${response.data}' },
      },
    },
  });

const readOnly = annotations.readOnly();
const action = annotations.action();

export default server(
  'tivmark_assistant',
  {
    title: 'Tivmark Assistant',
    version: '1.3.0',
    instructions:
      'You are the Tivmark time-off assistant. Help the signed-in user check their leave balance, ' +
      'review their time-off requests, submit a new request, and cancel a request. ' +
      'Time off is per team. Always call my_teams first to resolve the team the user means (match by ' +
      'name case-insensitively). If they belong to exactly one team, use it silently; if several, ask ' +
      'which. Then pass that team’s "slug" (NOT its display name) as the `team` argument to ' +
      'time_off_balance, my_time_off, and request_time_off. Address the user by name.',
    branding: {
      name: 'Tivmark',
      accent: '#7C3AED',
      radius: 'lg',
      density: 'comfortable',
    },
    // 'customers' access: the Tivmark portal backend bridges the signed-in user's identity into a
    // short-lived assistant session; user.id equals the Tivmark user id.
    auth: customerAuth.bridge({
      provider: 'tivmark-portal',
      user: { id: 'id', email: 'email', name: 'name', roles: 'roles' },
    }),
    assistant: embeddedAssistant({
      model: openAICompatible({
        baseUrl: 'https://openrouter.ai/api/v1',
        model: 'anthropic/claude-sonnet-5',
        apiKey: secret('ASSISTANT_MODEL_API_KEY'),
      }),
      allowedOrigins: ['https://app.tivmark.com'],
      layout: { mode: 'floating', position: 'bottom-right' },
      labels: {
        welcomeHeading: 'Tivmark Assistant',
        welcomeMessage: 'Ask me about your time off.',
      },
    }),
    use: { tiv: tivmark },
  },
  [
    tool('greet', {
      description: 'Greet the currently signed-in user by name.',
      input: z.object({}),
      output: z.object({ message: z.string() }),
      annotations: readOnly,
      fulfil: ({ user }) => {
        return { message: `Hello, ${user.name}!` };
      },
    }),
    tool('my_teams', {
      description:
        'List the teams the signed-in user belongs to. Use this to resolve which team a time-off ' +
        'request applies to when the user has not named one.',
      annotations: readOnly,
      input: z.object({}),
      output: z.object({ teams: z.array(z.unknown()) }),
      fulfil: ({ connectors }) => {
        const res = connectors.tiv.list_teams({});
        return { teams: res.teams };
      },
    }),
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
      view: { component: 'time-off-balance', entry: './views/time-off-balance.tsx' },
    }),
    tool('my_time_off', {
      description: "List the signed-in user's time-off requests and their status for a team.",
      annotations: readOnly,
      input: z.object({ team: z.string() }),
      output: z.object({ team: z.string(), requests: z.array(z.unknown()) }),
      fulfil: ({ input, user, connectors }) => {
        const res = connectors.tiv.list_requests({
          team: input.team,
          requesterId: user.id,
        });
        return { team: input.team, requests: res.requests };
      },
      viewTitle: 'Your time-off requests',
      viewDescription: 'Your submitted time-off requests, newest first.',
      invoking: 'Loading your requests…',
      invoked: 'Requests ready',
      view: { component: 'time-off-requests', entry: './views/time-off-requests.tsx' },
    }),
    tool('request_time_off', {
      description: 'Open the time-off request form so the user can submit a new request for a team.',
      annotations: readOnly,
      input: z.object({ team: z.string() }),
      output: z.object({ team: z.string(), prompt: z.string() }),
      fulfil: ({ input, user }) => ({
        team: input.team,
        prompt: `Pick a type and dates to request time off, ${user.name}.`,
      }),
      viewTitle: 'Request time off',
      viewDescription: 'Submit a new full-day time-off request.',
      invoking: 'Opening the request form…',
      invoked: 'Form ready',
      view: { component: 'time-off-request-form', entry: './views/time-off-request-form.tsx' },
    }),
    // App-only helper called by the request form widget.
    tool('submit_time_off', {
      visibility: ['app'],
      description: 'Submit a new full-day time-off request for the signed-in user in a team.',
      annotations: action,
      input: z.object({
        team: z.string().default(''),
        type: leaveType.default('VACATION'),
        startDate: z.string().default(''),
        endDate: z.string().default(''),
        reason: z.string().default(''),
      }),
      output: z.object({ status: z.string(), request: z.unknown() }),
      fulfil: ({ input, connectors }) => {
        const res = connectors.tiv.create_request({
          team: input.team,
          type: input.type,
          startDate: input.startDate,
          endDate: input.endDate,
          reason: input.reason,
        });
        return {
          status: `Requested ${input.type} from ${input.startDate} to ${input.endDate}.`,
          request: res.request,
        };
      },
    }),
    // App-only helper called by the requests-list widget.
    tool('cancel_time_off', {
      visibility: ['app'],
      description: "Cancel one of the signed-in user's time-off requests by id in a team.",
      annotations: action,
      input: z.object({ team: z.string().default(''), id: z.string().default('') }),
      output: z.object({ status: z.string(), request: z.unknown() }),
      fulfil: ({ input, connectors }) => {
        const res = connectors.tiv.cancel_request({ team: input.team, id: input.id });
        return { status: `Canceled request ${input.id}.`, request: res.request };
      },
    }),
  ],
);
