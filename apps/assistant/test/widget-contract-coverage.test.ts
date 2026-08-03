import { describe, expect, it } from 'vitest';

import app from '../src/server.js';

type WidgetContract = {
  readonly component: string;
  readonly itemFields?: readonly string[];
  readonly balanceFields?: readonly string[];
};

const widgetContracts = {
  time_off_balance: {
    component: 'time-off-balance',
    balanceFields: [
      'allowanceHalfDays',
      'approvedHalfDays',
      'pendingHalfDays',
      'remainingHalfDays',
    ],
  },
  my_time_off: {
    component: 'time-off-requests',
    itemFields: ['id', 'type', 'status', 'startDate', 'endDate'],
  },
  book_time_off: {
    component: 'time-off-requests',
    itemFields: ['id', 'type', 'status', 'startDate', 'endDate'],
  },
  my_equipment: {
    component: 'equipment-requests',
    itemFields: ['id', 'category', 'item', 'quantity', 'status'],
  },
  order_equipment: {
    component: 'equipment-requests',
    itemFields: ['id', 'category', 'item', 'quantity', 'status'],
  },
  team_time_off_queue: {
    component: 'review-time-off-queue',
    itemFields: ['id', 'type', 'status', 'startDate', 'endDate'],
  },
} satisfies Record<string, WidgetContract>;

type JsonSchema = {
  readonly type?: string;
  readonly properties?: Record<string, JsonSchema>;
  readonly required?: readonly string[];
  readonly items?: JsonSchema;
  readonly additionalProperties?: JsonSchema | boolean;
  readonly minimum?: number;
  readonly maximum?: number;
  readonly minLength?: number;
  readonly pattern?: string;
};

describe('manifest widget contract coverage', () => {
  it('requires a registered contract for every widget-producing tool', async () => {
    const manifest = await app.toManifest();
    const actual = manifest.widgets
      .map((widget) => [widget.tool, widget.view.component] as const)
      .sort(([left], [right]) => left.localeCompare(right));
    const expected = Object.entries(widgetContracts)
      .map(([tool, contract]) => [tool, contract.component] as const)
      .sort(([left], [right]) => left.localeCompare(right));

    expect(actual).toEqual(expected);
  });

  it('declares every field consumed by each registered widget', async () => {
    const manifest = await app.toManifest();

    for (const [toolName, contract] of Object.entries(widgetContracts)) {
      const tool = manifest.tools.find((candidate) => candidate.name === toolName);
      expect(tool, `missing manifest tool ${toolName}`).toBeDefined();
      const output = tool?.outputSchema as JsonSchema;

      expect(output.required, `${toolName} must require team`).toContain('team');

      if (contract.itemFields) {
        expect(output.required, `${toolName} must require requests`).toContain(
          'requests'
        );
        const item = output.properties?.requests?.items;
        for (const field of contract.itemFields) {
          expect(
            item?.properties ?? {},
            `${toolName} request items must declare ${field}`
          ).toHaveProperty(field);
          expect(
            item?.required,
            `${toolName} request items must require ${field}`
          ).toContain(field);
        }

        if (contract.component.includes('time-off')) {
          expect(item?.properties?.startDate?.pattern).toBe(
            '^\\d{4}-\\d{2}-\\d{2}$'
          );
          expect(item?.properties?.endDate?.pattern).toBe(
            '^\\d{4}-\\d{2}-\\d{2}$'
          );
          expect(item?.properties?.type?.minLength).toBe(1);
          expect(item?.properties?.status?.minLength).toBe(1);
        }

        if (contract.component === 'equipment-requests') {
          expect(item?.properties?.item?.minLength).toBe(1);
          expect(item?.properties?.quantity).toMatchObject({
            type: 'integer',
            minimum: 1,
            maximum: 20,
          });
          expect(item?.properties?.status?.minLength).toBe(1);
        }
      }

      if (contract.balanceFields) {
        expect(output.required, `${toolName} must require balances`).toContain(
          'balances'
        );
        const balance = recordValue(recordValue(output.properties?.balances));
        for (const field of contract.balanceFields) {
          expect(
            balance?.properties ?? {},
            `${toolName} balances must declare ${field}`
          ).toHaveProperty(field);
          expect(
            balance?.required,
            `${toolName} balances must require ${field}`
          ).toContain(field);
        }
        expect(balance?.properties?.approvedHalfDays?.minimum).toBe(0);
        expect(balance?.properties?.pendingHalfDays?.minimum).toBe(0);
      }
    }
  });
});

function recordValue(schema: JsonSchema | undefined) {
  return typeof schema?.additionalProperties === 'object'
    ? schema.additionalProperties
    : undefined;
}
