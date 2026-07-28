import { describe, expect, it } from 'vitest';
import app from '../src/server.js';

describe('tivmark_assistant', () => {
  it('exports a Noodle server definition', () => {
    expect(typeof app.toManifest).toBe('function');
  });

  it('exposes the people-ops tool surface (time-off, equipment, review)', async () => {
    const manifest = await app.toManifest();
    const toolNames = new Set(manifest.tools.map((t: { name: string }) => t.name));
    for (const name of [
      // identity / teams
      'greet',
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
    ]) {
      expect(toolNames.has(name), `missing tool: ${name}`).toBe(true);
    }
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

  it('presents the embedded assistant as Mark with focused starter prompts', async () => {
    const manifest = await app.toManifest();

    expect(manifest.server.title).toBe('Mark');
    expect(manifest.server.branding?.name).toBe('Mark');
    expect(manifest.server.instructions).toContain(
      "You are Mark, Tivmark's people-ops assistant."
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
          `${tool.name as string} should be confirm-gated`
        ).toBe(true);
      }
    }
  });
});
