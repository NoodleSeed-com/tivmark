import { describe, expect, it } from 'vitest';

import app from '../src/server.js';

describe('public-to-action time-off journey', () => {
  it('uses the balance tool as the eligibility planning read', async () => {
    const manifest = await app.toManifest();
    const planningTool = manifest.tools.find(
      (tool: { name: string }) => tool.name === 'time_off_balance',
    ) as
      | {
          inputSchema?: {
            properties?: Record<string, unknown>;
          };
          outputSchema?: {
            properties?: Record<string, unknown>;
          };
        }
      | undefined;

    expect(planningTool).toBeDefined();
    expect(planningTool?.inputSchema?.properties).toHaveProperty('type');
    expect(planningTool?.inputSchema?.properties).toHaveProperty('startDate');
    expect(planningTool?.inputSchema?.properties).toHaveProperty('endDate');
    expect(planningTool?.outputSchema?.properties).toHaveProperty('assessment');

    const flow = JSON.stringify(planningTool);
    expect(flow).toContain('tiv.get_balances');
    expect(flow).toContain('"type":"${input.type}"');
    expect(flow).toContain('"startDate":"${input.startDate}"');
    expect(flow).toContain('"endDate":"${input.endDate}"');
    expect(flow).not.toContain('tiv.list_time_off');
    expect(flow).not.toContain('planning.assess');
    expect(manifest.connectors).not.toHaveProperty('planning');
  });

  it('returns a dedicated authenticated receipt after the confirmed write', async () => {
    const manifest = await app.toManifest();
    const bookingTool = manifest.tools.find(
      (tool: { name: string }) => tool.name === 'book_time_off',
    );
    const bookingWidget = manifest.widgets.find(
      (widget: { tool: string }) => widget.tool === 'book_time_off',
    );

    expect(bookingTool?.outputSchema.properties).toHaveProperty('receipt');
    expect(JSON.stringify(bookingTool)).toContain(
      '"receipt":"${steps.create_time_off.receipt}"',
    );
    expect(JSON.stringify(bookingTool)).not.toContain('planning.receipt');
    expect(JSON.stringify(bookingTool)).toContain('"confirm":true');
    expect(bookingWidget?.view.component).toBe('time-off-receipt');
  });

  it('publishes a guided assess-then-book workflow and the exact demo prompt', async () => {
    const manifest = await app.toManifest();
    const guide = manifest.server.agentGuide as
      | {
          workflows?: Array<{
            id: string;
            steps: Array<{ capability: { kind: string; name: string } }>;
          }>;
          examples?: Array<{ prompt: string; workflow: string }>;
        }
      | undefined;
    const workflow = guide?.workflows?.find(
      (candidate) => candidate.id === 'book_time_off_if_eligible',
    );

    expect(workflow?.steps.map((step) => step.capability)).toEqual([
      { kind: 'tool', name: 'time_off_guide' },
      { kind: 'tool', name: 'time_off_balance' },
      { kind: 'tool', name: 'book_time_off' },
    ]);
    expect(guide?.examples).toContainEqual({
      prompt: 'Can I take next Friday off? If so, book it.',
      workflow: 'book_time_off_if_eligible',
    });
    expect(manifest.server.assistant?.suggestedPrompts).toContain(
      'Can I take next Friday off? If so, book it.',
    );
  });

  it('uses only supported verified identity expressions in every tool flow', async () => {
    const manifest = await app.toManifest();
    expect(JSON.stringify(manifest.tools)).not.toContain('${user.id}');
  });
});
