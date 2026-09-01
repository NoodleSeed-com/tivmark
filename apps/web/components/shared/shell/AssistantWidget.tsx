import { useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/router';
import type { NoodleAssistantElement } from '@noodleseed/assistant';

import env from '@/lib/env';
import useTheme from 'hooks/useTheme';

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

export default function AssistantWidget() {
  // Drive the assistant's light/dark from the app's *resolved* theme (the DaisyUI toggle), not
  // `theme="auto"` — otherwise the assistant follows the OS `prefers-color-scheme`, which can
  // diverge from the app theme and mismatch the launcher against the canvas (e.g. a navy launcher
  // on the dark navy background). `resolvedTheme` updates reactively on toggle and OS change.
  const { resolvedTheme } = useTheme();
  const router = useRouter();
  const assistantRef = useRef<NoodleAssistantElement | null>(null);

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

  if (!env.assistant.enabled) return null;

  return (
    <NoodleAssistant
      ref={assistantRef}
      className="tivmark-assistant"
      sessionEndpoint="/api/assistant/session"
      theme={resolvedTheme}
      appearance={ASSISTANT_APPEARANCE}
      pageContext={
        router.pathname === '/onboarding'
          ? {
              route: router.asPath.split('?')[0],
              surface: 'business_onboarding',
              onboardingStage: 'review_and_confirm',
            }
          : {
              route: router.asPath.split('?')[0],
              surface: 'application',
            }
      }
      onEvent={(event) => {
        // The service resumes the question that triggered sign-in as the session's first turn
        // (assistant 1.21.0). That answer arrives with the panel still closed after the redirect
        // landing, so surface it. DOM handle, not the ref: refs through next/dynamic have been
        // non-null-but-wrong in the field.
        if (event.event === 'resume_started') {
          document.querySelector('noodle-assistant')?.setAttribute('open', '');
        }

        // A completed onboarding write is authoritative only after the assistant receives
        // the connector-backed receipt. Let the onboarding shell refresh from the database;
        // never infer completion from the public blueprint cookie or a model message.
        if (
          event.event === 'view_available' &&
          event.data.tool === 'complete_business_onboarding'
        ) {
          window.dispatchEvent(new Event('tivmark-onboarding-completed'));
        }
      }}
      onAppearanceWarning={(warning) =>
        // Dev-only signal: the client flags low-contrast launcher colors so we can retune if needed.
        console.warn('[assistant] appearance warning', warning)
      }
    />
  );
}
