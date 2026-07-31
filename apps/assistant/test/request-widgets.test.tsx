// @vitest-environment jsdom

import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';

import {
  EquipmentRequestsView,
} from '../src/views/equipment-requests.js';
import { TimeOffRequestsView } from '../src/views/time-off-requests.js';
import type {
  EquipmentRequestsViewState,
  TimeOffRequestsViewState,
} from '../src/views/widget-data.js';

const timeOffReady: TimeOffRequestsViewState = {
  kind: 'ready',
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
        endDate: '2026-07-30',
        requestedHalfDays: 2,
        reason: 'Family trip',
        requesterName: 'Ada Lovelace',
      },
    ],
  },
};

const equipmentReady: EquipmentRequestsViewState = {
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
        justification:
          'Mobile engineering work across customer sites and home offices',
        requesterName: 'Ada Lovelace',
      },
    ],
  },
};

it('renders a time-off request with product labels and full visible detail', () => {
  render(<TimeOffRequestsView theme="light" state={timeOffReady} />);

  expect(
    screen.getByRole('heading', { name: 'Your time-off requests' })
  ).toBeVisible();
  expect(screen.getByText('Team acme')).toBeVisible();
  expect(screen.getByText('1 pending')).toBeVisible();
  expect(screen.getByText('Vacation · Jul 30, 2026')).toBeVisible();
  expect(screen.getByText('1 day')).toBeVisible();
  expect(screen.getByText('Family trip')).toBeVisible();
  expect(screen.getByText('Pending')).toBeVisible();
});

it('renders an equipment request without truncating its justification', () => {
  render(<EquipmentRequestsView theme="dark" state={equipmentReady} />);

  expect(
    screen.getByRole('heading', { name: 'Your equipment requests' })
  ).toBeVisible();
  expect(screen.getByText('2 × MacBook Pro')).toBeVisible();
  expect(screen.getByText('Laptop')).toBeVisible();
  expect(
    screen.getByText(
      'Mobile engineering work across customer sites and home offices'
    )
  ).toBeVisible();
  expect(screen.getByText('Approved')).toBeVisible();
});

it('shows distinct intentional empty states', () => {
  const { rerender } = render(
    <TimeOffRequestsView
      theme="light"
      state={{ kind: 'empty', message: 'No time-off requests yet.' }}
    />
  );
  expect(screen.getByText('No time-off requests yet.')).toBeVisible();

  rerender(
    <EquipmentRequestsView
      theme="light"
      state={{ kind: 'empty', message: 'No equipment requests yet.' }}
    />
  );
  expect(screen.getByText('No equipment requests yet.')).toBeVisible();
});

it('keeps valid requests visible while announcing partial data', () => {
  render(
    <TimeOffRequestsView
      theme="light"
      state={{
        kind: 'partial',
        data: timeOffReady.kind === 'ready' ? timeOffReady.data : neverData(),
        message: 'One request could not be displayed.',
      }}
    />
  );

  expect(screen.getByRole('alert')).toHaveTextContent(
    'One request could not be displayed.'
  );
  expect(screen.getByText('Vacation · Jul 30, 2026')).toBeVisible();
});

function neverData(): never {
  throw new Error('fixture invariant');
}
