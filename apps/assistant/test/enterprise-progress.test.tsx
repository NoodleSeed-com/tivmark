// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import EnterpriseProgress from '../src/views/enterprise-progress.js';

const host = vi.hoisted(() => ({
  ready: true,
  info: {} as Record<string, unknown>,
  open: vi.fn(),
  supportsOpen: true,
}));
vi.mock('../src/helpers.js', () => ({
  useWidgetReady: () => host.ready,
  useToolInfo: () => host.info,
  useLayout: () => ({
    theme: 'light',
    supports: { openExternal: host.supportsOpen },
  }),
  useOpenExternal: () => host.open,
}));
const workspace = {
  id: 'journey-1',
  team: 'example',
  teamName: 'Example',
  version: 3,
  status: 'ACTIVE',
  url: 'https://app.tivmark.com/teams/example/enterprise-onboarding',
  nextAction: 'Review security',
  boundary: 'External systems are not configured by this plan.',
  metrics: { complete: 4, total: 14 },
  research: { status: 'RUNNING', stale: false },
};
beforeEach(() => {
  host.ready = true;
  host.supportsOpen = true;
  host.info = { structuredContent: { workspace } };
  host.open.mockClear();
});
it('renders saved progress and opens only the exact team workspace', () => {
  render(<EnterpriseProgress />);
  expect(screen.getByText(/4 of 14 stages reviewed/)).toBeDefined();
  expect(screen.getByText('Review security')).toBeDefined();
  expect(screen.getByText(/External systems are not configured/)).toBeDefined();
  fireEvent.click(
    screen.getByRole('button', { name: 'Open full launch plan' })
  );
  expect(host.open).toHaveBeenCalledWith(workspace.url);
});
it('shows loading and never a success receipt before a result exists', () => {
  host.ready = false;
  host.info = {};
  render(<EnterpriseProgress />);
  expect(screen.getByText('Reading the saved plan…')).toBeDefined();
  expect(screen.queryByRole('button')).toBeNull();
});
it('does not imply success for malformed results', () => {
  host.info = { isError: true };
  render(<EnterpriseProgress />);
  expect(screen.getByText(/could not be verified/)).toBeDefined();
  expect(screen.queryByRole('button')).toBeNull();
});
it('handles an empty journey without inventing progress', () => {
  host.info = {
    structuredContent: {
      workspace: { ...workspace, id: null, status: 'NOT_STARTED' },
    },
  };
  render(<EnterpriseProgress />);
  expect(screen.getByText(/No launch plan yet/)).toBeDefined();
});
it.each([
  'https://attacker.example/teams/example/enterprise-onboarding',
  'https://app.tivmark.com/teams/other/enterprise-onboarding',
])('rejects an unexpected handoff URL: %s', (url) => {
  host.info = { structuredContent: { workspace: { ...workspace, url } } };
  render(<EnterpriseProgress />);
  expect(screen.queryByRole('button')).toBeNull();
  expect(screen.getByText(/Continue on app.tivmark.com/)).toBeDefined();
});
it('retains a useful fallback when the host cannot open external links', () => {
  host.supportsOpen = false;
  render(<EnterpriseProgress />);
  expect(screen.queryByRole('button')).toBeNull();
  expect(screen.getByText('Review security')).toBeDefined();
});
