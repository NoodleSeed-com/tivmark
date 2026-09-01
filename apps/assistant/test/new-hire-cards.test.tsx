// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';

import { NewHireLaunchPlanView } from '../src/views/new-hire-launch-plan.js';
import { NewHireReadyView } from '../src/views/new-hire-ready.js';

const plan = {
  status: 'PLANNED' as const,
  team: { id: 'team-1', name: 'Noodle', slug: 'noodle' },
  newHire: {
    name: 'Maya Chen',
    email: 'maya@example.com',
    jobTitle: 'Product Designer',
    startDate: '2026-10-05',
    workLocation: 'London',
    timeZone: 'Europe/London',
    role: 'MEMBER' as const,
  },
  equipment: {
    package: 'DESIGN' as const,
    label: 'Design equipment package',
    item: 'Design package — MacBook Pro and color-accurate monitor',
  },
  policies: [
    {
      type: 'VACATION',
      allowanceHalfDays: 40,
      allowanceDays: 20,
      assignment: 'ON_ACCEPTANCE' as const,
    },
  ],
  checklist: [
    {
      id: 'invitation',
      label: 'Team invitation',
      status: 'WILL_CREATE' as const,
    },
  ],
  authenticated: true,
};

it('shows the exact verified plan and continues through conversation', () => {
  const onFollowUp = vi.fn();
  render(
    <NewHireLaunchPlanView theme="light" data={plan} onFollowUp={onFollowUp} />
  );

  expect(screen.getByText('Maya Chen launch plan')).toBeDefined();
  expect(screen.getByText('Design equipment package')).toBeDefined();
  expect(screen.getByText(/no changes yet/i)).toBeDefined();
  fireEvent.click(screen.getByRole('button', { name: 'Launch this new hire' }));
  expect(onFollowUp).toHaveBeenCalledWith(
    'Launch this exact new-hire plan now.'
  );
});

it('renders the confirmed readiness receipt and opens Tivmark', () => {
  const onOpen = vi.fn();
  render(
    <NewHireReadyView
      theme="dark"
      data={{
        status: 'READY',
        launchId: 'launch-1',
        team: plan.team,
        newHire: plan.newHire,
        invitation: {
          id: 'invite-1',
          status: 'PENDING',
          expiresAt: '2026-09-08T00:00:00.000Z',
        },
        equipment: {
          ...plan.equipment,
          requestId: 'equipment-1',
          status: 'PENDING',
        },
        policies: plan.policies,
        checklist: [
          {
            id: 'invitation',
            label: 'Team invitation',
            status: 'COMPLETE',
          },
        ],
        nextSteps: [
          {
            id: 'people',
            label: 'Open people readiness',
            url: 'https://app.tivmark.com/teams/noodle/members',
          },
        ],
        createdAt: '2026-09-01T00:00:00.000Z',
        activatedAt: null,
        authenticated: true,
      }}
      onOpen={onOpen}
    />
  );

  expect(screen.getByText('Maya Chen is ready')).toBeDefined();
  expect(screen.getByText(/one confirmed transaction/i)).toBeDefined();
  fireEvent.click(
    screen.getByRole('button', { name: 'Open people readiness' })
  );
  expect(onOpen).toHaveBeenCalledWith(
    'https://app.tivmark.com/teams/noodle/members'
  );
});

it('never implies readiness when the receipt is malformed', () => {
  render(<NewHireReadyView theme="light" error />);
  expect(screen.getByRole('alert').textContent).toContain(
    'No success was assumed'
  );
  expect(screen.queryByText(/is ready/)).toBeNull();
});
