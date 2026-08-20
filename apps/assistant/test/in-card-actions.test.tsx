// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';

import { EquipmentRequestsView } from '../src/views/equipment-requests.js';
import { TimeOffRequestsView } from '../src/views/time-off-requests.js';
import { TimeOffBalanceView } from '../src/views/time-off-balance.js';
import type {
  BalanceViewState,
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
      },
      {
        id: 'leave-2',
        type: 'SICK',
        typeLabel: 'Sick',
        status: 'DECLINED',
        statusLabel: 'Declined',
        startDate: '2026-08-01',
        endDate: '2026-08-01',
      },
    ],
  },
};

const equipmentReady: EquipmentRequestsViewState = {
  kind: 'ready',
  data: {
    team: 'acme',
    pendingCount: 1,
    requests: [
      {
        id: 'equipment-1',
        category: 'LAPTOP',
        categoryLabel: 'Laptop',
        item: 'MacBook Pro',
        quantity: 1,
        status: 'PENDING',
        statusLabel: 'Pending',
      },
    ],
  },
};

const balanceReady: BalanceViewState = {
  kind: 'ready',
  data: {
    team: 'acme',
    balances: [
      {
        type: 'VACATION',
        label: 'Vacation',
        allowanceHalfDays: 50,
        approvedHalfDays: 10,
        pendingHalfDays: 0,
        remainingHalfDays: 40,
      },
    ],
  },
};

it('cancels a time-off request only after the in-card confirm step', async () => {
  const onCancel = vi.fn().mockResolvedValue(undefined);
  render(
    <TimeOffRequestsView theme="light" state={timeOffReady} onCancel={onCancel} />
  );

  // Only the cancellable (pending) row offers Cancel; the declined row shows none.
  const cancelButtons = screen.getAllByRole('button', { name: 'Cancel' });
  expect(cancelButtons).toHaveLength(1);

  // First click arms the confirm strip -- nothing is called yet.
  fireEvent.click(cancelButtons[0]!);
  expect(onCancel).not.toHaveBeenCalled();

  // Declining the confirm keeps the request.
  fireEvent.click(screen.getByRole('button', { name: 'Keep' }));
  expect(screen.queryByRole('button', { name: 'Yes, cancel' })).toBeNull();
  expect(onCancel).not.toHaveBeenCalled();

  // Confirming calls the app tool with the row id and flips the row to Canceled.
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  fireEvent.click(screen.getByRole('button', { name: 'Yes, cancel' }));
  expect(onCancel).toHaveBeenCalledWith('leave-1');
  await waitFor(() => {
    expect(screen.getByText('Canceled')).toBeDefined();
  });
  expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull();
});

it('keeps the row actionable when the cancel fails', async () => {
  const onCancel = vi.fn().mockRejectedValue(new Error('offline'));
  render(
    <EquipmentRequestsView
      theme="light"
      state={equipmentReady}
      onCancel={onCancel}
    />
  );

  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  fireEvent.click(screen.getByRole('button', { name: 'Yes, cancel' }));

  await waitFor(() => {
    expect(screen.getByRole('alert').textContent).toContain(
      "Couldn't cancel that request."
    );
  });
  // The confirm strip is still armed and the action still available.
  expect(screen.getByRole('button', { name: 'Yes, cancel' })).toBeDefined();
  expect(screen.getByText('Pending')).toBeDefined();
});

it('hides every cancel affordance without an onCancel handler', () => {
  render(<TimeOffRequestsView theme="light" state={timeOffReady} />);
  expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull();
});

it('sends the exact follow-up prompt from a chip and hides chips when unsupported', async () => {
  const onFollowUp = vi.fn().mockResolvedValue(undefined);
  const { rerender } = render(
    <TimeOffBalanceView
      theme="light"
      state={balanceReady}
      onFollowUp={onFollowUp}
    />
  );

  fireEvent.click(screen.getByRole('button', { name: 'Book time off' }));
  expect(onFollowUp).toHaveBeenCalledWith('Book time off');
  // Chips disable while a send is in flight; wait for the first send to settle.
  await waitFor(() => {
    expect(
      (screen.getByRole('button', { name: 'Show my requests' }) as HTMLButtonElement)
        .disabled
    ).toBe(false);
  });
  fireEvent.click(screen.getByRole('button', { name: 'Show my requests' }));
  expect(onFollowUp).toHaveBeenCalledWith('Show me my time-off requests');

  rerender(<TimeOffBalanceView theme="light" state={balanceReady} />);
  expect(screen.queryByRole('button', { name: 'Book time off' })).toBeNull();
});
