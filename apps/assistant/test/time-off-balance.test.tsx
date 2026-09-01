// @vitest-environment jsdom

import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';

import { TimeOffBalanceView } from '../src/views/time-off-balance.js';
import type { BalanceViewState } from '../src/views/widget-data.js';

const readyState: BalanceViewState = {
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
};

it('renders limited balances with remaining allowance and pending time', () => {
  render(<TimeOffBalanceView theme="light" state={readyState} />);

  expect(
    screen.getByRole('heading', { name: 'Your time-off balance' })
  ).toBeVisible();
  expect(screen.getByText('Team acme · this year')).toBeVisible();
  expect(screen.getByText('14 days')).toBeVisible();
  expect(screen.getByText('of 20 days left')).toBeVisible();
  expect(screen.getByText('1 day pending')).toBeVisible();
  expect(
    screen.getByRole('progressbar', { name: 'Vacation remaining' })
  ).toHaveAttribute('aria-valuenow', '70');
});

it('renders unlimited balances without a misleading remaining meter', () => {
  render(<TimeOffBalanceView theme="dark" state={readyState} />);

  expect(screen.getByText('2 days used')).toBeVisible();
  expect(screen.getByText('Unlimited allowance')).toBeVisible();
  expect(
    screen.queryByRole('progressbar', { name: 'Sick remaining' })
  ).not.toBeInTheDocument();
});

it('renders a deterministic eligibility decision before booking', () => {
  const assessmentState: BalanceViewState = {
    kind: 'ready',
    data: {
      ...readyState.data,
      assessment: {
        status: 'Eligible to submit a pending request.',
        team: 'acme',
        userId: 'user-1',
        type: 'VACATION',
        startDate: '2026-09-04',
        endDate: '2026-09-04',
        eligible: true,
        decision: 'ELIGIBLE',
        reason:
          'The dates are weekdays, do not overlap existing time off, and fit the available balance.',
        requestedHalfDays: 2,
        pendingHalfDays: 2,
        availableBeforeHalfDays: 26,
        remainingAfterHalfDays: 24,
        conflict: null,
        checks: { weekday: true, noOverlap: true, withinBalance: true },
        policySource: 'Tivmark annual allowance, weekday, and overlap rules',
      },
    },
  };

  render(<TimeOffBalanceView theme="light" state={assessmentState} />);

  expect(
    screen.getByRole('heading', { name: 'Your time-off check' })
  ).toBeVisible();
  expect(screen.getByText('Eligible')).toBeVisible();
  expect(screen.getByText('Vacation · 1 day')).toBeVisible();
  expect(screen.getByText('13 days')).toBeVisible();
  expect(screen.getByText('12 days')).toBeVisible();
  expect(screen.getByText('No overlapping request')).toBeVisible();
  expect(
    screen.getByText(
      'Checked against Tivmark annual allowance, weekday, and overlap rules.'
    )
  ).toBeVisible();
});

it('distinguishes a missing policy from an unlimited allowance', () => {
  const unavailableState: BalanceViewState = {
    kind: 'ready',
    data: {
      ...readyState.data,
      assessment: {
        status: 'Not eligible: No matching policy balance is available.',
        team: 'acme',
        userId: 'user-1',
        type: 'PERSONAL',
        startDate: '2026-09-04',
        endDate: '2026-09-04',
        eligible: false,
        decision: 'POLICY_UNAVAILABLE',
        reason: 'No matching policy balance is available.',
        requestedHalfDays: 2,
        pendingHalfDays: 0,
        availableBeforeHalfDays: null,
        remainingAfterHalfDays: null,
        conflict: null,
        checks: { weekday: true, noOverlap: true, withinBalance: false },
        policySource: 'Tivmark annual allowance, weekday, and overlap rules',
      },
    },
  };

  render(
    <TimeOffBalanceView
      theme="light"
      state={unavailableState}
      onFollowUp={() => undefined}
    />
  );

  expect(screen.getByText('Not eligible')).toBeVisible();
  expect(screen.getAllByText('Unavailable')).toHaveLength(2);
  expect(screen.queryByText('Unlimited')).not.toBeInTheDocument();
  expect(screen.getByText('Try other dates')).toBeVisible();
});

it.each([
  [
    { kind: 'loading' } satisfies BalanceViewState,
    'status',
    'Loading your time-off balance…',
  ],
  [
    {
      kind: 'empty',
      message: 'No time-off policies are configured for this team yet.',
    } satisfies BalanceViewState,
    undefined,
    'No time-off policies are configured for this team yet.',
  ],
  [
    {
      kind: 'error',
      message: "We couldn't match these balances to your account.",
    } satisfies BalanceViewState,
    'alert',
    "We couldn't match these balances to your account.",
  ],
  [
    {
      kind: 'error',
      message: "We couldn't load your time-off balance.",
    } satisfies BalanceViewState,
    'alert',
    "We couldn't load your time-off balance.",
  ],
])('renders a visible non-ready state', (state, role, message) => {
  render(<TimeOffBalanceView theme="light" state={state} />);

  const feedback = role ? screen.getByRole(role) : screen.getByText(message);
  expect(feedback).toHaveTextContent(message);
});
