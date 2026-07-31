// @vitest-environment jsdom

import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { expect, it, vi } from 'vitest';

import { ReviewTimeOffQueueView } from '../src/views/review-time-off-queue.js';
import type { TimeOffRequestsViewState } from '../src/views/widget-data.js';

const reviewState: TimeOffRequestsViewState = {
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
        endDate: '2026-07-31',
        requestedHalfDays: 4,
        reason: 'Family trip',
        requesterName: 'Ada Lovelace',
      },
    ],
  },
};

it('disables one review row while approving and removes it on success', async () => {
  let resolveDecision!: () => void;
  const onDecision = vi.fn(
    () =>
      new Promise<void>((resolve) => {
        resolveDecision = resolve;
      })
  );
  render(
    <ReviewTimeOffQueueView
      theme="light"
      state={reviewState}
      onDecision={onDecision}
    />
  );

  fireEvent.click(screen.getByRole('button', { name: 'Approve' }));

  expect(screen.getByRole('button', { name: 'Approving…' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Decline' })).toBeDisabled();
  expect(onDecision).toHaveBeenCalledWith('leave-1', 'APPROVED');

  resolveDecision();

  await waitFor(() =>
    expect(screen.queryByText('Ada Lovelace')).not.toBeInTheDocument()
  );
  expect(screen.getByRole('status')).toHaveTextContent(
    'Approved Ada Lovelace.'
  );
  expect(screen.getByText("Nothing awaiting review. You're all caught up.")).toBeVisible();
});

it('keeps the row actionable and announces a retryable failure', async () => {
  const onDecision = vi.fn().mockRejectedValue(new Error('offline'));
  render(
    <ReviewTimeOffQueueView
      theme="dark"
      state={reviewState}
      onDecision={onDecision}
    />
  );

  fireEvent.click(screen.getByRole('button', { name: 'Decline' }));

  expect(
    await screen.findByText("Couldn't apply the decision. Try again.")
  ).toBeVisible();
  expect(screen.getByRole('alert')).toHaveTextContent(
    "Couldn't apply the decision. Try again."
  );
  expect(screen.getByText('Ada Lovelace')).toBeVisible();
  expect(screen.getByRole('button', { name: 'Approve' })).toBeEnabled();
  expect(screen.getByRole('button', { name: 'Decline' })).toBeEnabled();
});

it('keeps simultaneous review actions pending on their own rows', async () => {
  const resolvers = new Map<string, () => void>();
  const onDecision = vi.fn(
    (id: string) =>
      new Promise<void>((resolve) => {
        resolvers.set(id, resolve);
      })
  );
  const secondRequest = {
    id: 'leave-2',
    type: 'SICK',
    typeLabel: 'Sick',
    status: 'PENDING',
    statusLabel: 'Pending',
    startDate: '2026-08-03',
    endDate: '2026-08-03',
    requesterName: 'Grace Hopper',
  };
  const state: TimeOffRequestsViewState = {
    kind: 'ready',
    data: {
      ...(reviewState.kind === 'ready' ? reviewState.data : neverData()),
      pendingCount: 2,
      requests: [
        ...(reviewState.kind === 'ready'
          ? reviewState.data.requests
          : neverData()),
        secondRequest,
      ],
    },
  };

  render(
    <ReviewTimeOffQueueView
      theme="light"
      state={state}
      onDecision={onDecision}
    />
  );

  const rows = screen.getAllByRole('listitem');
  fireEvent.click(within(rows[0]).getByRole('button', { name: 'Approve' }));
  fireEvent.click(within(rows[1]).getByRole('button', { name: 'Decline' }));

  expect(
    within(rows[0]).getByRole('button', { name: 'Approving…' })
  ).toBeDisabled();
  expect(
    within(rows[1]).getByRole('button', { name: 'Declining…' })
  ).toBeDisabled();

  resolvers.get('leave-1')?.();
  resolvers.get('leave-2')?.();
  await waitFor(() =>
    expect(screen.queryByRole('listitem')).not.toBeInTheDocument()
  );
});

it('renders caught-up and partial-data states explicitly', () => {
  const { rerender } = render(
    <ReviewTimeOffQueueView
      theme="light"
      state={{ kind: 'empty', message: 'No time-off requests yet.' }}
      onDecision={vi.fn()}
    />
  );
  expect(
    screen.getByText("Nothing awaiting review. You're all caught up.")
  ).toBeVisible();

  rerender(
    <ReviewTimeOffQueueView
      theme="light"
      state={{
        kind: 'partial',
        data: reviewState.kind === 'ready' ? reviewState.data : neverData(),
        message: 'One request could not be displayed.',
      }}
      onDecision={vi.fn()}
    />
  );
  expect(screen.getByRole('alert')).toHaveTextContent(
    'One request could not be displayed.'
  );
  expect(screen.getByText('Ada Lovelace')).toBeVisible();
});

function neverData(): never {
  throw new Error('fixture invariant');
}
