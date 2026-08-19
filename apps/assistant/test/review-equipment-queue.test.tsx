// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';

import { ReviewEquipmentQueueView } from '../src/views/review-equipment-queue.js';
import type { EquipmentRequestsViewState } from '../src/views/widget-data.js';

const request = (id: string, item: string) => ({
  id,
  category: 'LAPTOP',
  categoryLabel: 'Laptop',
  item,
  quantity: 1,
  status: 'PENDING',
  statusLabel: 'Pending',
  requesterName: 'Pat',
  justification: 'Current one is failing.',
});

const ready = (
  ...requests: ReturnType<typeof request>[]
): EquipmentRequestsViewState => ({
  kind: 'ready',
  data: { team: 'engineering', requests },
});

it('removes a row once its decision succeeds', async () => {
  const onDecision = vi.fn().mockResolvedValue(undefined);
  render(
    <ReviewEquipmentQueueView
      theme="light"
      state={ready(request('r1', 'MacBook Pro'), request('r2', 'Dell U2723'))}
      onDecision={onDecision}
    />,
  );

  expect(screen.getAllByRole('listitem')).toHaveLength(2);
  fireEvent.click(screen.getAllByRole('button', { name: 'Approve' })[0]!);

  // The approved row leaves the queue. Scoped to the list because the success message
  // names the item too, so a document-wide text query would still match it.
  await waitFor(() => expect(screen.getAllByRole('listitem')).toHaveLength(1));
  expect(onDecision).toHaveBeenCalledWith('r1', 'APPROVED');
  expect(screen.getByRole('list')).toHaveTextContent('Dell U2723');
  expect(screen.getByRole('list')).not.toHaveTextContent('MacBook Pro');
  expect(screen.getByText('Approved MacBook Pro.')).toBeInTheDocument();
});

it('keeps the row actionable when the decision fails', async () => {
  const onDecision = vi.fn().mockRejectedValue(new Error('nope'));
  render(
    <ReviewEquipmentQueueView
      theme="light"
      state={ready(request('r1', 'MacBook Pro'))}
      onDecision={onDecision}
    />,
  );

  fireEvent.click(screen.getByRole('button', { name: 'Decline' }));

  await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
  // A failed decision must not look like it applied.
  expect(screen.getByText(/MacBook Pro/)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Decline' })).toBeEnabled();
});

it('reports being caught up rather than rendering an empty list', () => {
  render(
    <ReviewEquipmentQueueView
      theme="light"
      state={ready()}
      onDecision={vi.fn()}
    />,
  );

  expect(screen.getByText(/all caught up/i)).toBeInTheDocument();
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
});

it('shows the rows it could read while announcing partial data', () => {
  render(
    <ReviewEquipmentQueueView
      theme="light"
      state={{
        kind: 'partial',
        data: { team: 'engineering', requests: [request('r1', 'MacBook Pro')] },
        message: 'Some requests could not be shown.',
      }}
      onDecision={vi.fn()}
    />,
  );

  expect(screen.getByRole('alert')).toHaveTextContent(
    'Some requests could not be shown.',
  );
  expect(screen.getByText(/MacBook Pro/)).toBeInTheDocument();
});
