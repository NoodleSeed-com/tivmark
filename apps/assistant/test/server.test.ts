import { describe, expect, it } from 'vitest';
import app from '../src/server.js';

describe('tivmark_assistant', () => {
  it('exports a Noodle server definition', () => {
    expect(typeof app.toManifest).toBe('function');
  });

  it('exposes only the operational people-ops tool surface', async () => {
    const manifest = await app.toManifest();
    const modelVisibleTools = manifest.tools.filter(
      (tool: { visibility?: string[] }) =>
        !tool.visibility || tool.visibility.includes('model')
    );

    expect(
      modelVisibleTools.map((tool: { name: string }) => tool.name).sort()
    ).toEqual(
      [
        // identity / teams
        'my_teams',
        // public website surface (no signed-in user)
        'talk_to_sales',
        'explore_tivmark',
        'time_off_guide',
        'equipment_guide',
        'action_desk_guide',
        'getting_started_guide',
        'trust_and_security',
        'design_business_workspace',
        'complete_business_onboarding',
        'plan_new_hire_launch',
        'launch_new_hire',
        'get_new_hire_status',
        // time off (employee)
        'time_off_balance',
        'my_time_off',
        'book_time_off',
        'book_time_off_guided',
        'cancel_time_off_request',
        // equipment (employee)
        'my_equipment',
        'order_equipment',
        'order_equipment_guided',
        'cancel_equipment_request',
        // Action Desk (customer, employee, public, and operator)
        'action_desk_services',
        'my_service_requests',
        'start_service_request',
        'team_service_request_queue',
        'review_service_request',
        // admin review (OWNER/ADMIN)
        'team_time_off_queue',
        'team_equipment_queue',
        'review_time_off',
        'review_equipment',
        'fulfill_equipment',
      ].sort()
    );

    // Interactive widgets drive their actions through app-only helpers, so the model
    // never sees a second, unconfirmed way to approve or cancel. Each helper's card
    // renders its own confirm step in place of the chat confirmation.
    for (const name of [
      'review_time_off_app',
      'review_equipment_app',
      'cancel_time_off_app',
      'cancel_equipment_app',
      'review_service_request_app',
    ]) {
      const appOnlyReviewTool = manifest.tools.find(
        (tool: { name: string }) => tool.name === name
      ) as { visibility?: string[] } | undefined;
      expect(appOnlyReviewTool, `missing app-only tool ${name}`).toBeDefined();
      expect(appOnlyReviewTool?.visibility).toEqual(['app']);
    }
    expect(manifest.tools).toHaveLength(modelVisibleTools.length + 5);
  });

  it('publishes business-facing titles for every tool', async () => {
    const manifest = await app.toManifest();
    const titles = Object.fromEntries(
      manifest.tools.map((tool: { name: string; title?: string }) => [
        tool.name,
        tool.title,
      ])
    );

    expect(titles).toEqual({
      action_desk_guide: 'Explore the Action Desk',
      action_desk_services: 'Find an Action Desk service',
      book_time_off: 'Book time off',
      book_time_off_guided: 'Book time off with a form',
      cancel_equipment_request: 'Cancel equipment request',
      cancel_time_off_request: 'Cancel time-off request',
      complete_business_onboarding: 'Create and configure business workspace',
      design_business_workspace: 'Design a business workspace',
      fulfill_equipment: 'Fulfill equipment request',
      my_equipment: 'List my equipment requests',
      my_service_requests: 'List my Action Desk requests',
      my_teams: 'List my teams',
      talk_to_sales: 'Talk to the Tivmark team',
      my_time_off: 'List my time-off requests',
      order_equipment: 'Request equipment',
      order_equipment_guided: 'Request equipment with a form',
      review_equipment: 'Review equipment request',
      review_service_request: 'Update an Action Desk request',
      review_service_request_app: 'Update an Action Desk request in app',
      review_time_off: 'Review time-off request',
      review_time_off_app: 'Review time-off request in app',
      review_equipment_app: 'Review equipment request in app',
      cancel_time_off_app: 'Cancel time-off request in app',
      cancel_equipment_app: 'Cancel equipment request in app',
      explore_tivmark: 'Show what Tivmark does',
      time_off_guide: 'Explain time off',
      equipment_guide: 'Explain equipment requests',
      getting_started_guide: 'Show the getting-started checklist',
      get_new_hire_status: 'Check new-hire launch status',
      launch_new_hire: 'Launch a new hire',
      plan_new_hire_launch: 'Plan a new-hire launch',
      trust_and_security: 'Show security and privacy',
      start_service_request: 'Start an Action Desk request',
      team_equipment_queue: 'Open equipment review queue',
      team_service_request_queue: 'Open the Action Desk queue',
      team_time_off_queue: 'Open time-off review queue',
      time_off_balance: 'Check time-off balance',
    });
  });

  it('uses the team lookup as the portable application context provider', async () => {
    const manifest = await app.toManifest();
    const teamTool = manifest.tools.find(
      (tool: { name: string }) => tool.name === 'my_teams'
    ) as { contextProvider?: boolean };

    expect(teamTool.contextProvider).toBe(true);
  });

  it('wires people-ops tools to the Tivmark connector', async () => {
    const manifest = await app.toManifest();
    // The connector is referenced by id (its transport/auth live in the connector catalog, which
    // `noodle validate` checks — the delegated-token-exchange auth is asserted there, not here).
    expect(manifest.connectors?.tiv?.id).toBe('tivmark');
    // Reads and writes both record steps against the connector, so tools run through Tivmark's API.
    const text = JSON.stringify(manifest);
    expect(text).toContain('tiv.list_teams');
    expect(text).toContain('tiv.create_time_off');
    expect(text).toContain('tiv.create_equipment');
    expect(text).toContain('tiv.review_time_off');
    expect(text).toContain('tiv.complete_onboarding');
    expect(text).toContain('tiv.plan_new_hire');
    expect(text).toContain('tiv.launch_new_hire');
    expect(text).toContain('tiv.get_new_hire_status');
    expect(text).toContain('tiv.list_action_services');
    expect(text).toContain('tiv.create_service_request');
    expect(text).toContain('tiv.transition_service_request');
  });

  it('publishes the API-authoritative Tivmark user for balance lookup', async () => {
    const manifest = await app.toManifest();
    const balanceTool = manifest.tools.find(
      (tool: { name: string }) => tool.name === 'time_off_balance'
    ) as {
      fulfilment?: { output?: { userId?: string } };
    };

    expect(balanceTool.fulfilment?.output?.userId).toBe(
      '${steps.get_balances.userId}'
    );
  });

  it('projects every blueprint input into the hosted widget result', async () => {
    const manifest = await app.toManifest();
    const blueprintTool = manifest.tools.find(
      (tool: { name: string }) => tool.name === 'design_business_workspace'
    ) as { fulfilment?: { output?: Record<string, unknown> } } | undefined;

    expect(blueprintTool?.fulfilment?.output).toMatchObject({
      businessName: '${input.businessName}',
      teamSize: '${input.teamSize}',
      timeZone: '${input.timeZone}',
      primaryGoal: '${input.primaryGoal}',
      vacationAllowanceDays: '${input.vacationAllowanceDays}',
      sickAllowanceDays: '${input.sickAllowanceDays}',
      personalAllowanceDays: '${input.personalAllowanceDays}',
    });
  });

  it('presents the embedded assistant as Mark with focused starter prompts', async () => {
    const manifest = await app.toManifest();

    expect(manifest.server.title).toBe('Mark');
    expect(manifest.server.branding?.name).toBe('Mark');
    expect(manifest.server.instructions).toContain(
      "You are Mark, Tivmark's Action Desk and people-ops assistant."
    );
    expect(manifest.server.assistant?.labels).toMatchObject({
      welcomeHeading: "Hi, I'm Mark",
      welcomeMessage:
        "Ask a question or tell me what you'd like to get done. I'll guide you and confirm before anything changes.",
      launcherPlaceholder: 'Ask Mark…',
      composerPlaceholder: 'Ask Mark or start a request…',
      open: 'Open Mark',
      close: 'Close Mark',
      confirmationHeading: 'Review with Mark',
      sessionLoading: 'Getting Mark ready…',
      sessionReady: 'Ready',
      signInAction: 'Sign in',
      signUpAction: 'Create account',
    });
    expect(manifest.server.assistant?.suggestedPrompts).toEqual([
      'I need help — find the right service and start a request.',
      'Help me set up Tivmark for my business.',
      'Onboard a new team member.',
      'Can I take next Friday off? If so, book it.',
      'What can the Action Desk handle?',
    ]);
  });

  it('publishes a portable light-and-dark Tivmark brand kit', async () => {
    const manifest = await app.toManifest();
    const branding = manifest.server.branding;

    expect(branding).toMatchObject({
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
      radius: 'lg',
      density: 'comfortable',
      typography: 'system',
      colorScheme: 'auto',
    });
    expect(branding?.theme?.light).toMatchObject({
      surface: '#f7f5f0',
      surfaceRaised: '#ffffff',
      surfaceMuted: '#ece8df',
      text: '#2a2a2a',
      textMuted: '#646464',
      accent: '#795f2b',
      accentText: '#f7f5f0',
      borderStrong: '#1a2744',
    });
    expect(branding?.theme?.dark).toMatchObject({
      surface: '#0b1222',
      surfaceRaised: '#111c33',
      surfaceMuted: '#1a2744',
      text: '#f7f5f0',
      textMuted: '#c4c0b8',
      accent: '#c9a96e',
      accentText: '#111c33',
      borderStrong: '#c9a96e',
    });
  });

  it('declares the verified session claims it personalizes with', async () => {
    // This deliberately reverses the guard added in PR #63, which pinned the assistant to
    // no personalization. It is safe to reverse now because the claims are an explicit
    // allowlist: the backend cannot introduce a claim the server has not declared here,
    // and an undeclared claim is dropped at exchange rather than reaching the model.
    const manifest = await app.toManifest();
    const claims = manifest.server.assistant?.sessionClaims;

    expect(claims).toBeDefined();
    expect(claims?.displayName?.exposeToModel).toBe(true);
    expect(claims?.teamSlugs?.exposeToModel).toBe(true);
    expect(claims?.reviewerTeamSlugs?.exposeToModel).toBe(true);

    expect(manifest.server.instructions).toContain('Address the user by name');
  });

  it('keeps session claims on the authenticated surface only', async () => {
    // A public visitor is an anonymous principal -- there is no verified backend to pass
    // claims, so a public surface must never carry them.
    const manifest = await app.toManifest();
    for (const surface of manifest.server.assistant?.surfaces ?? []) {
      if (surface.mode === 'authenticated') continue;
      expect(
        surface.sessionClaims,
        `${surface.mode} surface must not declare session claims`
      ).toBeUndefined();
    }
  });

  it('never treats a claim as authorization', async () => {
    // Claims decide what Mark offers. Tivmark's API decides what is permitted, and every
    // tool reaches it through delegated token exchange. If a claim ever appeared in a
    // tool's compiled fulfilment, that line would have moved.
    const manifest = await app.toManifest();
    for (const tool of manifest.tools) {
      expect(
        JSON.stringify(tool.fulfilment ?? {}),
        `${tool.name} reads a session claim in its fulfilment`
      ).not.toContain('user.claims');
    }
  });

  it('uses a calm, single-brand managed presentation without custom markup', async () => {
    const manifest = await app.toManifest();
    const assistant = manifest.server.assistant;

    expect(assistant?.theme).toBe('auto');
    expect(assistant?.layout).toEqual({
      mode: 'floating',
      position: 'bottom-right',
      panelWidth: 440,
      panelMinHeight: 580,
      panelMaxHeight: 700,
      edgeOffset: 24,
      zIndex: 150,
      density: 'comfortable',
      mobileFullscreen: true,
    });
    expect(assistant?.behavior).toEqual({
      startOpen: false,
      closeOnEscape: true,
      closeOnOutsideClick: false,
      showLauncher: true,
      showHeader: true,
      showAvatars: false,
      showTimestamps: false,
      showPoweredBy: false,
      showConfirmationDetails: false,
    });
    expect(assistant?.presentation).toEqual({
      panel: {
        surface: 'solid',
        elevation: 'soft',
        border: 'subtle',
        radius: 24,
      },
      launcher: {
        style: 'pill',
        icon: 'chat',
        size: 'lg',
        status: 'none',
        effect: 'none',
      },
      header: {
        mark: 'none',
      },
      composer: {
        leadingIcon: 'none',
        sendIcon: 'paper-plane',
        shape: 'pill',
      },
      messages: { userStyle: 'accent', assistantStyle: 'plain' },
    });
  });

  it('keeps repeated Tivmark marks out of the expanded assistant chrome', async () => {
    const manifest = await app.toManifest();
    const assistant = manifest.server.assistant;

    expect(assistant?.presentation?.launcher?.effect).toBe('none');
    expect(assistant?.presentation?.header?.mark).toBe('none');
    expect(assistant?.presentation?.composer?.leadingIcon).toBe('none');
    expect(assistant?.behavior?.showAvatars).toBe(false);
    expect(assistant?.behavior?.showTimestamps).toBe(false);
    expect(assistant?.behavior?.showPoweredBy).toBe(false);
  });

  it('tells Mark to lead with cards, not prose', async () => {
    const manifest = await app.toManifest();
    expect(manifest.server.instructions).toContain('Prefer tools over prose');
    expect(manifest.server.instructions).toContain(
      'never restate what the card already shows'
    );
  });

  it('gates every write behind an end-user confirmation', async () => {
    const manifest = await app.toManifest();
    const writes = [
      'book_time_off',
      'book_time_off_guided',
      'cancel_time_off_request',
      'order_equipment',
      'order_equipment_guided',
      'cancel_equipment_request',
      'review_time_off',
      'review_equipment',
      'fulfill_equipment',
      'complete_business_onboarding',
      'launch_new_hire',
    ];
    for (const tool of manifest.tools as Array<Record<string, unknown>>) {
      if (writes.includes(tool.name as string)) {
        expect(
          JSON.stringify(tool).includes('"confirm":true'),
          `${tool.name as string} should be confirm-gated`
        ).toBe(true);
      }
    }
  });
});
