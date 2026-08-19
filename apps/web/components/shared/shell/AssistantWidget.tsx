import { useCallback, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import type { NoodleAssistantElement } from '@noodleseed/assistant';

import env from '@/lib/env';
import { ASSISTANT_SIGN_IN_TICKET_COOKIE } from '@/lib/assistant/elevation';
import useTheme from 'hooks/useTheme';
import {
  syncAssistantSurface,
  type AssistantSurface,
} from './assistantSurface';

// The Noodle assistant renders a custom element and must mount client-side only (it references
// `HTMLElement` at import time). Load it with ssr:false.
const NoodleAssistant = dynamic(
  () => import('@noodleseed/assistant/react').then((m) => m.NoodleAssistant),
  { ssr: false }
);

// Full per-theme palette for the embedded assistant, so the opened panel reads as part of Tivmark
// (navy surfaces + gold/navy accents) instead of the assistant's default purple accent. Passed as
// literal values because the assistant renders inside its own custom element (shadow DOM), where
// the app's DaisyUI / `--ui-*` CSS variables can't reach. These MIRROR the tokens in
// `styles/globals.css` (`--ui-*`) + `tailwind.config.js` (daisyui `tivmark-light`/`tivmark-dark`) —
// keep them in sync with that source of truth. Each surface role is `{ surface, text, border }`;
// scalar roles (canvas/text/link/focus/...) are plain color strings. This overrides the deployed
// assistant's portable server branding for every visible role.
const ASSISTANT_APPEARANCE = {
  light: {
    canvas: '#f7f5f0',
    text: '#2a2a2a',
    mutedText: '#6b6b6b',
    link: '#b08d57',
    focus: '#b08d57',
    success: '#2f7d57',
    warning: '#b08d57',
    danger: '#b84a4a',
    panel: { surface: '#ffffff', text: '#2a2a2a', border: '#d8d0c0' },
    header: { surface: '#ece8df', text: '#1a2744', border: '#d8d0c0' },
    assistantMessage: {
      surface: '#ece8df',
      text: '#2a2a2a',
      border: '#d8d0c0',
    },
    userMessage: { surface: '#1a2744', text: '#f7f5f0' }, // navy bubble = app primary
    composer: { surface: '#ffffff', text: '#2a2a2a', border: '#d8d0c0' },
    suggestion: { surface: '#ece8df', text: '#1a2744', border: '#d8d0c0' },
    confirmation: { surface: '#ffffff', text: '#2a2a2a', border: '#d8d0c0' },
    primaryButton: { surface: '#1a2744', text: '#f7f5f0' }, // navy send button (was purple)
    secondaryButton: { surface: '#ece8df', text: '#1a2744', border: '#d8d0c0' },
    launcher: { surface: '#1a2744', text: '#f7f5f0' }, // navy FAB, cream icon on cream canvas
    code: { surface: '#ece8df', text: '#2a2a2a', border: '#d8d0c0' },
    app: { surface: '#ffffff', text: '#2a2a2a', border: '#d8d0c0' },
  },
  dark: {
    canvas: '#0b1222',
    text: '#f7f5f0',
    mutedText: '#c4c0b8',
    link: '#c9a96e',
    focus: '#c9a96e',
    success: '#67b58d',
    warning: '#c9a96e',
    danger: '#e47777',
    panel: { surface: '#111c33', text: '#f7f5f0', border: '#3d4f6b' },
    header: { surface: '#1a2744', text: '#f7f5f0', border: '#3d4f6b' },
    assistantMessage: {
      surface: '#1a2744',
      text: '#f7f5f0',
      border: '#3d4f6b',
    },
    userMessage: { surface: '#c9a96e', text: '#111c33' }, // gold bubble = app primary
    composer: { surface: '#111c33', text: '#f7f5f0', border: '#3d4f6b' },
    suggestion: { surface: '#1a2744', text: '#f7f5f0', border: '#3d4f6b' },
    confirmation: { surface: '#1a2744', text: '#f7f5f0', border: '#3d4f6b' },
    primaryButton: { surface: '#c9a96e', text: '#111c33' }, // gold send button (was purple)
    secondaryButton: { surface: '#1a2744', text: '#f7f5f0', border: '#3d4f6b' },
    launcher: { surface: '#c9a96e', text: '#111c33' }, // gold FAB, navy icon on navy canvas
    code: { surface: '#0b1222', text: '#f7f5f0', border: '#3d4f6b' },
    app: { surface: '#111c33', text: '#f7f5f0', border: '#3d4f6b' },
  },
} as const;

// One-year cookie so the backend session route can read the browser's IANA time zone / locale and
// forward them as trusted `preferences` (see pages/api/assistant/session.ts).
function setPreferenceCookie(name: string, value: string) {
  if (!value) return;
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=31536000; SameSite=Lax`;
}

interface AssistantWidgetProps {
  surface: AssistantSurface;
}

export default function AssistantWidget({ surface }: AssistantWidgetProps) {
  // Drive the assistant's light/dark from the app's *resolved* theme (the DaisyUI toggle), not
  // `theme="auto"` — otherwise the assistant follows the OS `prefers-color-scheme`, which can
  // diverge from the app theme and mismatch the launcher against the canvas (e.g. a navy launcher
  // on the dark navy background). `resolvedTheme` updates reactively on toggle and OS change.
  const { resolvedTheme } = useTheme();
  const assistantRef = useRef<NoodleAssistantElement | null>(null);

  const syncSurface = useCallback(() => {
    if (!assistantRef.current) return;
    syncAssistantSurface(assistantRef.current, surface);
  }, [surface]);

  // Mid-conversation sign-in, made visible. The marketing page hands the sign-in ticket over
  // on a parent-domain cookie; the presence of that cookie here means a visitor has just
  // arrived from tivmark.com to continue a conversation. The service joins them to it but
  // deliberately replays no transcript ("the assistant remembers; the messages do not
  // reappear"), so an untouched panel would look like the conversation was lost. Sending one
  // resume message makes the memory visible: the message triggers the session exchange, the
  // backend spends the ticket in that same exchange, and Mark's reply carries the context.
  //
  // The ticket cookie is read-only here — the session route is what spends and clears it, so
  // a refused ticket still degrades to a fresh conversation without this code caring.
  const resumeSentRef = useRef(false);
  const resumeAfterSignIn = useCallback(() => {
    if (resumeSentRef.current) return;
    if (
      !document.cookie
        .split('; ')
        .some((entry) =>
          entry.startsWith(`${ASSISTANT_SIGN_IN_TICKET_COOKIE}=`)
        )
    ) {
      return;
    }
    const element = assistantRef.current;
    if (!element?.sendMessage) return;
    resumeSentRef.current = true;
    element.open?.();
    void element
      .sendMessage("I've just signed in — let's pick up where we left off.")
      .catch(() => {
        /* the panel surfaces its own error state */
      });
  }, []);

  useEffect(() => {
    try {
      setPreferenceCookie(
        'tiv_tz',
        Intl.DateTimeFormat().resolvedOptions().timeZone
      );
      setPreferenceCookie('tiv_locale', navigator.language);
    } catch {
      /* non-fatal — the assistant falls back to server defaults */
    }
  }, []);

  useEffect(() => {
    syncSurface();
  }, [syncSurface]);

  if (!env.assistant.enabled) return null;

  return (
    <NoodleAssistant
      ref={assistantRef}
      className={
        surface === 'canvas'
          ? 'tivmark-assistant tivmark-assistant--canvas'
          : 'tivmark-assistant'
      }
      sessionEndpoint="/api/assistant/session"
      theme={resolvedTheme}
      appearance={ASSISTANT_APPEARANCE}
      open={surface === 'canvas'}
      onReady={() => {
        syncSurface();
        resumeAfterSignIn();
      }}
      onAppearanceWarning={(warning) =>
        // Dev-only signal: the client flags low-contrast launcher colors so we can retune if needed.
        console.warn('[assistant] appearance warning', warning)
      }
    />
  );
}
