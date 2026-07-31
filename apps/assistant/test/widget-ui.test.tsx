// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';

import {
  BalanceTile,
  StatusBadge,
  WidgetAction,
  WidgetFeedback,
  WidgetFrame,
} from '../src/views/widget-ui.js';

it('renders Tivmark widget semantics through reusable components', () => {
  const onClick = vi.fn();
  render(
    <WidgetFrame
      theme="light"
      title="Your time-off balance"
      subtitle="Team acme · this year"
      icon={<span aria-hidden="true">T</span>}
    >
      <BalanceTile
        label="Vacation"
        value="14 days"
        detail="of 20 days left"
        progress={70}
        pending="1 day pending"
      />
      <StatusBadge status="APPROVED" />
      <WidgetAction tone="success" onClick={onClick}>
        Approve
      </WidgetAction>
    </WidgetFrame>
  );

  expect(
    screen.getByRole('heading', { name: 'Your time-off balance' })
  ).toBeVisible();
  expect(screen.getByText('14 days')).toBeVisible();
  expect(screen.getByText('Approved')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Approve' }));
  expect(onClick).toHaveBeenCalledOnce();
});

it('gives failures alert semantics and loading status semantics', () => {
  const { rerender } = render(
    <WidgetFeedback kind="loading">Loading your balance…</WidgetFeedback>
  );
  expect(screen.getByRole('status')).toHaveTextContent(
    'Loading your balance…'
  );

  rerender(
    <WidgetFeedback kind="error">Could not load your balance.</WidgetFeedback>
  );
  expect(screen.getByRole('alert')).toHaveTextContent(
    'Could not load your balance.'
  );

  rerender(
    <WidgetFeedback kind="partial">
      One request could not be displayed.
    </WidgetFeedback>
  );
  expect(screen.getByRole('alert')).toHaveTextContent(
    'One request could not be displayed.'
  );
});

it('preserves native pending and disabled action behavior', () => {
  render(
    <WidgetAction pending pendingLabel="Approving…">
      Approve
    </WidgetAction>
  );

  expect(screen.getByRole('button', { name: 'Approving…' })).toBeDisabled();
  expect(screen.getByRole('button')).toHaveAttribute('aria-busy', 'true');
});
