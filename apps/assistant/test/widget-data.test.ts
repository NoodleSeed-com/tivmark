import { describe, expect, it } from 'vitest';

import {
  formatDateRange,
  formatHalfDays,
  normalizeBalanceResult,
  normalizeEquipmentRequests,
  normalizeTimeOffRequests,
} from '../src/views/widget-data.js';

const limitedBalance = {
  allowanceHalfDays: 40,
  approvedHalfDays: 12,
  pendingHalfDays: 2,
  remainingHalfDays: 28,
};

describe('balance result normalization', () => {
  it('selects the signed-in user balance and preserves unlimited values', () => {
    expect(
      normalizeBalanceResult({
        team: 'acme',
        userId: 'user-1',
        balances: {
          'user-1': {
            VACATION: limitedBalance,
            SICK: {
              allowanceHalfDays: null,
              approvedHalfDays: 4,
              pendingHalfDays: 0,
              remainingHalfDays: null,
            },
          },
        },
      })
    ).toEqual({
      kind: 'ready',
      data: {
        team: 'acme',
        balances: [
          {
            type: 'VACATION',
            label: 'Vacation',
            allowanceHalfDays: 40,
            approvedHalfDays: 12,
            pendingHalfDays: 2,
            remainingHalfDays: 28,
          },
          {
            type: 'SICK',
            label: 'Sick',
            allowanceHalfDays: null,
            approvedHalfDays: 4,
            pendingHalfDays: 0,
            remainingHalfDays: null,
          },
        ],
      },
    });
  });

  it('reports a missing signed-in-user balance as incomplete data', () => {
    expect(
      normalizeBalanceResult({
        team: 'acme',
        userId: 'user-1',
        balances: { 'user-2': { VACATION: limitedBalance } },
      })
    ).toEqual({
      kind: 'error',
      message: "We couldn't match these balances to your account.",
    });
  });

  it('does not coerce malformed nullable fields to zero', () => {
    expect(
      normalizeBalanceResult({
        team: 'acme',
        userId: 'user-1',
        balances: {
          'user-1': {
            VACATION: { ...limitedBalance, remainingHalfDays: '28' },
          },
        },
      })
    ).toEqual({
      kind: 'error',
      message: 'The balance result was incomplete.',
    });
  });

  it('rejects inconsistent limited and unlimited balance fields', () => {
    expect(
      normalizeBalanceResult({
        team: 'acme',
        userId: 'user-1',
        balances: {
          'user-1': {
            VACATION: { ...limitedBalance, remainingHalfDays: null },
          },
        },
      })
    ).toEqual({
      kind: 'error',
      message: 'The balance result was incomplete.',
    });

    expect(
      normalizeBalanceResult({
        team: 'acme',
        userId: 'user-1',
        balances: {
          'user-1': {
            SICK: {
              allowanceHalfDays: null,
              approvedHalfDays: 4,
              pendingHalfDays: 0,
              remainingHalfDays: 20,
            },
          },
        },
      })
    ).toEqual({
      kind: 'error',
      message: 'The balance result was incomplete.',
    });
  });

  it('rejects negative balance counters', () => {
    expect(
      normalizeBalanceResult({
        team: 'acme',
        userId: 'user-1',
        balances: {
          'user-1': {
            VACATION: { ...limitedBalance, pendingHalfDays: -1 },
          },
        },
      })
    ).toEqual({
      kind: 'error',
      message: 'The balance result was incomplete.',
    });
  });

  it('distinguishes loading, host error, missing result, and no policies', () => {
    expect(normalizeBalanceResult(undefined, { pending: true })).toEqual({
      kind: 'loading',
    });
    expect(normalizeBalanceResult(undefined, { error: true })).toEqual({
      kind: 'error',
      message: "We couldn't load your time-off balance.",
    });
    expect(normalizeBalanceResult(undefined)).toEqual({
      kind: 'error',
      message: 'The balance result was incomplete.',
    });
    expect(
      normalizeBalanceResult({
        team: 'acme',
        userId: 'user-1',
        balances: { 'user-1': {} },
      })
    ).toEqual({
      kind: 'empty',
      message: 'No time-off policies are configured for this team yet.',
    });
  });
});

