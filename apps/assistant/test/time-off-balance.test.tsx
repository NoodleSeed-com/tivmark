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
