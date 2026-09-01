import {
  type AgentGuideSource,
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
    version: '1.5.0',
    interactions: { confirmationFallback: 'host' },
    instructions: createInstructions(),
    agentGuide: createAgentGuide(),
    branding: {
      name: 'Mark',
      accent: '#795f2b',
      surface: '#ffffff',
      surfaceDark: '#111c33',
      logo: {
        uri: 'https://tivmark.com/images/logo-horizontal-transparent.png',
        darkUri: 'https://tivmark.com/images/logo-horizontal-dark.png',
        alt: 'Tivmark Advisory',
      },
      mark: {
        uri: 'https://tivmark.com/images/logo-mark-transparent.png',
        alt: 'Tivmark',
      },
      avatar: {
        uri: 'https://tivmark.com/images/logo-mark-transparent.png',
        alt: "Mark, Tivmark's assistant",
      },
      theme: {
        light: {
          surface: '#f7f5f0',
          surfaceRaised: '#ffffff',
          surfaceMuted: '#ece8df',
          text: '#2a2a2a',
          textMuted: '#646464',
          accent: '#795f2b',
          accentText: '#f7f5f0',
          link: '#795f2b',
          border: '#8b8373',
          borderStrong: '#1a2744',
          focus: '#795f2b',
          success: '#2b704e',
          warning: '#795f2b',
          danger: '#a83d3d',
          code: '#1a2744',
        },
        dark: {
          surface: '#0b1222',
          surfaceRaised: '#111c33',
          surfaceMuted: '#1a2744',
          text: '#f7f5f0',
          textMuted: '#c4c0b8',
          accent: '#c9a96e',
          accentText: '#111c33',
          link: '#c9a96e',
          border: '#6f82a0',
          borderStrong: '#c9a96e',
          focus: '#c9a96e',
          success: '#67b58d',
          warning: '#c9a96e',
          danger: '#e47777',
          code: '#f7f5f0',
        },
      },
      radius: 'lg',
      density: 'comfortable',
      typography: 'system',
      colorScheme: 'auto',
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
        // `signIn: true` makes this a `mixed` surface: anonymous visitors start immediately,
        // and reaching an identity-dependent capability raises a sign-in card instead of
        // executing. The login is Tivmark's own on app.tivmark.com -- the marketing page
        // carries the single-use ticket over on a parent-domain cookie and redirects, and
        // apps/web spends it at session exchange, joining the signed-in person to the
        // conversation they already started. Enabled 2026-08-19 with Noodle Seed's r601:
        // origin re-pin, connector-auth-kind interception, issuer rebind, and the elevation
        // store are all in production (docs/noodle-seed-response-aug-19-2026.md).
        publicWebsite({
          origins: ['https://tivmark.com', 'https://www.tivmark.com'],
          signIn: true,
          capabilities: [
            // Anonymous-safe: no connector, no identity.
            tivmarkHelp,
            publicTools.talkToSales,
            // Branded explainer cards -- the card-shaped versions of the knowledge
            // answers, safe for a stranger because they touch nothing personal.
            { kind: 'tool', name: 'explore_tivmark' },
            { kind: 'tool', name: 'time_off_guide' },
            { kind: 'tool', name: 'equipment_guide' },
            { kind: 'tool', name: 'action_desk_guide' },
            { kind: 'tool', name: 'getting_started_guide' },
            { kind: 'tool', name: 'trust_and_security' },
            { kind: 'tool', name: 'design_business_workspace' },
            // Identity-gated: delegated-connector-backed, so for an anonymous visitor the
            // service intercepts the call into the sign-in card (r601 classifies on the
            // connector's auth kind -- no `${user}` trick needed). Listing them here is what
            // lets Mark OFFER them to a visitor; Tivmark's API still decides what a
            // signed-in user may actually do. Named as string refs because the tool
            // factories return arrays; a typo fails `noodle validate` with
            // assistant_capability_unknown, and test/public-surface.test.ts pins the list.
            { kind: 'tool', name: 'my_teams' },
            { kind: 'tool', name: 'time_off_balance' },
            { kind: 'tool', name: 'my_time_off' },
            { kind: 'tool', name: 'my_equipment' },
            { kind: 'tool', name: 'action_desk_services' },
            { kind: 'tool', name: 'my_service_requests' },
            { kind: 'tool', name: 'start_service_request' },
            { kind: 'tool', name: 'book_time_off' },
            { kind: 'tool', name: 'complete_business_onboarding' },
          ],
        }),
        // The signed-in product. `capabilities` is omitted deliberately: an authenticated
        // surface with no narrowing projects the whole server, which is the behaviour the
        // flat `allowedOrigins` list had before 0.127 replaced it.
        authenticatedWebsite({
          origins: ['http://localhost:4002', 'https://app.tivmark.com'],
          // What Tivmark's backend may tell the assistant about the signed-in person.
          // This is the allowlist: a claim the backend passes but does not appear here is
          // dropped at session exchange rather than rejected, so the two can deploy in
          // either order without breaking. `exposeToModel` additionally puts the value in
          // the assistant's identity context so it can use it directly in conversation.
          //
          // None of this authorizes anything. Every tool still reaches the Tivmark API
          // through delegated token exchange, and that API remains the boundary --
          // `reviewerTeamSlugs` decides what Mark *offers*, never what Tivmark permits.
          sessionClaims: {
            displayName: { exposeToModel: true },
            teamSlugs: { exposeToModel: true },
            reviewerTeamSlugs: { exposeToModel: true },
          },
        }),
      ],
      privacyUrl: 'https://tivmark.com/privacy',
      theme: 'auto',
      // This is deliberately the most expressive managed configuration, not a replacement
      // renderer. The public embed uses this floating baseline; the signed-in Tivmark app
      // overrides only the host placement so the same Noodle panel becomes a push drawer.
      layout: {
        mode: 'floating',
        position: 'bottom-right',
        panelWidth: 420,
        panelMinHeight: 560,
        panelMaxHeight: 680,
        edgeOffset: 24,
        zIndex: 150,
        density: 'comfortable',
        mobileFullscreen: true,
      },
      behavior: {
        startOpen: false,
        closeOnEscape: true,
        closeOnOutsideClick: false,
        showLauncher: true,
        showHeader: true,
        showAvatars: true,
        showTimestamps: true,
        showPoweredBy: true,
        // Keep business confirmations polished while Noodle still holds and enforces the
        // proposed action server-side. The technical disclosure is presentation-only.
        showConfirmationDetails: false,
      },
      // Every choice below is a bounded Noodle primitive. It travels with the deployment,
      // remains accessible and responsive in the managed renderer, and cannot inject HTML,
      // CSS, SVG, class names, or callbacks.
      presentation: {
        panel: {
          surface: 'glass',
          elevation: 'dramatic',
          border: 'strong',
          radius: 24,
        },
        launcher: {
          style: 'pill',
          icon: 'brand-mark',
          size: 'lg',
          status: 'session',
          effect: 'pulse',
        },
        header: {
          mark: 'brand-mark',
          badge: { text: 'Ready to help', tone: 'success', indicator: true },
        },
        composer: {
          leadingIcon: 'brand-mark',
          sendIcon: 'paper-plane',
          shape: 'pill',
        },
        messages: { userStyle: 'accent', assistantStyle: 'bubble' },
      },
      // Labels and prompts belong to the assistant, not to a surface, so this copy greets
      // an anonymous visitor on tivmark.com and a signed-in user on app.tivmark.com alike.
      // It has to work for both: "How much vacation do I have?" offered to a stranger is a
      // prompt whose only possible answer is "please sign in".
      labels: {
        welcomeHeading: 'How can Mark help?',
        welcomeMessage:
          'Tell Mark what you need. Get routed to the right service, complete an action, or track the outcome.',
        launcherPlaceholder: 'Ask Mark anything…',
        composerPlaceholder: 'Message Mark…',
        thinking: 'Mark is thinking…',
        send: 'Send',
        stop: 'Stop',
        open: 'Open Mark',
        close: 'Close Mark',
        confirm: 'Confirm',
        decline: "Don't proceed",
        cancel: 'Cancel',
        confirmationHeading: 'Review with Mark',
        additionalDetails: 'Technical details',
        redacted: 'Protected',
        completed: 'Completed',
        stopped: 'Stopped',
        copy: 'Copy',
        newMessages: 'New messages',
        reconnect: 'Reconnect',
        newConversation: 'New conversation',
        retry: 'Try again',
        unavailable: 'Mark is temporarily unavailable',
        sessionExpired: 'Your Mark session expired',
        sessionIdle: 'Mark is paused',
        sessionLoading: 'Starting Mark…',
        sessionReady: 'Mark is ready',
        sessionError: "Mark couldn't connect",
        signInHeading: 'Save your Tivmark workspace',
        signInBody:
          'Sign in or create an account to continue this request and keep its outcome.',
        signInAction: 'Sign in',
        signUpAction: 'Create account',
      },
      suggestedPrompts: [
        'I need help — find the right service and start a request.',
        // The flagship demo begins anonymously and becomes an authenticated confirmed write.
        'Help me set up Tivmark for my business.',
        // The flagship public-to-action demo. It begins anonymously, raises sign-in at the
        // planning read, then resumes the same request as an authenticated confirmed write.
        'Can I take next Friday off? If so, book it.',
        // Answerable by anyone, from the knowledge component.
        'How does booking time off work?',
        'What can the Action Desk handle?',
      ],
      locale: 'en-US',
      direction: 'auto',
    }),
    use: { tiv: tivmark },
  },
  [
    createTeamContextTool(toolConfig),
    publicTools.talkToSales,
    ...createGuideTools(toolConfig),
    ...createOnboardingTools(contracts, toolConfig),
    ...createTimeOffTools(contracts, toolConfig),
    ...createEquipmentTools(contracts, toolConfig),
    ...createActionDeskTools(contracts, toolConfig),
    ...createReviewTools(contracts, toolConfig),
  ]
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
  const eligibilityDecision = z.enum([
    'ELIGIBLE',
    'INVALID_DATES',
    'OVERLAP',
    'INSUFFICIENT_BALANCE',
    'POLICY_UNAVAILABLE',
  ]);
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
  const timeOffAssessmentSchema = z.object({
    status: z.string(),
    team: z.string(),
    userId: z.string(),
    type: leaveType,
    startDate: dateOnly,
    endDate: dateOnly,
    eligible: z.boolean(),
    decision: eligibilityDecision,
    reason: z.string(),
    requestedHalfDays: z.number().int().nonnegative(),
    pendingHalfDays: z.number().nonnegative(),
    availableBeforeHalfDays: z.number().nullable(),
    remainingAfterHalfDays: z.number().nullable(),
    conflict: z
      .object({
        id: z.string(),
        startDate: dateOnly,
        endDate: dateOnly,
      })
      .nullable(),
    checks: z.object({
      weekday: z.boolean(),
      noOverlap: z.boolean(),
      withinBalance: z.boolean(),
    }),
    policySource: z.string(),
  });
  const timeOffReceiptSchema = z.object({
    requestId: z.string(),
    status: z.string(),
    team: z.string(),
    type: leaveType,
    startDate: dateOnly,
    endDate: dateOnly,
    requestedHalfDays: z.number().int().nonnegative(),
    pendingHalfDays: z.number().nonnegative(),
    remainingAfterPendingHalfDays: z.number().nullable(),
    authenticated: z.boolean(),
  });
  const businessSizeBand = z.enum(['1-10', '11-50', '51-200', '201+']);
  const onboardingGoal = z.enum(['TIME_OFF', 'EQUIPMENT', 'BOTH']);
  const onboardingBlueprintSchema = z.object({
    businessName: z.string().min(3).max(100).describe('Business name'),
    teamSize: businessSizeBand.describe('Number of people'),
    timeZone: z
      .string()
      .min(1)
      .max(100)
      .describe('IANA time zone, for example America/Los_Angeles'),
    primaryGoal: onboardingGoal.describe('First workflow to launch'),
    vacationAllowanceDays: z
      .number()
      .int()
      .min(0)
      .max(365)
      .describe('Annual vacation allowance in days'),
    sickAllowanceDays: z
      .number()
      .int()
      .min(0)
      .max(365)
      .describe('Annual sick allowance in days'),
    personalAllowanceDays: z
      .number()
      .int()
      .min(0)
      .max(365)
      .describe('Annual personal allowance in days'),
  });
  const onboardingReceiptSchema = z.object({
    status: z.literal('READY'),
    team: z.object({
      id: z.string(),
      name: z.string(),
      slug: z.string(),
      teamSize: businessSizeBand.nullable(),
      timeZone: z.string().nullable(),
      primaryGoal: onboardingGoal.nullable(),
      primaryGoalLabel: z.string(),
      onboardingCompletedAt: z.string(),
    }),
    policies: z
      .array(
        z.object({
          type: z.string(),
          allowanceHalfDays: z.number().nullable(),
          allowanceDays: z.number().nullable(),
        })
      )
      .max(4),
    nextSteps: z
      .array(
        z.object({
          id: z.string(),
          label: z.string(),
          url: z.string(),
        })
      )
      .max(2),
    authenticated: z.boolean(),
  });
  const serviceAudience = z.enum(['PUBLIC', 'CUSTOMER', 'EMPLOYEE']);
  const serviceRequestStatus = z.enum([
    'OPEN',
    'IN_PROGRESS',
    'WAITING_ON_REQUESTER',
    'RESOLVED',
    'CANCELED',
  ]);
  const serviceRequestPriority = z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']);
  const actionServiceSchema = z.object({
    id: z.string(),
    slug: nonEmptyString,
    name: nonEmptyString,
    description: nonEmptyString,
    audience: serviceAudience,
    active: z.boolean(),
    slaHours: z.number().int().positive().nullable(),
    requiresApproval: z.boolean(),
  });
  const serviceRequestSchema = z
    .object({
      id: z.string(),
      subject: nonEmptyString,
      description: nonEmptyString,
      priority: serviceRequestPriority,
      status: serviceRequestStatus,
      source: z.enum(['WEB', 'ASSISTANT', 'MCP']),
      resolution: z.string().nullable(),
      createdAt: nonEmptyString,
      service: actionServiceSchema,
      requester,
      events: z
        .array(
          z
            .object({
              id: z.string(),
              type: nonEmptyString,
              message: nonEmptyString,
              createdAt: nonEmptyString,
            })
            .passthrough()
        )
        .max(50),
    })
    .passthrough();

  return {
    leaveType,
    equipmentCategory,
    decision,
    dateOnly,
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
    timeOffAssessmentSchema,
    timeOffReceiptSchema,
    businessSizeBand,
    onboardingGoal,
    onboardingBlueprintSchema,
    onboardingReceiptSchema,
    serviceRequestStatus,
    serviceRequestPriority,
    actionServiceSchema,
    serviceRequestSchema,
    actionServicesOutputSchema: z.object({
      team: z.string(),
      services: z.array(actionServiceSchema).max(50),
    }),
    serviceRequestsOutputSchema: z.object({
      team: z.string(),
      requests: z.array(serviceRequestSchema).max(100),
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
  timeOffBalanceOutputSchema,
  timeOffAssessmentSchema,
  timeOffReceiptSchema,
  onboardingBlueprintSchema,
  onboardingReceiptSchema,
  serviceRequestStatus,
  serviceRequestPriority,
  actionServiceSchema,
  serviceRequestSchema,
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
          'time_off.policy',
          'time_off.approve',
          'equipment',
          'equipment.approve',
          'service_requests',
          'service_requests.manage',
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
        complete_onboarding: {
          type: 'action',
          method: 'POST',
          path: '/onboarding/complete',
          input: onboardingBlueprintSchema,
          request: {
            businessName: '${args.businessName}',
            teamSize: '${args.teamSize}',
            timeZone: '${args.timeZone}',
            primaryGoal: '${args.primaryGoal}',
            vacationAllowanceDays: '${args.vacationAllowanceDays}',
            sickAllowanceDays: '${args.sickAllowanceDays}',
            personalAllowanceDays: '${args.personalAllowanceDays}',
          },
          output: z.object({ receipt: onboardingReceiptSchema }),
          response: { receipt: '${response.data}' },
        },
        get_balances: {
          type: 'read',
          method: 'GET',
          path: '/teams/{team}/time-off/balances',
          query: ['type', 'startDate', 'endDate', 'year'],
          input: z.object({
            team: z.string(),
            type: leaveType.optional(),
            startDate: z.string().optional(),
            endDate: z.string().optional(),
            year: z.number().optional(),
          }),
          output: timeOffBalanceOutputSchema.extend({
            assessment: timeOffAssessmentSchema.nullable(),
          }),
          response: {
            team: '${response.meta.team}',
            userId: '${response.meta.userId}',
            balances: '${response.data}',
            assessment: '${response.meta.assessment}',
          },
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
          output: z.object({
            request: z.unknown(),
            receipt: timeOffReceiptSchema,
          }),
          response: {
            request: '${response.data}',
            receipt: '${response.meta.receipt}',
          },
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
        list_action_services: {
          type: 'read',
          method: 'GET',
          path: '/teams/{team}/action-desk/services',
          input: z.object({ team: z.string() }),
          output: z.object({ services: z.array(actionServiceSchema) }),
          response: { services: '${response.data}' },
        },
        list_service_requests: {
          type: 'read',
          method: 'GET',
          path: '/teams/{team}/action-desk/requests',
          query: ['requesterId', 'status'],
          input: z.object({
            team: z.string(),
            requesterId: z.string().optional(),
            status: serviceRequestStatus.optional(),
          }),
          output: z.object({ requests: z.array(serviceRequestSchema) }),
          response: { requests: '${response.data}' },
        },
        create_service_request: {
          type: 'action',
          method: 'POST',
          path: '/teams/{team}/action-desk/requests',
          input: z.object({
            team: z.string(),
            serviceId: z.string(),
            subject: z.string(),
            description: z.string(),
            priority: serviceRequestPriority,
          }),
          request: {
            serviceId: '${args.serviceId}',
            subject: '${args.subject}',
            description: '${args.description}',
            priority: '${args.priority}',
            source: 'ASSISTANT',
          },
          output: z.object({ request: serviceRequestSchema }),
          response: { request: '${response.data}' },
        },
        transition_service_request: {
          type: 'action',
          method: 'PATCH',
          path: '/teams/{team}/action-desk/requests/{id}',
          input: z.object({
            team: z.string(),
            id: z.string(),
            status: serviceRequestStatus,
            note: z.string(),
          }),
          request: {
            status: '${args.status}',
            note: '${args.note}',
          },
          output: z.object({ request: serviceRequestSchema }),
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
      'How Tivmark works: its Action Desk, time-off and equipment workflows, teams and roles, ' +
      'getting started, and security and privacy. Use this to answer questions ' +
      'about Tivmark itself, and cite what it returns.',
    documents: [
      file('./knowledge/product-overview.md', {
        title: 'What Tivmark does',
        sourceUrl: 'https://tivmark.com/#features',
      }),
      file('./knowledge/time-off.md', { title: 'Time off in Tivmark' }),
      file('./knowledge/equipment.md', {
        title: 'Equipment requests in Tivmark',
      }),
      file('./knowledge/action-desk.md', {
        title: 'Action Desk services and requests',
        sourceUrl: 'https://tivmark.com/#features',
      }),
      file('./knowledge/teams-and-roles.md', {
        title: 'Teams, roles, and access',
      }),
      file('./knowledge/getting-started.md', {
        title: 'Getting started with Tivmark',
      }),
      file('./knowledge/security-and-privacy.md', {
        title: 'Security and privacy',
      }),
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
          })
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

// One capability deliberately spans Tivmark's two surfaces. The blueprint is a pure,
// anonymous planning result that the marketing host may use as untrusted prefill. Creating
// the workspace is a separate delegated, confirmed action, so neither a cookie nor a model
// utterance can cross the write boundary by itself.
function createOnboardingTools(
  { onboardingBlueprintSchema, onboardingReceiptSchema }: Contracts,
  { readOnly, confirmed, widgetCsp, widgetDomain }: ToolConfig
) {
  return [
    tool('design_business_workspace', {
      title: 'Design a business workspace',
      description:
        'Turn the collected business name, size, IANA time zone, first workflow, and starter ' +
        'leave allowances into a Tivmark workspace blueprint. Ask concise questions until every ' +
        'field is known. This is anonymous planning only and does not create an account or change data.',
      annotations: readOnly,
      input: onboardingBlueprintSchema,
      output: onboardingBlueprintSchema.extend({
        policySummary: z.string(),
        nextSteps: z.array(z.string()).max(3),
      }),
      fulfil: ({ input }) => ({
        // Noodle fulfilments are compiled into a declarative projection. Keep each
        // input field explicit: object spread is not retained by the hosted projection,
        // which would leave the widget with only the two computed fields below.
        businessName: input.businessName,
        teamSize: input.teamSize,
        timeZone: input.timeZone,
        primaryGoal: input.primaryGoal,
        vacationAllowanceDays: input.vacationAllowanceDays,
        sickAllowanceDays: input.sickAllowanceDays,
        personalAllowanceDays: input.personalAllowanceDays,
        policySummary:
          `${input.vacationAllowanceDays} vacation, ${input.sickAllowanceDays} sick, and ` +
          `${input.personalAllowanceDays} personal days per year, tracked in half-days.`,
        nextSteps: [
          'Create or sign in to a Tivmark owner account.',
          'Review the exact workspace and policy configuration.',
          'Confirm once to create and configure the workspace.',
        ],
      }),
      viewTitle: 'Tivmark workspace blueprint',
      viewDescription:
        'The business profile, starter policy, and cross-surface setup plan.',
      invoking: 'Designing your workspace…',
      invoked: 'Your workspace blueprint is ready',
      domain: 'https://tivmark.com',
      csp: widgetCsp,
      view: {
        component: 'workspace-blueprint',
        entry: './views/workspace-blueprint.tsx',
      },
    }),
    tool('complete_business_onboarding', {
      title: 'Create and configure business workspace',
      description:
        'Create or configure the signed-in owner’s Tivmark workspace from an existing blueprint. ' +
        'Preserve every blueprint value exactly and call only after the user asks to create it. ' +
        'This authenticated action shows the complete business profile and leave allowances for confirmation.',
      annotations: confirmed,
      input: onboardingBlueprintSchema,
      output: z.object({ receipt: onboardingReceiptSchema }),
      fulfil: ({ input, connectors }) => {
        const result = connectors.tiv.complete_onboarding({
          businessName: input.businessName,
          teamSize: input.teamSize,
          timeZone: input.timeZone,
          primaryGoal: input.primaryGoal,
          vacationAllowanceDays: input.vacationAllowanceDays,
          sickAllowanceDays: input.sickAllowanceDays,
          personalAllowanceDays: input.personalAllowanceDays,
        });
        return { receipt: result.receipt };
      },
      viewTitle: 'Workspace ready',
      viewDescription:
        'Authenticated receipt for the business profile and starter policy now live in Tivmark.',
      invoking: 'Creating and configuring your workspace…',
      invoked: 'Your workspace is ready',
      domain: widgetDomain,
      csp: widgetCsp,
      view: {
        component: 'workspace-ready',
        entry: './views/workspace-ready.tsx',
      },
    }),
  ];
}

// Branded explainer cards for the public site. Like talk_to_sales they touch no
// connector and reference no `${user}`, so an anonymous visitor can run them -- they are
// the card-shaped versions of the knowledge answers, sourced from src/knowledge/*.md.
// Keep the two in step when either changes.
function createGuideTools({ readOnly, widgetCsp }: ToolConfig) {
  return [
    tool('action_desk_guide', {
      title: 'Explore the Action Desk',
      description:
        'Show how Tivmark turns a plain-language need into a routed, trackable business request. ' +
        'Use this for public questions about customer support, sales, employee services, or the Action Desk.',
      annotations: readOnly,
      input: z.object({}),
      output: z.object({
        headline: z.string(),
        services: z
          .array(
            z.object({
              id: z.string(),
              name: z.string(),
              audience: z.string(),
              description: z.string(),
            })
          )
          .max(8),
        steps: z.array(z.string()).max(6),
      }),
      fulfil: () => ({
        headline: 'One front door for every request your business handles.',
        services: [
          {
            id: 'sales-consultation',
            name: 'Sales consultation',
            audience: 'Anyone',
            description:
              'Qualify a need, recommend the right next step, and arrange a walkthrough.',
          },
          {
            id: 'customer-support',
            name: 'Customer support',
            audience: 'Customers',
            description:
              'Capture the problem and route it with context instead of starting another thread.',
          },
          {
            id: 'software-access',
            name: 'Software access',
            audience: 'Employees',
            description:
              'Request an application or entitlement and keep the approval visible.',
          },
          {
            id: 'general-request',
            name: 'General request',
            audience: 'Anyone',
            description:
              'Give every other need a durable, trackable path to the right operator.',
          },
        ],
        steps: [
          'Explain what you need in your own words.',
          'Mark matches it to the team’s live service catalog.',
          'Review and confirm one durable request.',
          'Return later for grounded status and resolution.',
        ],
      }),
      viewTitle: 'Tivmark Action Desk',
      viewDescription:
        'A reusable AI front door for customer and employee needs.',
      invoking: 'Opening the Action Desk…',
      invoked: 'Here is what the Action Desk can handle',
      domain: 'https://tivmark.com',
      csp: widgetCsp,
      view: {
        component: 'action-desk-guide',
        entry: './views/action-desk-guide.tsx',
      },
    }),
    tool('explore_tivmark', {
      title: 'Show what Tivmark does',
      description:
        'Show an overview card of Tivmark: what it does, its features, and how to open the ' +
        'portal. Use this when someone asks what Tivmark is or what it can do.',
      annotations: readOnly,
      input: z.object({}),
      output: z.object({
        tagline: z.string(),
        features: z.array(z.object({ title: z.string(), detail: z.string() })),
        stats: z.array(z.object({ value: z.string(), label: z.string() })),
        portalUrl: z.string(),
      }),
      fulfil: () => ({
        tagline: 'Every business request, handled.',
        features: [
          {
            title: 'Action Desk',
            detail:
              'One AI-guided front door for sales, support, access, and custom business services.',
          },
          {
            title: 'Time off',
            detail:
              'Balances, requests, and approvals per team, counted in half-days.',
          },
          {
            title: 'Equipment',
            detail:
              'Request, approve, and fulfil hardware without a spreadsheet.',
          },
          {
            title: 'Approvals',
            detail: 'Owners and admins review queues with one click.',
          },
          {
            title: 'Teams & roles',
            detail: 'Per-team policies, members, and reviewer roles.',
          },
          {
            title: 'SSO & SCIM',
            detail: 'Enterprise sign-on and directory-driven provisioning.',
          },
          {
            title: 'API & webhooks',
            detail: 'A full REST API, webhooks, and audit history.',
          },
        ],
        stats: [
          { value: '1-click', label: 'approvals' },
          { value: 'Per-team', label: 'policies' },
          { value: 'SSO', label: 'enterprise-ready' },
        ],
        portalUrl: 'https://app.tivmark.com/?tab=login',
      }),
      viewTitle: 'What Tivmark does',
      viewDescription: 'Feature overview with a link to the portal.',
      invoking: 'Sketching the overview…',
      invoked: 'Here is Tivmark at a glance',
      domain: 'https://tivmark.com',
      csp: widgetCsp,
      view: {
        component: 'explore-tivmark',
        entry: './views/explore-tivmark.tsx',
      },
    }),
    tool('time_off_guide', {
      title: 'Explain time off',
      description:
        'Show a card explaining how time off works in Tivmark: the four leave types and how ' +
        'balances are counted. Use this when someone asks how time off, leave, or balances work.',
      annotations: readOnly,
      input: z.object({}),
      output: z.object({
        leaveTypes: z.array(
          z.object({ type: z.string(), label: z.string(), detail: z.string() })
        ),
        balanceParts: z.array(
          z.object({ term: z.string(), detail: z.string() })
        ),
        note: z.string(),
      }),
      fulfil: () => ({
        leaveTypes: [
          {
            type: 'VACATION',
            label: 'Vacation',
            detail: "Planned holiday, drawn from the team's annual allowance.",
          },
          {
            type: 'SICK',
            label: 'Sick',
            detail: 'Illness, usually on a separate allowance from vacation.',
          },
          {
            type: 'PERSONAL',
            label: 'Personal',
            detail: 'Appointments, family matters, and other personal time.',
          },
          {
            type: 'UNPAID',
            label: 'Unpaid',
            detail: 'Approved leave taken without pay, typically uncapped.',
          },
        ],
        balanceParts: [
          { term: 'Allowance', detail: 'what the team grants' },
          { term: 'Used', detail: 'approved days taken' },
          { term: 'Pending', detail: 'held until reviewed' },
        ],
        note:
          'Remaining is allowance minus used minus pending, counted in half-days — a ' +
          'morning off is 0.5. A new request starts as pending and a reviewer approves ' +
          'or declines it.',
      }),
      viewTitle: 'Time off in Tivmark',
      viewDescription: 'Leave types and how balances are counted.',
      invoking: 'Preparing the guide…',
      invoked: 'Here is how time off works',
      domain: 'https://tivmark.com',
      csp: widgetCsp,
      view: {
        component: 'time-off-guide',
        entry: './views/time-off-guide.tsx',
      },
    }),
    tool('equipment_guide', {
      title: 'Explain equipment requests',
      description:
        'Show a card explaining equipment requests in Tivmark: the six categories and the ' +
        'request lifecycle. Use this when someone asks how equipment or hardware requests work.',
      annotations: readOnly,
      input: z.object({}),
      output: z.object({
        categories: z.array(
          z.object({
            category: z.string(),
            label: z.string(),
            examples: z.string(),
          })
        ),
        lifecycle: z.array(z.object({ stage: z.string(), detail: z.string() })),
      }),
      fulfil: () => ({
        categories: [
          {
            category: 'LAPTOP',
            label: 'Laptop',
            examples: 'Work laptops and docking stations',
          },
          {
            category: 'MONITOR',
            label: 'Monitor',
            examples: 'External displays',
          },
          {
            category: 'PHONE',
            label: 'Phone',
            examples: 'Work phones and tablets',
          },
          {
            category: 'PERIPHERAL',
            label: 'Peripheral',
            examples: 'Keyboards, mice, headsets, webcams',
          },
          {
            category: 'FURNITURE',
            label: 'Furniture',
            examples: 'Desks, chairs, standing desk converters',
          },
          {
            category: 'OTHER',
            label: 'Other',
            examples: 'Anything that fits no category',
          },
        ],
        lifecycle: [
          { stage: 'Pending', detail: 'Submitted and waiting for a reviewer.' },
          {
            stage: 'Approved or declined',
            detail: 'A team owner or admin has decided.',
          },
          {
            stage: 'Fulfilled',
            detail: 'The approved item has actually been handed over.',
          },
        ],
      }),
      viewTitle: 'Equipment in Tivmark',
      viewDescription: 'Categories and the request lifecycle.',
      invoking: 'Preparing the guide…',
      invoked: 'Here is how equipment works',
      domain: 'https://tivmark.com',
      csp: widgetCsp,
      view: {
        component: 'equipment-guide',
        entry: './views/equipment-guide.tsx',
      },
    }),
    tool('getting_started_guide', {
      title: 'Show the getting-started checklist',
      description:
        'Show the five-step checklist for setting up a Tivmark workspace. Use this when ' +
        'someone asks how to get started, set up, or onboard their team.',
      annotations: readOnly,
      input: z.object({}),
      output: z.object({
        steps: z.array(z.object({ title: z.string(), detail: z.string() })),
      }),
      fulfil: () => ({
        steps: [
          {
            title: 'Create your workspace',
            detail: 'Sign up at app.tivmark.com and confirm your email.',
          },
          {
            title: 'Create your first team',
            detail:
              'Name it and give it a slug; split into more teams as you grow.',
          },
          {
            title: 'Set allowances',
            detail:
              'Vacation, sick, personal, and unpaid — any type can be unlimited.',
          },
          {
            title: 'Invite people',
            detail:
              'By email, or connect SCIM so your directory does it for you.',
          },
          {
            title: 'Assign reviewers',
            detail:
              'Make the right people owners or admins before members arrive.',
          },
        ],
      }),
      viewTitle: 'Getting started',
      viewDescription: 'Workspace setup checklist.',
      invoking: 'Preparing the checklist…',
      invoked: 'Here is the setup checklist',
      domain: 'https://tivmark.com',
      csp: widgetCsp,
      view: {
        component: 'getting-started-guide',
        entry: './views/getting-started-guide.tsx',
      },
    }),
    tool('trust_and_security', {
      title: 'Show security and privacy',
      description:
        "Show a card summarizing Tivmark's security and privacy posture: sign-in, per-team " +
        'visibility, and what the assistant can and cannot do. Use this when someone asks ' +
        'about security, privacy, or data handling.',
      annotations: readOnly,
      input: z.object({}),
      output: z.object({
        points: z.array(z.object({ title: z.string(), detail: z.string() })),
        privacyUrl: z.string(),
      }),
      fulfil: () => ({
        points: [
          {
            title: 'Sign-in',
            detail:
              'Password or SAML SSO; SCIM keeps accounts in step with your directory.',
          },
          {
            title: 'Visibility',
            detail:
              'Per team, not per company — nobody sees another team\u2019s data.',
          },
          {
            title: 'One boundary',
            detail:
              'The API enforces permissions for every client, the assistant included.',
          },
          {
            title: 'Confirmed writes',
            detail:
              'Every consequential action shows exactly what will happen and waits.',
          },
          {
            title: 'Verified identity',
            detail:
              'Identity comes from Tivmark\u2019s backend, never from the browser.',
          },
        ],
        privacyUrl: 'https://tivmark.com/privacy',
      }),
      viewTitle: 'Security and privacy',
      viewDescription: 'How Tivmark handles access and data.',
      invoking: 'Preparing the overview…',
      invoked: 'Here is the security picture',
      domain: 'https://tivmark.com',
      csp: widgetCsp,
      view: {
        component: 'trust-and-security',
        entry: './views/trust-and-security.tsx',
      },
    }),
  ];
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
    dateOnly,
    leaveType,
    timeOffBalanceOutputSchema,
    timeOffRequestSchema,
    timeOffRequestsOutputSchema,
    timeOffAssessmentSchema,
    timeOffReceiptSchema,
  }: Contracts,
  {
    readOnly,
    confirmed,
    confirmedDestructive,
    widgetCsp,
    widgetDomain,
  }: ToolConfig
) {
  return [
    tool('time_off_balance', {
      title: 'Check time-off balance',
      description:
        "Show the signed-in user's balances or assess whether specific dates fit the policy, " +
        'existing requests, and available balance. For generic “time off,” use VACATION. Pass both ' +
        'dates and their year for an assessment; call this before book_time_off when the user says ' +
        '“if I can,” “if eligible,” or otherwise makes booking conditional.',
      annotations: readOnly,
      input: z.object({
        team: z.string(),
        type: leaveType.default('VACATION'),
        startDate: dateOnly.optional(),
        endDate: dateOnly.optional(),
        year: z.number().int().min(2000).max(2100).optional(),
      }),
      output: timeOffBalanceOutputSchema.extend({
        assessment: timeOffAssessmentSchema.nullable(),
      }),
      fulfil: ({ input, connectors }) => {
        const res = connectors.tiv.get_balances({
          team: input.team,
          type: input.type,
          startDate: input.startDate,
          endDate: input.endDate,
          year: input.year,
        });
        return {
          team: res.team,
          userId: res.userId,
          balances: res.balances,
          assessment: res.assessment,
        };
      },
      viewTitle: 'Time-off eligibility and balance',
      viewDescription:
        'A policy-grounded eligibility decision plus vacation, sick, personal, and unpaid balances.',
      invoking: 'Checking policy, requests, and balance…',
      invoked: 'Eligibility check ready',
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
          requesterId: user.subject,
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
        'Submit an eligible full-day request. Resolve dates to YYYY-MM-DD and the team to its slug. ' +
        'For generic “time off,” use VACATION. When booking was conditional, call time_off_balance ' +
        'with the dates first and call this only when assessment.eligible is true. The user confirms ' +
        'the exact type, dates, and team before this authenticated write.',
      annotations: confirmed,
      input: z.object({
        team: z.string(),
        type: leaveType.default('VACATION'),
        startDate: dateOnly,
        endDate: dateOnly,
        reason: z.string().default(''),
      }),
      output: timeOffRequestsOutputSchema.extend({
        status: z.string(),
        request: timeOffRequestSchema,
        receipt: timeOffReceiptSchema,
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
          receipt: res.receipt,
        };
      },
      viewTitle: 'Authenticated time-off receipt',
      viewDescription:
        'The submitted request, projected balance, request id, and reversible cancel action.',
      invoking: 'Submitting your time-off request…',
      invoked: 'Request submitted',
      domain: widgetDomain,
      csp: widgetCsp,
      view: {
        component: 'time-off-receipt',
        entry: './views/time-off-receipt.tsx',
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
    // The widget-facing twin of cancel_time_off_request. `visibility: ['app']` keeps it
    // out of the model's tool list, and it skips the chat confirmation because the card
    // renders its own confirm step in place -- the same shape as review_*_app, pinned by
    // test/server.test.ts.
    tool('cancel_time_off_app', {
      title: 'Cancel time-off request in app',
      visibility: ['app'],
      description:
        "Cancel one of the signed-in user's time-off requests by id.",
      annotations: annotations.action(),
      input: z.object({
        team: z.string().default(''),
        id: z.string().default(''),
      }),
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
  }: ToolConfig
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
          requesterId: user.subject,
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
    // Widget-facing twin of cancel_equipment_request; see cancel_time_off_app.
    tool('cancel_equipment_app', {
      title: 'Cancel equipment request in app',
      visibility: ['app'],
      description:
        "Cancel one of the signed-in user's equipment requests by id.",
      annotations: annotations.action(),
      input: z.object({
        team: z.string().default(''),
        id: z.string().default(''),
      }),
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

function createActionDeskTools(
  {
    serviceRequestStatus,
    serviceRequestPriority,
    actionServicesOutputSchema,
    serviceRequestsOutputSchema,
    serviceRequestSchema,
  }: Contracts,
  { readOnly, confirmed, widgetCsp, widgetDomain }: ToolConfig
) {
  return [
    tool('action_desk_services', {
      title: 'Find an Action Desk service',
      description:
        'List the signed-in team’s live service catalog. Use this to match a natural-language ' +
        'need to a service id before creating a request; never invent a service id.',
      annotations: readOnly,
      input: z.object({ team: z.string() }),
      output: actionServicesOutputSchema,
      fulfil: ({ input, connectors }) => {
        const res = connectors.tiv.list_action_services({ team: input.team });
        return { team: input.team, services: res.services };
      },
      viewTitle: 'Action Desk services',
      viewDescription: 'The live services available for this team.',
      invoking: 'Loading the service catalog…',
      invoked: 'Service catalog ready',
      domain: widgetDomain,
      csp: widgetCsp,
      view: {
        component: 'action-desk-services',
        entry: './views/action-desk-services.tsx',
      },
    }),
    tool('my_service_requests', {
      title: 'List my Action Desk requests',
      description:
        "List the signed-in user's service requests, current status, and activity for a team.",
      annotations: readOnly,
      input: z.object({ team: z.string() }),
      output: serviceRequestsOutputSchema,
      fulfil: ({ input, user, connectors }) => {
        const res = connectors.tiv.list_service_requests({
          team: input.team,
          requesterId: user.subject,
        });
        return { team: input.team, requests: res.requests };
      },
      viewTitle: 'Your Action Desk requests',
      viewDescription: 'Track every request and its latest outcome.',
      invoking: 'Loading your requests…',
      invoked: 'Requests ready',
      domain: widgetDomain,
      csp: widgetCsp,
      view: {
        component: 'service-requests',
        entry: './views/service-requests.tsx',
      },
    }),
    tool('start_service_request', {
      title: 'Start an Action Desk request',
      description:
        'Create a durable service request for the signed-in user. First call action_desk_services, ' +
        'select an exact active service id, collect a short subject and useful detail, then show all ' +
        'fields for confirmation.',
      annotations: confirmed,
      input: z.object({
        team: z.string(),
        serviceId: z.string().describe('Exact id from action_desk_services'),
        subject: z.string().min(1).max(160),
        description: z.string().min(1).max(2000),
        priority: serviceRequestPriority.default('NORMAL'),
      }),
      output: serviceRequestsOutputSchema.extend({
        status: z.string(),
        request: serviceRequestSchema,
      }),
      fulfil: ({ input, connectors }) => {
        const res = connectors.tiv.create_service_request({
          team: input.team,
          serviceId: input.serviceId,
          subject: input.subject,
          description: input.description,
          priority: input.priority,
        });
        return {
          team: input.team,
          status: `Created Action Desk request ${res.request.id}.`,
          request: res.request,
          requests: [res.request],
        };
      },
      viewTitle: 'Action Desk request created',
      viewDescription:
        'A durable receipt with service, status, and request id.',
      invoking: 'Creating your request…',
      invoked: 'Request created',
      domain: widgetDomain,
      csp: widgetCsp,
      view: {
        component: 'service-requests',
        entry: './views/service-requests.tsx',
      },
    }),
    tool('team_service_request_queue', {
      title: 'Open the Action Desk queue',
      description:
        'List the team service-request queue. Only useful to an OWNER or ADMIN of that team.',
      annotations: readOnly,
      input: z.object({ team: z.string() }),
      output: serviceRequestsOutputSchema,
      fulfil: ({ input, connectors }) => {
        const res = connectors.tiv.list_service_requests({ team: input.team });
        return { team: input.team, requests: res.requests };
      },
      viewTitle: 'Action Desk queue',
      viewDescription:
        'Open, active, waiting, and recently completed requests.',
      invoking: 'Loading the Action Desk queue…',
      invoked: 'Queue ready',
      domain: widgetDomain,
      csp: widgetCsp,
      view: {
        component: 'service-request-queue',
        entry: './views/service-request-queue.tsx',
      },
    }),
    tool('review_service_request', {
      title: 'Update an Action Desk request',
      description:
        'Move a team service request to in progress, waiting on requester, resolved, canceled, ' +
        'or reopen it. OWNER/ADMIN only. The operator confirms the exact status and note.',
      annotations: confirmed,
      input: z.object({
        team: z.string(),
        id: z.string(),
        status: serviceRequestStatus,
        note: z.string().max(1000).default(''),
      }),
      output: z.object({ status: z.string(), request: serviceRequestSchema }),
      fulfil: ({ input, connectors }) => {
        const res = connectors.tiv.transition_service_request({
          team: input.team,
          id: input.id,
          status: input.status,
          note: input.note,
        });
        return {
          status: `Moved request ${input.id} to ${input.status}.`,
          request: res.request,
        };
      },
    }),
    tool('review_service_request_app', {
      title: 'Update an Action Desk request in app',
      visibility: ['app'],
      description:
        'Move a team service request to its next status (OWNER/ADMIN only).',
      annotations: annotations.action(),
      input: z.object({
        team: z.string().default(''),
        id: z.string().default(''),
        status: serviceRequestStatus.default('IN_PROGRESS'),
        note: z.string().default(''),
      }),
      output: z.object({ status: z.string(), request: serviceRequestSchema }),
      fulfil: ({ input, connectors }) => {
        const res = connectors.tiv.transition_service_request({
          team: input.team,
          id: input.id,
          status: input.status,
          note: input.note,
        });
        return {
          status: `Moved request ${input.id} to ${input.status}.`,
          request: res.request,
        };
      },
    }),
  ];
}

function createReviewTools(
  {
    decision,
    timeOffRequestsOutputSchema,
    equipmentRequestsOutputSchema,
  }: Contracts,
  { readOnly, confirmed, widgetCsp, widgetDomain }: ToolConfig
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
      // Was `z.array(z.unknown())`, which told the model and the widget nothing about the
      // rows it was about to render. It now declares the same shape every other equipment
      // tool does.
      output: equipmentRequestsOutputSchema,
      fulfil: ({ input, connectors }) => {
        const res = connectors.tiv.list_equipment({
          team: input.team,
          status: 'PENDING',
        });
        return { team: input.team, requests: res.requests };
      },
      viewTitle: 'Equipment approvals',
      viewDescription: 'Pending equipment requests to approve or decline.',
      invoking: 'Loading the review queue…',
      invoked: 'Queue ready',
      domain: widgetDomain,
      csp: widgetCsp,
      view: {
        component: 'review-equipment-queue',
        entry: './views/review-equipment-queue.tsx',
      },
    }),
    tool('review_equipment_app', {
      title: 'Review equipment request in app',
      visibility: ['app'],
      description:
        'Approve or decline a pending equipment request by id (OWNER/ADMIN only).',
      annotations: annotations.action(),
      input: z.object({
        team: z.string().default(''),
        id: z.string().default(''),
        decision: decision.default('APPROVED'),
      }),
      output: z.object({ status: z.string(), request: z.unknown() }),
      fulfil: ({ input, connectors }) => {
        const res = connectors.tiv.review_equipment({
          team: input.team,
          id: input.id,
          decision: input.decision,
          reviewNote: '',
        });
        return {
          status: `${input.decision} equipment request ${input.id}.`,
          request: res.request,
        };
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

function createAgentGuide(): AgentGuideSource {
  return {
    description:
      'Use Mark as a reusable Action Desk for business services, onboarding, and people-ops actions behind explicit confirmation.',
    useWhen: [
      'A customer, employee, or public visitor needs help and should be routed to the right business service.',
      'An owner or administrator wants to operate the team service-request queue.',
      'A prospective customer wants to set up Tivmark for a new business.',
      'The user asks whether they can take time off or asks Mark to submit it.',
      'The user wants to inspect or manage their Tivmark people-ops data.',
    ],
    workflows: [
      {
        id: 'resolve_business_need',
        title: 'Route and track a business need',
        intent:
          'Carry a plain-language customer or employee need into a grounded, durable request and later status.',
        steps: [
          {
            capability: { kind: 'tool', name: 'action_desk_guide' },
            guidance:
              'For a public visitor, show the reusable kinds of service the Action Desk supports. Do not imply these static examples are a signed-in team’s live catalog.',
          },
          {
            capability: { kind: 'tool', name: 'action_desk_services' },
            guidance:
              'Once identity and team are available, load the live catalog and match the need to one exact active service id. Ask one short clarifying question if more than one service fits.',
          },
          {
            capability: { kind: 'tool', name: 'start_service_request' },
            guidance:
              'Collect a concise subject, useful detail, and bounded priority. Call only after service lookup and preserve the selected service id; confirmation is the write boundary.',
          },
          {
            capability: { kind: 'tool', name: 'my_service_requests' },
            guidance:
              'Use for later status questions. Treat the returned status, resolution, and events as authoritative.',
          },
        ],
      },
      {
        id: 'onboard_business',
        title: 'Design and create a business workspace',
        intent:
          'Carry a prospective owner from a public conversation through signup into one authenticated, confirmed workspace configuration.',
        steps: [
          {
            capability: { kind: 'tool', name: 'design_business_workspace' },
            guidance:
              'Collect business name, size band, IANA time zone, first workflow, and leave allowances. Offer 20 vacation, 10 sick, and 3 personal days as defaults. Call once every value is explicit.',
          },
          {
            capability: { kind: 'tool', name: 'complete_business_onboarding' },
            guidance:
              'Only after the user asks to create the workspace, preserve the blueprint values exactly. The platform raises account creation or sign-in when needed, resumes the pending call inside Tivmark, and presents the exact write for confirmation.',
          },
        ],
      },
      {
        id: 'book_time_off_if_eligible',
        title: 'Assess and book time off',
        intent:
          'Carry one request from public policy explanation through authenticated eligibility and a confirmed write.',
        steps: [
          {
            capability: { kind: 'tool', name: 'time_off_guide' },
            guidance:
              'On the public surface, briefly ground the weekday and pending-approval rules; add one cited knowledge sentence only when useful.',
          },
          {
            capability: { kind: 'tool', name: 'time_off_balance' },
            guidance:
              'Resolve relative dates from invocation context, default generic time off to VACATION, pass both dates and their year, and use the returned assessment instead of doing balance arithmetic.',
          },
          {
            capability: { kind: 'tool', name: 'book_time_off' },
            guidance:
              'Call only when assessment.eligible is true and the user already asked to book. Preserve the assessed team, type, and dates exactly; the confirmation is the review boundary.',
          },
        ],
      },
    ],
    boundaries: [
      'Never invent a service id or submit against a static public example; call action_desk_services for the signed-in team first.',
      'Never say a request exists until start_service_request returns its durable request id.',
      'Only offer team_service_request_queue or review_service_request to an OWNER or ADMIN of the relevant team.',
      'A workspace blueprint is planning data only; never say the business exists until complete_business_onboarding returns status READY.',
      'Never change a blueprint value between design_business_workspace and complete_business_onboarding without telling the user and regenerating the blueprint.',
      'Never claim eligibility without a current time_off_balance assessment for the exact team, type, and dates.',
      'Never call book_time_off after an ineligible assessment or when the user asked only whether the dates work.',
      'A successful booking creates a pending request, not approved leave.',
      'Treat session claims as conversation context only; Tivmark connector authorization remains authoritative.',
    ],
    examples: [
      {
        prompt: 'I need help — find the right service and start a request.',
        workflow: 'resolve_business_need',
      },
      {
        prompt: 'Help me set up Tivmark for my business.',
        workflow: 'onboard_business',
      },
      {
        prompt: 'Can I take next Friday off? If so, book it.',
        workflow: 'book_time_off_if_eligible',
      },
    ],
  };
}

function createInstructions() {
  return (
    "You are Mark, Tivmark's Action Desk and people-ops assistant. " +
    'ACTION DESK: help customers, employees, and visitors explain a need, reach the right ' +
    'business service, create a durable request, and retrieve grounded status. Public visitors ' +
    'get action_desk_guide examples. For a signed-in user, resolve the team and call ' +
    'action_desk_services before start_service_request; never invent a service id. Collect a ' +
    'short subject, actionable context, and LOW, NORMAL, HIGH, or URGENT priority. Ask one ' +
    'clarifying question when the match is ambiguous. A submitted request is OPEN, not resolved. ' +
    'Use my_service_requests for status. Offer queue and transition tools only to an OWNER or ADMIN. ' +
    'TIME OFF AND EQUIPMENT: check the signed-in user’s balances and requests, create or cancel ' +
    'requests, and help authorized reviewers. Resolve relative dates to YYYY-MM-DD in the current ' +
    'time zone. For “if eligible,” call time_off_balance for the exact dates, default generic ' +
    'leave to VACATION, and book only when eligible and already requested. A booking is pending. ' +
    'Use direct tools when all required values are known and guided tools when values are missing. ' +
    'ONBOARDING: collect business name, size band, IANA time zone, first workflow, and starter ' +
    'vacation, sick, and personal allowances. Ask at most two questions per turn. Use ' +
    'design_business_workspace once explicit. Call complete_business_onboarding only after the ' +
    'user asks to create it, with unchanged values; claim success only from its READY receipt. ' +
    'CONTEXT: use a trusted team slug, choose the only team, ask if several, and never guess. ' +
    'reviewerTeamSlugs guides what to offer but Tivmark API authorization is authoritative. ' +
    'Address the user by name when known. Prefer tools over prose; let the matching card carry ' +
    'the data, add at most two short sentences, and never restate what the card already shows. ' +
    'For product questions prefer explore_tivmark, action_desk_guide, ' +
    'time_off_guide, equipment_guide, getting_started_guide, or trust_and_security; add one cited ' +
    'search_tivmark_help fact only when useful. Keep replies concise. ' +
    'ANONYMOUS: absence of ambient team context means public visitor. Use public guides or ' +
    'talk_to_sales. For personal data or actions, call the matching identity-gated tool so the ' +
    'platform can offer sign-in and resume. Never guess personal data or promise transcript display.'
  );
}
