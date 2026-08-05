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
        !tool.visibility || tool.visibility.includes('model'),
    );

    expect(
      modelVisibleTools.map((tool: { name: string }) => tool.name).sort(),
    ).toEqual(
      [
        // identity / teams
        'my_teams',
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
        // admin review (OWNER/ADMIN)
        'team_time_off_queue',
        'team_equipment_queue',
        'review_time_off',
        'review_equipment',
        'fulfill_equipment',
      ].sort(),
    );

    const appOnlyReviewTool = manifest.tools.find(
      (tool: { name: string }) => tool.name === 'review_time_off_app',
    ) as { visibility?: string[] };
    expect(appOnlyReviewTool.visibility).toEqual(['app']);
    expect(manifest.tools).toHaveLength(modelVisibleTools.length + 1);
  });

  it('publishes business-facing titles for every tool', async () => {
    const manifest = await app.toManifest();
    const titles = Object.fromEntries(
      manifest.tools.map((tool: { name: string; title?: string }) => [
        tool.name,
        tool.title,
      ]),
    );

    expect(titles).toEqual({
      book_time_off: 'Book time off',
      book_time_off_guided: 'Book time off with a form',
      cancel_equipment_request: 'Cancel equipment request',
      cancel_time_off_request: 'Cancel time-off request',
      fulfill_equipment: 'Fulfill equipment request',
      my_equipment: 'List my equipment requests',
      my_teams: 'List my teams',
      my_time_off: 'List my time-off requests',
      order_equipment: 'Request equipment',
      order_equipment_guided: 'Request equipment with a form',
      review_equipment: 'Review equipment request',
      review_time_off: 'Review time-off request',
      review_time_off_app: 'Review time-off request in app',
      team_equipment_queue: 'Open equipment review queue',
      team_time_off_queue: 'Open time-off review queue',
      time_off_balance: 'Check time-off balance',
    });
  });

  it('uses the team lookup as the portable application context provider', async () => {
    const manifest = await app.toManifest();
    const teamTool = manifest.tools.find(
      (tool: { name: string }) => tool.name === 'my_teams',
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
  });

  it('publishes the verified Tivmark subject for balance lookup', async () => {
    const manifest = await app.toManifest();
    const balanceTool = manifest.tools.find(
      (tool: { name: string }) => tool.name === 'time_off_balance',
    ) as {
      fulfilment?: { output?: { userId?: string } };
    };

    expect(balanceTool.fulfilment?.output?.userId).toBe('${user.subject}');
  });

  it('presents the embedded assistant as Mark with focused starter prompts', async () => {
    const manifest = await app.toManifest();

    expect(manifest.server.title).toBe('Mark');
    expect(manifest.server.branding?.name).toBe('Mark');
    expect(manifest.server.instructions).toContain(
      "You are Mark, Tivmark's people-ops assistant.",
    );
    expect(manifest.server.assistant?.labels).toMatchObject({
      welcomeHeading: 'How can Mark help?',
      welcomeMessage: 'Ask about your time off or equipment.',
      composerPlaceholder: 'Message Mark…',
      open: 'Open Mark',
      close: 'Close Mark',
    });
    expect(manifest.server.assistant?.suggestedPrompts).toEqual([
      'How much vacation do I have?',
      'Book time off',
      'Show my equipment requests',
      'Request equipment',
    ]);
  });

  it('does not expose conversational personalization', async () => {
    const manifest = await app.toManifest();

    expect(manifest.server.assistant?.sessionClaims).toBeUndefined();
    expect(manifest.server.instructions).not.toContain(
      'Address the user by name.',
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
    ];
    for (const tool of manifest.tools as Array<Record<string, unknown>>) {
      if (writes.includes(tool.name as string)) {
        expect(
          JSON.stringify(tool).includes('"confirm":true'),
          `${tool.name as string} should be confirm-gated`,
        ).toBe(true);
      }
    }
  });
});
