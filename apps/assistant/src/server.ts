import {
  annotations,
  authenticatedWebsite,
  connector,
  customerAuth,
  embeddedAssistant,
  file,
  knowledge,
  openAICompatible,
  publicWebsite,
  secret,
  server,
  site,
  tool,
  variable,
  z,
} from '@noodleseed/one';

const contracts = createContracts();
const tivmark = createTivmarkConnector(contracts);
const toolConfig = createToolConfig();

// The public half of Mark. Built before server(...) so the website surface can reference
// the real declarations rather than repeating their names as strings -- a typo becomes a
// compile error instead of an `assistant_capability_unknown` at validate time.
const tivmarkHelp = createKnowledge();
const publicTools = createPublicTools(toolConfig);

// Mark is one portable Noodle Seed app: the same tools power Tivmark's embed
// and direct MCP connections from ChatGPT, Claude, Gemini, and other hosts.
export default server(
  'tivmark_assistant',
  {
    title: 'Mark',
    version: '1.0.0',
    interactions: { confirmationFallback: 'host' },
    instructions: createInstructions(),
    branding: {
      name: 'Mark',
      accent: '#b08d57',
      theme: {
        light: { accent: '#b08d57', accentText: '#111c33' },
        dark: { accent: '#c9a96e', accentText: '#111c33' },
      },
      radius: 'lg',
      density: 'comfortable',
    },
    knowledge: [tivmarkHelp],
    handoff: {
      allowedDomains: ['https://tivmark.com', 'https://app.tivmark.com'],
    },
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
    auth: customerAuth.oidc({
      issuer: 'https://app.tivmark.com/oauth',
      audience: 'tivmark-api-prod',
    }),
    assistant: embeddedAssistant({
      model: openAICompatible({
        baseUrl: variable('ASSISTANT_MODEL_BASE_URL'),
        model: variable('ASSISTANT_MODEL'),
        apiKey: secret('ASSISTANT_MODEL_API_KEY'),
      }),
      // One assistant, two front doors. The same brand, model, and tool set project onto
      // the marketing site and the signed-in product; the surface decides who may open a
      // session and what they can reach.
      access: [
        // A stranger on tivmark.com. `capabilities` IS the externally reachable surface --
        // short enough to read in one screenful, and closed by default: a tool added to
        // this server later stays unreachable here until someone lists it. Both the apex
        // and www serve the marketing site with no redirect between them, so both are
        // listed; an unlisted origin is refused character-for-character.
        //
        // Deliberately no `signIn: true` yet. Mid-conversation elevation needs the host
        // backend to spend a continuation, and @noodleseed/assistant exposes no way to do
        // that (see docs/noodle-assistant-elevation-gap.md). Shipping it now would draw a
        // sign-in card the visitor cannot complete, so the public surface stays honestly
        // anonymous until that lands.
        publicWebsite({
          origins: ['https://tivmark.com', 'https://www.tivmark.com'],
          capabilities: [tivmarkHelp, publicTools.talkToSales],
        }),
        // The signed-in product. `capabilities` is omitted deliberately: an authenticated
        // surface with no narrowing projects the whole server, which is the behaviour the
        // flat `allowedOrigins` list had before 0.127 replaced it.
        authenticatedWebsite({
          origins: ['http://localhost:4002', 'https://app.tivmark.com'],
        }),
      ],
      privacyUrl: 'https://tivmark.com/privacy',
      layout: { mode: 'floating', position: 'bottom-right' },
      labels: {
        welcomeHeading: 'How can Mark help?',
        welcomeMessage: 'Ask about your time off or equipment.',
        composerPlaceholder: 'Message Mark…',
        open: 'Open Mark',
        close: 'Close Mark',
      },
      suggestedPrompts: [
        'How much vacation do I have?',
        'Book time off',
        'Show my equipment requests',
        'Request equipment',
      ],
    }),
    use: { tiv: tivmark },
  },
  [
    createTeamContextTool(toolConfig),
    publicTools.talkToSales,
    ...createTimeOffTools(contracts, toolConfig),
    ...createEquipmentTools(contracts, toolConfig),
    ...createReviewTools(contracts, toolConfig),
  ],
);