describe('request result normalization', () => {
  it('normalizes valid time-off requests and reports omitted malformed rows', () => {
    expect(
      normalizeTimeOffRequests({
        team: 'acme',
        requests: [
          {
            id: 'leave-1',
            type: 'VACATION',
            status: 'PENDING',
            startDate: '2026-07-30',
            endDate: '2026-07-31',
            requestedHalfDays: 4,
            reason: 'Family trip',
            requester: { id: 'user-1', name: 'Ada Lovelace' },
          },
          {
            id: 'leave-bad',
            type: 'SICK',
            status: 'PENDING',
            startDate: 20260730,
            endDate: '2026-07-30',
          },
        ],
      })
    ).toEqual({
      kind: 'partial',
      message: 'One request could not be displayed.',
      data: {
        team: 'acme',
        pendingCount: 1,
        requests: [
          {
            id: 'leave-1',
            type: 'VACATION',
            typeLabel: 'Vacation',
            status: 'PENDING',
            statusLabel: 'Pending',
            startDate: '2026-07-30',
            endDate: '2026-07-31',
            requestedHalfDays: 4,
            reason: 'Family trip',
            requesterName: 'Ada Lovelace',
          },
        ],
      },
    });
  });

  it('normalizes equipment requests without discarding visible details', () => {
    expect(
      normalizeEquipmentRequests({
        team: 'acme',
        requests: [
          {
            id: 'equipment-1',
            category: 'LAPTOP',
            item: 'MacBook Pro',
            quantity: 2,
            status: 'APPROVED',
            justification: 'Mobile engineering',
            requester: { id: 'user-1', name: 'Ada Lovelace' },
          },
        ],
      })
    ).toEqual({
      kind: 'ready',
      data: {
        team: 'acme',
        pendingCount: 0,
        requests: [
          {
            id: 'equipment-1',
            category: 'LAPTOP',
            categoryLabel: 'Laptop',
            item: 'MacBook Pro',
            quantity: 2,
            status: 'APPROVED',
            statusLabel: 'Approved',
            justification: 'Mobile engineering',
            requesterName: 'Ada Lovelace',
          },
        ],
      },
    });
  });

  it('omits invalid calendar dates before they can crash a widget render', () => {
    expect(
      normalizeTimeOffRequests({
        team: 'acme',
        requests: [
          {
            id: 'leave-1',
            type: 'VACATION',
            status: 'APPROVED',
            startDate: '2026-07-30',
            endDate: '2026-07-31',
          },
          {
            id: 'leave-bad-date',
            type: 'SICK',
            status: 'PENDING',
            startDate: '2026-02-30',
            endDate: 'not-a-date',
          },
        ],
      })
    ).toMatchObject({
      kind: 'partial',
      message: 'One request could not be displayed.',
      data: {
        requests: [{ id: 'leave-1' }],
      },
    });
  });

  it('rejects negative requested time that cannot be displayed truthfully', () => {
    expect(
      normalizeTimeOffRequests({
        team: 'acme',
        requests: [
          {
            id: 'leave-1',
            type: 'UNPAID',
            status: 'PENDING',
            startDate: '2026-08-07',
            endDate: '2026-08-07',
            requestedHalfDays: -2,
          },
        ],
      })
    ).toEqual({
      kind: 'error',
      message: 'The time-off request result was incomplete.',
    });
  });

  it('rejects blank equipment fields consumed as row labels', () => {
    expect(
      normalizeEquipmentRequests({
        team: 'acme',
        requests: [
          {
            id: 'equipment-1',
            category: 'LAPTOP',
            item: '',
            quantity: 1,
            status: 'PENDING',
          },
        ],
      })
    ).toEqual({
      kind: 'error',
      message: 'The equipment request result was incomplete.',
    });
  });

  it('distinguishes empty, malformed, loading, and host-error request results', () => {
    expect(normalizeTimeOffRequests({ team: 'acme', requests: [] })).toEqual({
      kind: 'empty',
      message: 'No time-off requests yet.',
    });
    expect(
      normalizeEquipmentRequests({
        team: 'acme',
        requests: [{ id: 'broken' }],
      })
    ).toEqual({
      kind: 'error',
      message: 'The equipment request result was incomplete.',
    });
    expect(normalizeTimeOffRequests(undefined, { pending: true })).toEqual({
      kind: 'loading',
    });
    expect(normalizeEquipmentRequests(undefined, { error: true })).toEqual({
      kind: 'error',
      message: "We couldn't load your equipment requests.",
    });
  });
});

describe('widget value formatting', () => {
  it('formats half-days without losing halves', () => {
    expect(formatHalfDays(1)).toBe('0.5 days');
    expect(formatHalfDays(2)).toBe('1 day');
    expect(formatHalfDays(5)).toBe('2.5 days');
  });

  it('formats single dates and ranges in the product date style', () => {
    expect(formatDateRange('2026-07-30', '2026-07-30')).toBe('Jul 30, 2026');
    expect(formatDateRange('2026-07-30', '2026-07-31')).toBe(
      'Jul 30 – Jul 31, 2026'
    );
  });
});
