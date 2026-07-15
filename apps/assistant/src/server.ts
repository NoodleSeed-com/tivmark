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
} from "@noodleseed/one";

const leaveType = z.enum(["VACATION", "SICK", "PERSONAL", "UNPAID"]);

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
const tivmark = connector("tivmark_timeoff")
  .version("1.0.0")
  .http({
    baseUrl: "https://app.tivmark.com/api/v1",
    allowedOrigins: ["https://app.tivmark.com"],
    auth: {
      kind: "delegatedTokenExchange",
      tokenUrl: "https://app.tivmark.com/api/assistant/oauth/token",
      clientId: variable("TIVMARK_DELEG_CLIENT_ID"),
      clientSecret: secret("TIVMARK_DELEG_CLIENT_SECRET"),
      // `teams` to list the user's teams; `time_off` for the time-off endpoints.
      scopes: ["time_off", "teams"],
      // audience omitted → the assertion is bound to tokenUrl (strongest replay protection).
      authMethod: "client_secret_basic",
    },
    operations: {
      list_teams: {
        type: "read",
        method: "GET",
        path: "/teams",
        input: z.object({}),
        // Bind the whole array; connector output validation is strict, and real API objects carry
        // more fields than we model. The tools/widgets read the fields they need.
        output: z.object({ teams: z.array(z.unknown()) }),
        response: { teams: "${response.data}" },
      },
      get_balances: {
        type: "read",
        method: "GET",
        path: "/teams/{team}/time-off/balances",
        query: ["year"],
        input: z.object({ team: z.string(), year: z.number().optional() }),
        output: z.object({ balances: z.record(z.record(z.unknown())) }),
        response: { balances: "${response.data}" },
      },
      list_requests: {
        type: "read",
        method: "GET",
        path: "/teams/{team}/time-off/requests",
        query: ["requesterId", "year"],
        input: z.object({
          team: z.string(),
          requesterId: z.string(),
          year: z.number().optional(),
        }),
        output: z.object({ requests: z.array(z.unknown()) }),
        response: { requests: "${response.data}" },
      },
      create_request: {
        type: "action",
        method: "POST",
        path: "/teams/{team}/time-off/requests",
        input: z.object({
          team: z.string(),
          type: leaveType,
          startDate: z.string(),
          endDate: z.string(),
          reason: z.string(),
        }),
        // No requesterId — the user principal (delegated token) supplies the actor.
        request: {
          type: "${args.type}",
          startDate: "${args.startDate}",
          endDate: "${args.endDate}",
          duration: "FULL_DAY",
          reason: "${args.reason}",
        },
        output: z.object({ request: z.unknown() }),
        response: { request: "${response.data}" },
      },
      cancel_request: {
        type: "action",
        method: "PATCH",
        path: "/teams/{team}/time-off/requests/{id}",
        input: z.object({ team: z.string(), id: z.string() }),
        // No actorUserId — derived from the user principal.
        request: { action: "cancel" },
        output: z.object({ request: z.unknown() }),
        response: { request: "${response.data}" },
      },
    },
  });

const readOnly = annotations.readOnly();
const action = annotations.action();

