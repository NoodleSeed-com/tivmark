// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';

import { TimeOffReceiptView } from '../src/views/time-off-receipt.js';
import { normalizeBookingReceipt } from '../src/views/widget-data.js';
import type { BookingReceiptViewState } from '../src/views/widget-data.js';

const readyState: BookingReceiptViewState = {
  kind: 'ready',
  data: {
    team: 'acme',
    status: 'Requested VACATION from 2026-09-04 to 2026-09-04.',
    request: {
      id: 'leave-1',
      type: 'VACATION',
      typeLabel: 'Vacation',
      status: 'PENDING',
      statusLabel: 'Pending',
      startDate: '2026-09-04',
      endDate: '2026-09-04',
      requestedHalfDays: 2,
    },
    receipt: {
      requestId: 'leave-1',
      status: 'PENDING',
      team: 'acme',
      type: 'VACATION',
      startDate: '2026-09-04',
      endDate: '2026-09-04',
      requestedHalfDays: 2,
      pendingHalfDays: 4,
      remainingAfterPendingHalfDays: 24,
      authenticated: true,
    },
  },
};

it('renders the authenticated request receipt and projected balance', () => {
  render(<TimeOffReceiptView theme="light" state={readyState} />);

  expect(
    screen.getByRole('heading', { name: 'Request submitted' })
  ).toBeVisible();
  expect(screen.getByText('Pending')).toBeVisible();
  expect(screen.getByText('Vacation · 1 day')).toBeVisible();
  expect(screen.getByText('12 days')).toBeVisible();
  expect(screen.getByText('leave-1')).toBeVisible();
  expect(
    screen.getByText(
      'Verified identity · delegated authorization · confirmed write'
    )
  ).toBeVisible();
});

it('cancels only after an explicit in-card confirmation', async () => {
  const onCancel = vi.fn().mockResolvedValue(undefined);
  render(
    <TimeOffReceiptView
      theme="light"
      state={readyState}
      onCancel={onCancel}
    />
  );

  fireEvent.click(screen.getByRole('button', { name: 'Cancel request' }));
  expect(onCancel).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Yes, cancel' }));

  expect(onCancel).toHaveBeenCalledWith('leave-1');
  await waitFor(() => {
    expect(
      screen.getByRole('heading', { name: 'Request canceled' })
    ).toBeVisible();
  });
  expect(screen.queryByRole('button', { name: 'Cancel request' })).toBeNull();
});

it('rejects a receipt that does not match the created request', () => {
  expect(
    normalizeBookingReceipt({
      team: 'acme',
      status: 'Submitted',
      request: {
        id: 'leave-1',
        type: 'VACATION',
        status: 'PENDING',
        startDate: '2026-09-04',
        endDate: '2026-09-04',
      },
      receipt: {
        ...readyState.data.receipt,
        requestId: 'different-request',
      },
    })
  ).toEqual({
    kind: 'error',
    message: 'The booking receipt did not match the request.',
  });
});
