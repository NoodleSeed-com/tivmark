// @vitest-environment jsdom

import { render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';

const helpers = vi.hoisted(() => ({
  followUp: vi.fn(),
  useToolInfo: vi.fn(),
}));

vi.mock('../src/helpers.js', () => ({
  useLayout: () => ({ theme: 'dark', supports: { followUpMessage: true } }),
  useSendFollowUpMessage: () => helpers.followUp,
  useToolInfo: helpers.useToolInfo,
}));

import ActionDeskServices from '../src/views/action-desk-services.js';

afterEach(() => {
  vi.clearAllMocks();
});

it('binds to its named tool result and renders the live catalog shape', () => {
  helpers.useToolInfo.mockReturnValue({
    structuredContent: {
      team: 'noodle',
      services: [
        {
          id: 'service-1',
          teamId: 'team-1',
          slug: 'customer-support',
          name: 'Customer support',
          description: 'Get help with a product or account issue.',
          audience: 'CUSTOMER',
          active: true,
          slaHours: 8,
          requiresApproval: false,
          createdAt: '2026-09-01T12:00:00.000Z',
          updatedAt: '2026-09-01T12:00:00.000Z',
        },
      ],
    },
  });

  render(<ActionDeskServices />);

  expect(helpers.useToolInfo).toHaveBeenCalledWith('action_desk_services');
  expect(screen.getAllByText('Customer support')).toHaveLength(2);
  expect(screen.getByText('1 active')).toBeDefined();
  expect(screen.queryByRole('alert')).toBeNull();
});
