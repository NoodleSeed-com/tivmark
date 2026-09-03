import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import EnterpriseWorkspace from '../../components/onboarding/EnterpriseWorkspace';
import { openAssistant } from '../../components/shared/shell/assistantSurface';
import {
  enterpriseSteps,
  initialJourney,
} from '../../lib/enterprise-onboarding';

jest.mock('next/router', () => ({
  useRouter: () => ({ query: { slug: 'example' } }),
}));
jest.mock('../../components/shared/shell/assistantSurface', () => ({
  openAssistant: jest.fn(),
}));
jest.mock('hooks/useEnterpriseOnboarding', () => ({
  __esModule: true,
  default: () => ({
    workspace: mockWorkspace,
    change: mockChange,
    refresh: jest.fn(),
    isLoading: false,
  }),
}));

const mockChange = jest.fn();
let mockWorkspace: any;
let container: HTMLDivElement;
let root: Root;
const button = (text: string) =>
  Array.from(container.querySelectorAll('button')).find(
    (b) => b.textContent?.trim() === text
  )!;

describe('five-step onboarding UI', () => {
  beforeEach(async () => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    delete process.env.NEXT_PUBLIC_ENTERPRISE_ASSISTANT_ENABLED;
    jest.clearAllMocks();
    const state = initialJourney('Example');
    mockWorkspace = {
      id: 'plan',
      team: 'example',
      teamName: 'Example',
      version: 1,
      status: 'ACTIVE',
      canManage: true,
      currentUserId: 'owner',
      members: [],
      events: [],
      research: null,
      researchAvailable: false,
      boundary: 'This saves a plan only.',
      metrics: {
        complete: 0,
        total: 5,
        manualFields: 1,
        assistedFields: 0,
        blockers: 1,
      },
      steps: enterpriseSteps.map((s) => ({
        ...s,
        ...state.steps[s.id],
        adminOnly: !!s.adminOnly,
        state: s.id === 'launch' ? 'blocked' : 'ready',
        missing: [],
      })),
    };
    mockChange.mockResolvedValue(mockWorkspace);
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => {
      root.render(<EnterpriseWorkspace />);
    });
  });
  afterEach(async () => {
    delete process.env.NEXT_PUBLIC_ENTERPRISE_ASSISTANT_ENABLED;
    await act(async () => root.unmount());
    container.remove();
  });
  it('shows exactly five steps and no unavailable Mark action', () => {
    expect(container.querySelectorAll('nav li')).toHaveLength(5);
    expect(container.textContent).toContain('Five steps. One shared plan.');
    expect(container.textContent).not.toContain('Work through this with Mark');
    expect(container.textContent).not.toContain('Security review');
    expect(
      container.querySelector('label[for="field-industry"]')?.textContent
    ).toContain('optional');
  });
  it('opens Mark with the current team and stage without changing the plan', async () => {
    process.env.NEXT_PUBLIC_ENTERPRISE_ASSISTANT_ENABLED = 'true';
    (openAssistant as jest.Mock).mockReturnValue(true);
    const assistant = document.createElement('noodle-assistant');
    const sendMessage = jest.fn().mockResolvedValue(undefined);
    Object.assign(assistant, { sendMessage });
    document.body.appendChild(assistant);
    try {
      await act(async () => root.render(<EnterpriseWorkspace />));
      expect(container.textContent).not.toContain('awaiting their Noodle Seed');
      await act(async () => button('Work through this with Mark').click());
      expect(openAssistant).toHaveBeenCalledTimes(1);
      expect(sendMessage).toHaveBeenCalledWith(
        expect.stringContaining('team example, especially stage organization')
      );
      expect(sendMessage).toHaveBeenCalledWith(
        expect.stringContaining('Read the current enterprise onboarding first')
      );
      expect(mockChange).not.toHaveBeenCalled();
    } finally {
      assistant.remove();
    }
  });
  it('skips research without requesting consent or starting a provider call', async () => {
    await act(async () => button('4Optional research').click());
    await act(async () => button('Continue without research').click());
    expect(mockChange).toHaveBeenCalledTimes(1);
    expect(mockChange).toHaveBeenCalledWith({
      action: 'complete-step',
      version: 1,
      stepId: 'research',
      values: {},
      source: 'manual',
    });
    expect(container.textContent).toContain('Your plan at a glance');
    expect(button('Finish onboarding plan').disabled).toBe(true);
  });
  it('labels the research data flow and keeps consent unchecked', async () => {
    await act(async () => button('4Optional research').click());
    const consent = container.querySelector(
      'input[type="checkbox"]'
    ) as HTMLInputElement;
    expect(consent.checked).toBe(false);
    expect(button('Research public company').disabled).toBe(true);
    expect(container.textContent).toContain('Cloud charges may apply');
  });
});
