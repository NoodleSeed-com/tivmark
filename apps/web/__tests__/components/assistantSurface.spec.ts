import {
  resolveAssistantSurface,
  syncAssistantSurface,
  type AssistantSurfaceController,
} from '@/components/shared/shell/assistantSurface';

class FakeAssistantController implements AssistantSurfaceController {
  state: 'open' | 'closed' = 'closed';
  focusCount = 0;

  open() {
    this.state = 'open';
  }

  close() {
    this.state = 'closed';
  }

  focusComposer() {
    this.focusCount += 1;
  }
}

describe('assistant surface behavior', () => {
  it('uses the focused canvas only on the global Mark route', () => {
    expect(resolveAssistantSurface('/mark')).toBe('canvas');
    expect(resolveAssistantSurface('/teams/acme/time-off')).toBe('floating');
    expect(resolveAssistantSurface('/settings/account')).toBe('floating');
  });

  it('opens and focuses Mark when the canvas becomes active', () => {
    const assistant = new FakeAssistantController();

    syncAssistantSurface(assistant, 'canvas');

    expect(assistant.state).toBe('open');
    expect(assistant.focusCount).toBe(1);
  });

  it('returns the shared conversation to its launcher outside Mark', () => {
    const assistant = new FakeAssistantController();
    assistant.open();

    syncAssistantSurface(assistant, 'floating');

    expect(assistant.state).toBe('closed');
    expect(assistant.focusCount).toBe(0);
  });

  it('does not crash while the custom element ref is still upgrading', () => {
    expect(() =>
      syncAssistantSurface({} as AssistantSurfaceController, 'canvas')
    ).not.toThrow();
  });
});
