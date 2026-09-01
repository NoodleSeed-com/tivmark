// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';

import { WorkspaceBlueprintView } from '../src/views/workspace-blueprint.js';
import { WorkspaceReadyView } from '../src/views/workspace-ready.js';

const blueprint = {
  businessName: 'Acme Studio',
  teamSize: '11-50' as const,
  timeZone: 'America/Los_Angeles',
  primaryGoal: 'BOTH' as const,
  vacationAllowanceDays: 20,
  sickAllowanceDays: 10,
  personalAllowanceDays: 3,
};

it('shows the anonymous blueprint and sends the activation turn through the host', () => {
  const onFollowUp = vi.fn();
  render(
    <WorkspaceBlueprintView
      theme="light"
      data={blueprint}
      onFollowUp={onFollowUp}
    />
  );

  expect(screen.getByText('Acme Studio blueprint')).toBeDefined();
  expect(screen.getByText('20 days')).toBeDefined();
  expect(screen.getByText(/nothing created yet/i)).toBeDefined();

  fireEvent.click(
    screen.getByRole('button', { name: 'Create this workspace' })
  );
  expect(onFollowUp).toHaveBeenCalledWith(
    'Create this workspace from the blueprint.'
  );
});

it('renders the authenticated receipt and opens a next step through the host', () => {
  const onOpen = vi.fn();
  render(
    <WorkspaceReadyView
      theme="dark"
      data={{
        status: 'READY',
        team: {
          id: 'team-1',
          name: 'Acme Studio',
          slug: 'acme-studio',
          teamSize: '11-50',
          timeZone: 'America/Los_Angeles',
          primaryGoal: 'BOTH',
          primaryGoalLabel: 'Time off and equipment',
          onboardingCompletedAt: '2026-09-01T18:00:00.000Z',
        },
        policies: [
          {
            type: 'VACATION',
            allowanceHalfDays: 40,
            allowanceDays: 20,
          },
          { type: 'UNPAID', allowanceHalfDays: null, allowanceDays: null },
        ],
        nextSteps: [
          {
            id: 'time-off',
            label: 'Review time-off workspace',
            url: 'https://app.tivmark.com/teams/acme-studio/time-off',
          },
        ],
        authenticated: true,
      }}
      onOpen={onOpen}
    />
  );

  expect(screen.getByText('Acme Studio is ready')).toBeDefined();
  expect(screen.getByText(/Verified identity/)).toBeDefined();
  fireEvent.click(
    screen.getByRole('button', { name: 'Review time-off workspace' })
  );
  expect(onOpen).toHaveBeenCalledWith(
    'https://app.tivmark.com/teams/acme-studio/time-off'
  );
});

it('never implies success when the receipt is missing', () => {
  render(<WorkspaceReadyView theme="light" error />);
  expect(screen.getByRole('alert').textContent).toContain(
    'No success was assumed'
  );
  expect(screen.queryByText(/is ready/)).toBeNull();
});