export default server(
  "tivmark_assistant",
  {
    title: "Tivmark Assistant",
    version: "1.4.0",
    instructions:
      "You are the Tivmark time-off assistant. Help the signed-in user check their leave balance, " +
      "review their time-off requests, submit a new request, and cancel a request. " +
      "Each turn includes the current date and the user’s local time zone — use them to resolve " +
      'relative dates ("today", "tomorrow", "next Thursday", "this Friday") into concrete YYYY-MM-DD ' +
      "dates yourself; never claim you don’t know the date. " +
      "Time off is per team. The user’s teams are provided to you as ambient context " +
      "(context.ambient.teams) every turn — use them to resolve the team: if there is exactly one, " +
      "use it silently; if several, ask which. Only call the my_teams tool if the ambient teams are " +
      'unavailable. Never invent a team. Pass the resolved team’s "slug" (NOT its display name) as ' +
      "the `team` argument to time_off_balance, my_time_off, request_time_off, book_time_off, and " +
      "cancel_time_off_request. " +
      "To book time off: if you know the leave type and both dates, call book_time_off (it asks the " +
      "user to confirm). If the user hasn’t given the type or dates and you can’t resolve them, call " +
      "book_time_off_guided, which collects them in a short form and then confirms. Address the user " +
      "by name.",
    branding: {
      name: "Tivmark",
      accent: "#7C3AED",
      radius: "lg",
      density: "comfortable",
    },
    // Per-turn grounding. The runtime injects the current date/time automatically; `defaults` set
    // the locale/time zone used when the session carries no backend `preferences` (the portal sources
    // those from the browser). `ambient` injects the user's teams into every turn as trusted context
    // so the model resolves the team without a separate lookup. The provider runs the read-only
    // `list_teams` op under the same delegated per-user token, so it only ever sees that user's teams.
    context: {
      defaults: { locale: "en-US", timeZone: "UTC" },
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
    // 'customers' access with BYO identity provider: Tivmark's own OAuth server is the IdP. Generic
    // MCP clients (ChatGPT/Claude) discover it via the MCP protected-resource-metadata, sign the user
    // in at app.tivmark.com, and present the resulting token here — Noodle (as resource server)
    // verifies it against Tivmark's JWKS. The portal embed continues to work via createAssistantSession
    // (session exchange is independent of this auth kind). Both inbound paths normalize to the same
    // verified customer identity, so the delegatedTokenExchange connector calls the API as that user.
    auth: customerAuth.oidc({
      issuer: "https://app.tivmark.com/oauth",
      audience: "tivmark-api",
    }),
    assistant: embeddedAssistant({
      model: openAICompatible({
        baseUrl: "https://openrouter.ai/api/v1",
        model: "anthropic/claude-sonnet-5",
        apiKey: secret("ASSISTANT_MODEL_API_KEY"),
      }),
      allowedOrigins: ["https://app.tivmark.com"],
      layout: { mode: "floating", position: "bottom-right" },
      labels: {
        welcomeHeading: "Tivmark Assistant",
        welcomeMessage: "Ask me about your time off.",
      },
    }),
    use: { tiv: tivmark },
  },
  [
    tool("greet", {
      description: "Greet the currently signed-in user by name.",
      input: z.object({}),
      output: z.object({ message: z.string() }),
      annotations: readOnly,
      fulfil: ({ user }) => {
        return { message: `Hello, ${user.name}!` };
      },
    }),
    tool("my_teams", {
      description:
        "List the teams the signed-in user belongs to. Use this to resolve which team a time-off " +
        "request applies to when the user has not named one.",
      annotations: readOnly,
      input: z.object({}),
      output: z.object({ teams: z.array(z.unknown()) }),
      fulfil: ({ connectors }) => {
        const res = connectors.tiv.list_teams({});
        return { teams: res.teams };
      },
    }),
    tool("time_off_balance", {
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
      viewTitle: "Your time-off balance",
      viewDescription:
        "Vacation, sick, personal, and unpaid balances for the year.",
      invoking: "Loading your balance…",
      invoked: "Balance ready",
      view: {
        component: "time-off-balance",
        entry: "./views/time-off-balance.tsx",
      },
    }),
    tool("my_time_off", {
      description:
        "List the signed-in user's time-off requests and their status for a team.",
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
      viewTitle: "Your time-off requests",
      viewDescription: "Your submitted time-off requests, newest first.",
      invoking: "Loading your requests…",
      invoked: "Requests ready",
      view: {
        component: "time-off-requests",
        entry: "./views/time-off-requests.tsx",
      },
    }),
    tool("request_time_off", {
      description:
        "Open the time-off request form so the user can submit a new request for a team.",
      annotations: readOnly,
      input: z.object({ team: z.string() }),
      output: z.object({ team: z.string(), prompt: z.string() }),
      fulfil: ({ input, user }) => ({
        team: input.team,
        prompt: `Pick a type and dates to request time off, ${user.name}.`,
      }),
      viewTitle: "Request time off",
      viewDescription: "Submit a new full-day time-off request.",
      invoking: "Opening the request form…",
      invoked: "Form ready",
      view: {
        component: "time-off-request-form",
        entry: "./views/time-off-request-form.tsx",
      },
    }),
    // App-only helper called by the request form widget.
    tool("submit_time_off", {
      visibility: ["app"],
      description:
        "Submit a new full-day time-off request for the signed-in user in a team.",
      annotations: action,
      input: z.object({
        team: z.string().default(""),
        type: leaveType.default("VACATION"),
        startDate: z.string().default(""),
        endDate: z.string().default(""),
        reason: z.string().default(""),
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
    tool("cancel_time_off", {
      visibility: ["app"],
      description:
        "Cancel one of the signed-in user's time-off requests by id in a team.",
      annotations: action,
      input: z.object({
        team: z.string().default(""),
        id: z.string().default(""),
      }),
      output: z.object({ status: z.string(), request: z.unknown() }),
      fulfil: ({ input, connectors }) => {
        const res = connectors.tiv.cancel_request({
          team: input.team,
          id: input.id,
        });
        return {
          status: `Canceled request ${input.id}.`,
          request: res.request,
        };
      },
    }),
    // Conversational booking. Model-callable and confirm-gated: the runtime shows the user a
    // confirmation with the exact resolved arguments and only creates the request on approval.
    // Single connector op, as required for a confirmable flow.
    tool("book_time_off", {
      description:
        "Book a new full-day time-off request for the signed-in user, conversationally. Resolve " +
        "relative dates to concrete YYYY-MM-DD and the team to its slug before calling. The user " +
        "is asked to confirm the exact request before it is created.",
      annotations: annotations.action({ confirm: true }),
      input: z.object({
        team: z.string(),
        type: leaveType,
        startDate: z.string(),
        endDate: z.string(),
        reason: z.string().default(""),
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
    // Guided booking for under-specified requests ("book me some time off"). Elicits the leave type
    // and dates as one structured, schema-validated form (all elicited input is collected before the
    // single connector op), then the same confirmation gate reviews the exact request before it is
    // created. Works in embedded/headless renderers and bidirectional MCP form transports.
    tool("book_time_off_guided", {
      description:
        "Book time off when the user has NOT given a leave type and/or dates and you cannot resolve " +
        "them from the conversation. Opens a short form to collect the type and dates, then asks the " +
        "user to confirm before creating the request. If you already know the type and both dates, " +
        "use book_time_off instead.",
      annotations: annotations.action({ confirm: true }),
      input: z.object({ team: z.string() }),
      output: z.object({ status: z.string(), request: z.unknown() }),
      fulfil: ({ input, elicit, connectors }) => {
        const details = elicit({
          id: "time_off_details",
          message: "What time off would you like to book?",
          input: z.object({
            type: leaveType.describe("Leave type"),
            startDate: z
              .string()
              .describe("Start date")
              .meta({ format: "date" }),
            endDate: z.string().describe("End date").meta({ format: "date" }),
          }),
        });
        const res = connectors.tiv.create_request({
          team: input.team,
          type: details.type,
          startDate: details.startDate,
          endDate: details.endDate,
          reason: "",
        });
        return {
          status: `Requested ${details.type} from ${details.startDate} to ${details.endDate}.`,
          request: res.request,
        };
      },
    }),
    // Conversational cancel. Model-callable, confirm-gated, and destructive.
    tool("cancel_time_off_request", {
      description:
        "Cancel one of the signed-in user's time-off requests by id, conversationally. The user is " +
        "asked to confirm before it is cancelled.",
      annotations: annotations.action({ confirm: true, destructive: true }),
      input: z.object({ team: z.string(), id: z.string() }),
      output: z.object({ status: z.string(), request: z.unknown() }),
      fulfil: ({ input, connectors }) => {
        const res = connectors.tiv.cancel_request({
          team: input.team,
          id: input.id,
        });
        return {
          status: `Canceled request ${input.id}.`,
          request: res.request,
        };
      },
    }),
  ],
);
