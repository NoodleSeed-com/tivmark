import {
  assessTimeOffEligibility,
  buildTimeOffReceipt,
  calculateRequestedHalfDays,
  countWeekdays,
  DEFAULT_TIME_OFF_ALLOWANCES,
  formatDateOnly,
  halfDaysToDays,
  parseDateOnly,
  serializeTimeOffRequest,
} from '@/lib/timeOff';

const user = { id: 'user-1', name: 'Ada', email: 'ada@example.com' };
const balances = {
  'user-1': {
    VACATION: {
      allowanceHalfDays: 30,
      approvedHalfDays: 0,
      pendingHalfDays: 0,
      remainingHalfDays: 30,
    },
    SICK: {
      allowanceHalfDays: 20,
      approvedHalfDays: 0,
      pendingHalfDays: 0,
      remainingHalfDays: 20,
    },
    PERSONAL: {
      allowanceHalfDays: 6,
      approvedHalfDays: 0,
      pendingHalfDays: 0,
      remainingHalfDays: 6,
    },
    UNPAID: {
      allowanceHalfDays: null,
      approvedHalfDays: 0,
      pendingHalfDays: 0,
      remainingHalfDays: null,
    },
  },
};

const request = {
  id: 'leave-1',
  type: 'VACATION' as const,
  status: 'PENDING' as const,
  startDate: '2026-09-11',
  endDate: '2026-09-11',
  duration: 'FULL_DAY' as const,
  halfDayPeriod: null,
  requestedHalfDays: 2,
  reason: null,
  reviewNote: null,
  reviewedAt: null,
  createdAt: '2026-09-01T00:00:00.000Z',
  requester: user,
  reviewer: null,
};

describe('time-off date and allowance rules', () => {
  it('stores the configured defaults in half-day units', () => {
    expect(DEFAULT_TIME_OFF_ALLOWANCES).toEqual({
      VACATION: 30,
      SICK: 20,
      PERSONAL: 6,
      UNPAID: null,
    });
    expect(halfDaysToDays(DEFAULT_TIME_OFF_ALLOWANCES.VACATION!)).toBe(15);
  });

  it('counts weekdays while excluding weekends', () => {
    expect(countWeekdays('2026-07-10', '2026-07-13')).toBe(2);
    expect(countWeekdays('2026-07-06', '2026-07-10')).toBe(5);
  });

  it('calculates full-day ranges in half-day units', () => {
    expect(
      calculateRequestedHalfDays({
        startDate: '2026-07-06',
        endDate: '2026-07-10',
        duration: 'FULL_DAY',
      })
    ).toBe(10);
  });

  it('accepts one weekday half day', () => {
    expect(
      calculateRequestedHalfDays({
        startDate: '2026-07-10',
        endDate: '2026-07-10',
        duration: 'HALF_DAY',
      })
    ).toBe(1);
  });

  it.each([
    ['2026-07-11', '2026-07-11', 'HALF_DAY', 'weekday'],
    ['2026-07-10', '2026-07-13', 'HALF_DAY', 'single date'],
    ['2026-12-31', '2027-01-01', 'FULL_DAY', 'calendar years'],
    ['2026-07-13', '2026-07-10', 'FULL_DAY', 'on or after'],
  ] as const)(
    'rejects an invalid request from %s to %s',
    (startDate, endDate, duration, message) => {
      expect(() =>
        calculateRequestedHalfDays({ startDate, endDate, duration })
      ).toThrow(message);
    }
  );

  it('rejects malformed and impossible calendar dates', () => {
    expect(() => parseDateOnly('07/10/2026')).toThrow('YYYY-MM-DD');
    expect(() => parseDateOnly('2026-02-30')).toThrow('calendar date');
  });

  it('formats date-only values without local timezone drift', () => {
    expect(formatDateOnly(new Date('2026-07-10T23:30:00.000Z'))).toBe(
      '2026-07-10'
    );
  });

  it('returns a deterministic eligibility decision from authoritative workspace data', () => {
    expect(
      assessTimeOffEligibility({
        team: 'noodle',
        userId: user.id,
        type: 'VACATION',
        startDate: '2026-09-11',
        endDate: '2026-09-11',
        balances,
        requests: [],
      })
    ).toMatchObject({
      team: 'noodle',
      userId: user.id,
      eligible: true,
      decision: 'ELIGIBLE',
      requestedHalfDays: 2,
      availableBeforeHalfDays: 30,
      remainingAfterHalfDays: 28,
      conflict: null,
    });
  });

  it('rejects an overlap for the signed-in user but ignores another member', () => {
    const otherRequest = {
      ...request,
      id: 'leave-other',
      requester: { ...user, id: 'user-2' },
    };
    const ownRequest = { ...request, id: 'leave-own' };

    expect(
      assessTimeOffEligibility({
        team: 'noodle',
        userId: user.id,
        type: 'VACATION',
        startDate: '2026-09-11',
        endDate: '2026-09-11',
        balances,
        requests: [otherRequest],
      }).decision
    ).toBe('ELIGIBLE');
    expect(
      assessTimeOffEligibility({
        team: 'noodle',
        userId: user.id,
        type: 'VACATION',
        startDate: '2026-09-11',
        endDate: '2026-09-11',
        balances,
        requests: [ownRequest],
      })
    ).toMatchObject({
      eligible: false,
      decision: 'OVERLAP',
      conflict: { id: 'leave-own' },
    });
  });

  it('builds the post-write receipt from the refreshed workspace balance', () => {
    const refreshedBalances = {
      ...balances,
      'user-1': {
        ...balances['user-1'],
        VACATION: { ...balances['user-1'].VACATION, pendingHalfDays: 2 },
      },
    };

    expect(
      buildTimeOffReceipt({
        team: 'noodle',
        userId: user.id,
        request,
        balances: refreshedBalances,
      })
    ).toEqual({
      requestId: 'leave-1',
      status: 'PENDING',
      team: 'noodle',
      type: 'VACATION',
      startDate: '2026-09-11',
      endDate: '2026-09-11',
      requestedHalfDays: 2,
      pendingHalfDays: 2,
      remainingAfterPendingHalfDays: 28,
      authenticated: true,
    });
  });

  it('serializes mutation records with the same date-only contract as list records', () => {
    expect(
      serializeTimeOffRequest({
        id: 'leave-1',
        type: 'UNPAID',
        status: 'PENDING',
        startDate: new Date('2026-08-07T00:00:00.000Z'),
        endDate: new Date('2026-08-07T00:00:00.000Z'),
        duration: 'FULL_DAY',
        halfDayPeriod: null,
        requestedHalfDays: 2,
        reason: null,
        reviewNote: null,
        reviewedAt: null,
        createdAt: new Date('2026-08-03T18:00:00.000Z'),
        requester: {
          id: 'user-1',
          name: 'Ada',
          email: 'ada@example.com',
        },
        reviewer: null,
      })
    ).toEqual({
      id: 'leave-1',
      type: 'UNPAID',
      status: 'PENDING',
      startDate: '2026-08-07',
      endDate: '2026-08-07',
      duration: 'FULL_DAY',
      halfDayPeriod: null,
      requestedHalfDays: 2,
      reason: null,
      reviewNote: null,
      reviewedAt: null,
      createdAt: '2026-08-03T18:00:00.000Z',
      requester: {
        id: 'user-1',
        name: 'Ada',
        email: 'ada@example.com',
      },
      reviewer: null,
    });
  });
});
