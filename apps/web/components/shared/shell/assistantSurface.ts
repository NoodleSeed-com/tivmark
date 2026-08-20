/**
 * Open the embedded assistant as the right-side drawer.
 *
 * The assistant has exactly two modes: the floating launcher (bottom right, element default)
 * and the full-height drawer on the right (styles/globals.css, `.tivmark-assistant[open]`).
 * It is never a page and never takes over the canvas, so opening it changes no route and the
 * sidebar the user was looking at stays exactly where it was.
 *
 * The element handle comes from the DOM rather than a React ref: the widget mounts through
 * next/dynamic, whose ref forwarding proved unreliable in the field, while querySelector has
 * been correct every time. Optional chaining keeps this safe during custom-element upgrade.
 */
export interface AssistantSurfaceController {
  open?: () => void;
  focusComposer?: () => void;
}

export function openAssistant(
  root: { querySelector: (s: string) => unknown } = document
) {
  const assistant = root.querySelector(
    'noodle-assistant'
  ) as AssistantSurfaceController | null;
  assistant?.open?.();
  assistant?.focusComposer?.();
  return assistant != null;
}
