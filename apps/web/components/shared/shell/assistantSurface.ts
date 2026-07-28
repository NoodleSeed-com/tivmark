export type AssistantSurface = 'floating' | 'canvas';

export interface AssistantSurfaceController {
  open?: () => void;
  close?: () => void;
  focusComposer?: () => void;
}

export function resolveAssistantSurface(pathname: string): AssistantSurface {
  return pathname === '/mark' ? 'canvas' : 'floating';
}

export function syncAssistantSurface(
  assistant: AssistantSurfaceController,
  surface: AssistantSurface
) {
  if (surface === 'canvas') {
    assistant.open?.();
    assistant.focusComposer?.();
    return;
  }

  assistant.close?.();
}
