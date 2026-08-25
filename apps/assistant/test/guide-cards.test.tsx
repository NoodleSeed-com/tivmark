// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';

import { ExploreTivmarkView } from '../src/views/explore-tivmark.js';
import { TimeOffGuideView } from '../src/views/time-off-guide.js';

const exploreData = {
  tagline: 'Time off and equipment, handled.',
  features: [
    { title: 'Time off', detail: 'Balances and approvals per team.' },
    { title: 'Equipment', detail: 'Requests without a spreadsheet.' },
  ],
  stats: [{ value: '1-click', label: 'approvals' }],
  portalUrl: 'https://app.tivmark.com/?tab=login',
};

it('renders the overview card and opens the portal through the host', () => {
  const onOpen = vi.fn();
  render(
    <ExploreTivmarkView theme="light" data={exploreData} onOpen={onOpen} />
  );
  expect(screen.getByText('Time off and equipment, handled.')).toBeDefined();
  expect(screen.getByText('Balances and approvals per team.')).toBeDefined();
  fireEvent.click(screen.getByRole('button', { name: 'Open the portal' }));
  expect(onOpen).toHaveBeenCalledWith('https://app.tivmark.com/?tab=login');
});

it('offers follow-up chips that inject the next conversational turn', () => {
  const onFollowUp = vi.fn();
  render(
    <TimeOffGuideView
      theme="light"
      data={{
        leaveTypes: [
          { type: 'VACATION', label: 'Vacation', detail: 'Planned holiday.' },
        ],
        balanceParts: [{ term: 'Allowance', detail: 'what the team grants' }],
        note: 'Counted in half-days.',
      }}
      onFollowUp={onFollowUp}
    />
  );
  fireEvent.click(
    screen.getByRole('button', { name: 'What about equipment?' })
  );
  expect(onFollowUp).toHaveBeenCalledWith(
    'How do equipment requests work in Tivmark?'
  );
});

it('shows a loading state before the tool result arrives', () => {
  render(<ExploreTivmarkView theme="light" loading />);
  expect(screen.getByRole('status').textContent).toContain(
    'Loading the overview…'
  );
});