// ---------------------------------------------------------------------------
// Shared contracts

function createContracts() {
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
  const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
  const nonEmptyString = z.string().min(1);
  const requester = z
    .object({
      id: z.string(),
      name: z.string().nullable().optional(),
      email: z.string().nullable().optional(),
    })
    .passthrough();
  const timeOffRequestSchema = z
    .object({
      id: z.string(),
      type: nonEmptyString,
      status: nonEmptyString,
      startDate: dateOnly,
      endDate: dateOnly,
      requestedHalfDays: z.number().int().nonnegative().optional(),
      reason: z.string().nullable().optional(),
      requester: requester.optional(),
    })
    .passthrough();
  const equipmentRequestSchema = z
    .object({
      id: z.string(),
      category: nonEmptyString,
      item: nonEmptyString,
      quantity: z.number().int().min(1).max(20),
      status: nonEmptyString,
      justification: z.string().nullable().optional(),
      requester: requester.optional(),
    })
    .passthrough();
  const balance = z
    .object({
      allowanceHalfDays: z.number().nonnegative().nullable(),
      approvedHalfDays: z.number().nonnegative(),
      pendingHalfDays: z.number().nonnegative(),
      remainingHalfDays: z.number().nullable(),
    })
    .passthrough();

  return {
    leaveType,
    equipmentCategory,
    decision,
    timeOffRequestSchema,
    equipmentRequestSchema,
    timeOffRequestsOutputSchema: z.object({
      team: z.string(),
      requests: z.array(timeOffRequestSchema),
    }),
    equipmentRequestsOutputSchema: z.object({
      team: z.string(),
      requests: z.array(equipmentRequestSchema),
    }),
    timeOffBalanceOutputSchema: z.object({
      team: z.string(),
      userId: z.string(),
      balances: z.record(z.record(balance)),
    }),
  };
}

type Contracts = ReturnType<typeof createContracts>;

// ---------------------------------------------------------------------------
// Tivmark API

