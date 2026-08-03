import { describe, expect, it } from 'vitest';

import {
  equipmentRequestSchema,
  timeOffBalanceOutputSchema,
  timeOffRequestSchema,
} from '../src/views/widget-contracts.js';

describe('widget-consumed contracts', () => {
  it('accepts canonical time-off rows while allowing harmless upstream fields', () => {
    expect(
      timeOffRequestSchema.safeParse({
        id: 'leave-1',
        type: 'UNPAID',
        status: 'PENDING',
        startDate: '2026-08-07',
        endDate: '2026-08-07',
        requestedHalfDays: 2,
        reason: null,
        requester: {
          id: 'user-1',
          name: 'Ada Lovelace',
          email: 'ada@example.com',
        },
        createdAt: '2026-08-03T18:00:00.000Z',
        extraUpstreamField: true,
      }).success
    ).toBe(true);
  });

  it('rejects mutation timestamps where widgets require calendar dates', () => {
    expect(
      timeOffRequestSchema.safeParse({
        id: 'leave-1',
        type: 'UNPAID',
        status: 'PENDING',
        startDate: '2026-08-07T00:00:00.000Z',
        endDate: '2026-08-07T00:00:00.000Z',
      }).success
    ).toBe(false);
  });

  it('rejects malformed fields consumed by the equipment widget', () => {
    expect(
      equipmentRequestSchema.safeParse({
        id: 'equipment-1',
        category: 'LAPTOP',
        item: 'MacBook Pro',
        quantity: '1',
        status: 'PENDING',
      }).success
    ).toBe(false);
  });

  it('validates every numeric field consumed by the balance widget', () => {
    const valid = {
      team: 'acme',
      userId: 'user-1',
      balances: {
        'user-1': {
          VACATION: {
            allowanceHalfDays: 30,
            approvedHalfDays: 2,
            pendingHalfDays: 2,
            remainingHalfDays: 28,
          },
          UNPAID: {
            allowanceHalfDays: null,
            approvedHalfDays: 0,
            pendingHalfDays: 0,
            remainingHalfDays: null,
          },
        },
      },
    };

    expect(timeOffBalanceOutputSchema.safeParse(valid).success).toBe(true);
    expect(
      timeOffBalanceOutputSchema.safeParse({
        ...valid,
        balances: {
          'user-1': {
            VACATION: {
              ...valid.balances['user-1'].VACATION,
              pendingHalfDays: -1,
            },
          },
        },
      }).success
    ).toBe(false);
  });
});
