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
  // on a parent-domain cookie; its presence at first render means a visitor has just arrived
  // from tivmark.com to continue a conversation. The service joins them to it but replays no
  // transcript, so without this the visitor faces an empty panel that silently knows the
  // answer. One resume message makes the memory visible; the backend spends the ticket in the
  // very exchange that message rides on, and a refused ticket degrades to a fresh
  // conversation where the message reads as a normal greeting.
  //
  // Hard-won shape, in production, in one night:
  //  - Captured at FIRST RENDER: the element's own eager session exchange spends the cookie,
  //    so a live-cookie check races and loses.
  //  - The element handle comes from the DOM, not the React ref: the component mounts through
  //    next/dynamic, whose ref forwarding we could not make observable in the field, while
  //    document.querySelector drove the element correctly every single time.
  //  - The wrapper's onReady is not used: it fires synchronously from inside
  //    connectedCallback, mid-upgrade, when calling element methods throws (fb-1178).
  //  - The guard requires typeof === 'function' (a widened cast so TS2774 cannot force its
  //    deletion -- the type says the method always exists; mid-upgrade runtime disagrees) and
  //    a soft failure keeps polling rather than giving up.
  const arrivedWithSignInTicket = useRef(
    typeof document !== 'undefined' &&
      document.cookie
        .split('; ')
        .some((entry) =>
          entry.startsWith(`${ASSISTANT_SIGN_IN_TICKET_COOKIE}=`)
        )
  );
  const resumeSentRef = useRef(false);

  useEffect(() => {
    if (!arrivedWithSignInTicket.current) return;
    let active = true;
    const startedAt = Date.now();
    console.info(
      '[assistant] sign-in resume: waiting for the assistant element'
    );

    const trySend = (): boolean => {
      if (!active || resumeSentRef.current) return true;
      const element = (assistantRef.current ??
        document.querySelector('noodle-assistant')) as {
        open?: () => void;
        sendMessage?: unknown;
      } | null;
      if (!element || typeof element.sendMessage !== 'function') return false;
      resumeSentRef.current = true;
      console.info(
        `[assistant] resuming the conversation after sign-in (element ready after ${Date.now() - startedAt}ms)`
      );
      try {
        element.open?.();
        void (
          element.sendMessage(
            "I've just signed in — please pick up where we left off and answer my last question."
          ) as Promise<void>
        ).catch(() => {
          /* the panel surfaces its own error state */
        });
        return true;
      } catch {
        // A synchronous throw mid-upgrade degrades to another retry, never a dead page.
        resumeSentRef.current = false;
        return false;
      }
    };

    // Poll with a generous ceiling. The field taught us the real numbers: the dynamic
    // wrapper can take beyond ten seconds to mount, and the previous version's two retry
    // chains shared one 40-attempt budget -- the timeout chain exhausted it, and when
    // whenDefined finally resolved, its one attempt found the budget spent at the exact
    // moment the element became usable. Each arm now polls independently; the ticket
    // itself expires server-side in ten minutes, so a sixty-second ceiling is safe.
    const poll = (remaining: number) => {
      if (trySend()) return;
      if (remaining > 0) {
        setTimeout(() => poll(remaining - 1), 250);
      } else {
        console.warn(
          `[assistant] sign-in resume: element never became sendable (${Date.now() - startedAt}ms)`
        );
      }
    };
    poll(240);
    if (window.customElements) {
      void customElements.whenDefined('noodle-assistant').then(() => poll(240));
    }
    return () => {
      active = false;
    };
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
      onReady={syncSurface}
      onAppearanceWarning={(warning) =>
        // Dev-only signal: the client flags low-contrast launcher colors so we can retune if needed.
        console.warn('[assistant] appearance warning', warning)
      }
    />
  );
}