function createTivmarkConnector({
  leaveType,
  equipmentCategory,
  decision,
}: Contracts) {
  // Every call runs as the signed-in user through delegated token exchange;
  // Tivmark's API remains the authorization boundary.
  return connector('tivmark')
    .version('1.0.0')
    .http({
      baseUrl: 'https://app.tivmark.com/api/v1',
      allowedOrigins: ['https://app.tivmark.com'],
      auth: {
        kind: 'delegatedTokenExchange',
        tokenUrl: 'https://app.tivmark.com/api/assistant/oauth/token',
        clientId: variable('TIVMARK_DELEG_CLIENT_ID'),
        clientSecret: secret('TIVMARK_DELEG_CLIENT_SECRET'),
        scopes: [
          'teams',
          'time_off',
          'time_off.approve',
          'equipment',
          'equipment.approve',
        ],
        authMethod: 'client_secret_basic',
      },
      operations: {
        list_teams: {
          type: 'read',
          method: 'GET',
          path: '/teams',
          input: z.object({}),
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
          request: {
            action: 'review',
            decision: '${args.decision}',
            reviewNote: '${args.reviewNote}',
          },
          output: z.object({ request: z.unknown() }),
          response: { request: '${response.data}' },
        },
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
}

// ---------------------------------------------------------------------------
// Tool groups

function createToolConfig() {
  return {
    readOnly: annotations.readOnly(),
    confirmed: annotations.action({ confirm: true }),
    confirmedDestructive: annotations.action({
      confirm: true,
      destructive: true,
    }),
    widgetCsp: { connectDomains: [], resourceDomains: [] },
    widgetDomain: 'https://app.tivmark.com',
  };
}

type ToolConfig = ReturnType<typeof createToolConfig>;

// Tivmark's own product documentation, plus its live marketing site. The compiler validates
// and hashes every document at build time; deployment publishes them with the app, crawls
// the declared site, and re-crawls on the refresh cadence. One declaration compiles to a
// bounded `search_tivmark_help` capability with cited results -- no handwritten search/fetch
// pair, no index to operate, and no provider keys (the managed crawler and index are the
// defaults).
function createKnowledge() {
  return knowledge('tivmark_help', {
    title: 'Tivmark help',
    description:
      'How Tivmark works: what the product does, time-off and equipment workflows, teams ' +
      'and roles, getting started, and security and privacy. Use this to answer questions ' +
      'about Tivmark itself, and cite what it returns.',
    documents: [
      file('./knowledge/product-overview.md', {
        title: 'What Tivmark does',
        sourceUrl: 'https://tivmark.com/#features',
      }),
      file('./knowledge/time-off.md', { title: 'Time off in Tivmark' }),
      file('./knowledge/equipment.md', { title: 'Equipment requests in Tivmark' }),
      file('./knowledge/teams-and-roles.md', { title: 'Teams, roles, and access' }),
      file('./knowledge/getting-started.md', { title: 'Getting started with Tivmark' }),
      file('./knowledge/security-and-privacy.md', { title: 'Security and privacy' }),
    ],
    // The marketing site is a single page, and nginx serves it for every path, so a wider
    // glob would crawl the same document under unbounded URLs. Scope it to the one page.
    sites: [
      site({
        origin: 'https://tivmark.com',
        include: ['/'],
        refresh: '24h',
      }),
    ],
  });
}

// The only tool a stranger can actually run. It touches no connector, so it clears both
// public-surface rules: `anonymousBehavior` sees no `${user}` reference and no authorization
// requirement, and `assistant_public_effect_unconfirmed` cannot fire on a tool with no
// connector operation. Every other Tivmark tool reaches the API through a delegated
// token exchange, which has no credential to use without a signed-in person.
function createPublicTools({ readOnly, widgetCsp }: ToolConfig) {
  return {
    talkToSales: tool('talk_to_sales', {
      title: 'Talk to the Tivmark team',
      description:
        'Show the ways to reach Tivmark: book a walkthrough, start a workspace, or contact ' +
        'support. Use this when someone wants to try Tivmark or talk to a person, rather ' +
        'than asking how the product works.',
      annotations: readOnly,
      input: z.object({}),
      output: z.object({
        options: z.array(
          z.object({
            id: z.string(),
            label: z.string(),
            url: z.string(),
            detail: z.string(),
          }),
        ),
      }),
      fulfil: () => ({
        options: [
          {
            id: 'demo',
            label: 'Book a walkthrough',
            url: 'https://tivmark.com/#contact',
            detail: 'A short tour of Tivmark with the team.',
          },
          {
            id: 'start',
            label: 'Start a workspace',
            url: 'https://app.tivmark.com/?tab=join',
            detail: 'Set up your first team in minutes.',
          },
          {
            id: 'support',
            label: 'Contact support',
            url: 'https://tivmark.com/#contact',
            detail: 'Questions about a workspace you already have.',
          },
        ],
      }),
      viewTitle: 'Talk to Tivmark',
      viewDescription: 'Ways to reach the Tivmark team.',
      invoking: 'Finding the right next step…',
      invoked: 'Here are your options',
      domain: 'https://tivmark.com',
      csp: widgetCsp,
      view: {
        component: 'contact-options',
        entry: './views/contact-options.tsx',
      },
    }),
  };
}

function createTeamContextTool({ readOnly }: ToolConfig) {
  return tool('my_teams', {
    title: 'List my teams',
    description:
      'List the teams the signed-in user belongs to, with their role on each. Use this when ambient ' +
      'team context is unavailable.',
    contextProvider: true,
    annotations: readOnly,
    input: z.object({}),
    output: z.object({ teams: z.array(z.unknown()) }),
    fulfil: ({ connectors }) => {
      const res = connectors.tiv.list_teams({});
      return { teams: res.teams };
    },
  });
}

function createTimeOffTools(
  {
    leaveType,
    timeOffBalanceOutputSchema,
    timeOffRequestSchema,
    timeOffRequestsOutputSchema,
  }: Contracts,
  {
    readOnly,
    confirmed,
    confirmedDestructive,
    widgetCsp,
    widgetDomain,
  }: ToolConfig,
) {
  return [
    tool('time_off_balance', {
      title: 'Check time-off balance',
      description:
        "Show the signed-in user's time-off balances (vacation, sick, personal, unpaid) for a team.",
      annotations: readOnly,
      input: z.object({ team: z.string() }),
      output: timeOffBalanceOutputSchema,
      fulfil: ({ input, user, connectors }) => {
        const res = connectors.tiv.get_balances({ team: input.team });
        return {
          team: input.team,
          userId: user.subject,
          balances: res.balances,
        };
      },
      viewTitle: 'Your time-off balance',
      viewDescription:
        'Vacation, sick, personal, and unpaid balances for the year.',
      invoking: 'Loading your balance…',
      invoked: 'Balance ready',
      domain: widgetDomain,
      csp: widgetCsp,
      view: {
        component: 'time-off-balance',
        entry: './views/time-off-balance.tsx',
      },
    }),
    tool('my_time_off', {
      title: 'List my time-off requests',
      description:
        "List the signed-in user's own time-off requests and their status for a team.",
      annotations: readOnly,
      input: z.object({ team: z.string() }),
      output: timeOffRequestsOutputSchema,
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
      view: {
        component: 'time-off-requests',
        entry: './views/time-off-requests.tsx',
      },
    }),
    tool('book_time_off', {
      title: 'Book time off',
      description:
        'Book a new full-day request. Resolve dates to YYYY-MM-DD and the team to its slug. The user ' +
        'confirms the exact request.',
      annotations: confirmed,
      input: z.object({
        team: z.string(),
        type: leaveType,
        startDate: z.string(),
        endDate: z.string(),
        reason: z.string().default(''),
      }),
      output: timeOffRequestsOutputSchema.extend({
        status: z.string(),
        request: timeOffRequestSchema,
      }),
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
      viewDescription:
        'Your time-off requests, including the one just submitted.',
      invoking: 'Submitting your time-off request…',
      invoked: 'Request submitted',
      domain: widgetDomain,
      csp: widgetCsp,
      view: {
        component: 'time-off-requests',
        entry: './views/time-off-requests.tsx',
      },
    }),
    tool('book_time_off_guided', {
      title: 'Book time off with a form',
      description:
        'Book time off when the leave type or dates are missing. Opens a short form, then asks the ' +
        'user to confirm. Use book_time_off when every detail is known.',
      annotations: confirmed,
      input: z.object({ team: z.string() }),
      output: z.object({ status: z.string(), request: z.unknown() }),
      fulfil: ({ input, elicit, connectors }) => {
        const details = elicit({
          id: 'time_off_details',
          message: 'What time off would you like to book?',
          input: z.object({
            type: leaveType.describe('Leave type'),
            startDate: z
              .string()
              .describe('Start date')
              .meta({ format: 'date' }),
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
      title: 'Cancel time-off request',
      description:
        "Cancel one of the signed-in user's time-off requests by id. The user confirms first.",
      annotations: confirmedDestructive,
      input: z.object({ team: z.string(), id: z.string() }),
      output: z.object({ status: z.string(), request: z.unknown() }),
      fulfil: ({ input, connectors }) => {
        const res = connectors.tiv.cancel_time_off({
          team: input.team,
          id: input.id,
        });
        return {
          status: `Canceled request ${input.id}.`,
          request: res.request,
        };
      },
    }),
  ];
}

function createEquipmentTools(
  {
    equipmentCategory,
    equipmentRequestSchema,
    equipmentRequestsOutputSchema,
  }: Contracts,
  {
    readOnly,
    confirmed,
    confirmedDestructive,
    widgetCsp,
    widgetDomain,
  }: ToolConfig,
) {
  return [
    tool('my_equipment', {
      title: 'List my equipment requests',
      description:
        "List the signed-in user's own equipment requests and their status for a team.",
      annotations: readOnly,
      input: z.object({ team: z.string() }),
      output: equipmentRequestsOutputSchema,
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
      view: {
        component: 'equipment-requests',
        entry: './views/equipment-requests.tsx',
      },
    }),
    tool('order_equipment', {
      title: 'Request equipment',
      description:
        'Request equipment for the signed-in user. Resolve the team to its slug. The user confirms ' +
        'the exact request.',
      annotations: confirmed,
      input: z.object({
        team: z.string(),
        category: equipmentCategory,
        item: z.string(),
        quantity: z.number().int().min(1).max(20).default(1),
        justification: z.string().default(''),
      }),
      output: equipmentRequestsOutputSchema.extend({
        status: z.string(),
        request: equipmentRequestSchema,
      }),
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
      viewDescription:
        'Your equipment requests, including the one just submitted.',
      invoking: 'Submitting your equipment request…',
      invoked: 'Request submitted',
      domain: widgetDomain,
      csp: widgetCsp,
      view: {
        component: 'equipment-requests',
        entry: './views/equipment-requests.tsx',
      },
    }),
    tool('order_equipment_guided', {
      title: 'Request equipment with a form',
      description:
        'Request equipment when the category, item, or quantity is missing. Opens a short form, then ' +
        'asks the user to confirm. Use order_equipment when every detail is known.',
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
      title: 'Cancel equipment request',
      description:
        "Cancel one of the signed-in user's equipment requests by id. The user confirms first.",
      annotations: confirmedDestructive,
      input: z.object({ team: z.string(), id: z.string() }),
      output: z.object({ status: z.string(), request: z.unknown() }),
      fulfil: ({ input, connectors }) => {
        const res = connectors.tiv.cancel_equipment({
          team: input.team,
          id: input.id,
        });
        return {
          status: `Canceled request ${input.id}.`,
          request: res.request,
        };
      },
    }),
  ];
}

function createReviewTools(
  { decision, timeOffRequestsOutputSchema }: Contracts,
  { readOnly, confirmed, widgetCsp, widgetDomain }: ToolConfig,
) {
  return [
    tool('team_time_off_queue', {
      title: 'Open time-off review queue',
      description:
        'List pending time-off requests awaiting review for a team. Only useful to an OWNER or ADMIN.',
      annotations: readOnly,
      input: z.object({ team: z.string() }),
      output: timeOffRequestsOutputSchema,
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
      title: 'Open equipment review queue',
      description:
        'List pending equipment requests awaiting review for a team. Only useful to an OWNER or ADMIN.',
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
    tool('review_time_off_app', {
      title: 'Review time-off request in app',
      visibility: ['app'],
      description:
        'Approve or decline a pending time-off request by id (OWNER/ADMIN only).',
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
      title: 'Review time-off request',
      description:
        'Approve or decline a pending time-off request by id (OWNER/ADMIN only). The user confirms first.',
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
      title: 'Review equipment request',
      description:
        'Approve or decline a pending equipment request by id (OWNER/ADMIN only). The user confirms first.',
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
      title: 'Fulfill equipment request',
      description:
        'Mark an approved equipment request as fulfilled by id (OWNER/ADMIN only). The user confirms first.',
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
  ];
}

function createInstructions() {
  return (
    "You are Mark, Tivmark's people-ops assistant. Help the signed-in user with TIME OFF " +
    '(check balances, review their requests, book new time off, cancel a request) and EQUIPMENT ' +
    '(review their requests, request an item, cancel a request). ' +
    'Resolve relative dates from the current date and local time zone into concrete YYYY-MM-DD dates. ' +
    'Resolve every team from trusted context: use its slug, silently choose the only team, ask when ' +
    'there are several, and never invent one. ' +
    'Use book_time_off or order_equipment when every required detail is known; otherwise use the ' +
    'matching guided tool to collect missing details before confirmation. ' +
    'Only offer team queues, reviews, and fulfillment to an OWNER or ADMIN of the relevant team. ' +
    // The same assistant also answers on Tivmark's public marketing site, where there is no
    // signed-in person at all. Ambient team context is the tell: it is only available to a
    // signed-in user, so its absence means treat the visitor as anonymous.
    'ANONYMOUS VISITORS: when ambient team context is unavailable, you are talking to someone ' +
    'on the public Tivmark website who is not signed in. Answer their questions about how ' +
    'Tivmark works from search_tivmark_help and cite what it returns, and use talk_to_sales ' +
    'when they want a walkthrough, a workspace, or support. Do not guess a team, a balance, or ' +
    'a request, and do not call my_teams to compensate. If they ask about their own time off or ' +
    'equipment, say plainly that they need to sign in at app.tivmark.com and offer talk_to_sales.'
  );
}
