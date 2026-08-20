import { openAssistant } from '@/components/shared/shell/assistantSurface';

describe('openAssistant', () => {
  it('opens the drawer and focuses the composer in place', () => {
    const assistant = { open: jest.fn(), focusComposer: jest.fn() };
    const root = { querySelector: jest.fn().mockReturnValue(assistant) };

    expect(openAssistant(root as any)).toBe(true);
    expect(root.querySelector).toHaveBeenCalledWith('noodle-assistant');
    expect(assistant.open).toHaveBeenCalled();
    expect(assistant.focusComposer).toHaveBeenCalled();
  });

  it('survives the element not being mounted yet', () => {
    const root = { querySelector: jest.fn().mockReturnValue(null) };

    expect(openAssistant(root as any)).toBe(false);
  });

  it('survives a mid-upgrade element with no methods', () => {
    // Custom-element upgrade is async relative to first paint; a bare HTMLElement without
    // open()/focusComposer() must be a no-op, never a throw.
    const root = { querySelector: jest.fn().mockReturnValue({}) };

    expect(openAssistant(root as any)).toBe(true);
  });
});
