import { useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/router';
import type { NoodleAssistantElement } from '@noodleseed/assistant';

import env from '@/lib/env';
import { ASSISTANT_APPEARANCE } from '@/lib/assistantAppearance';
import useTheme from 'hooks/useTheme';

// The Noodle assistant renders a custom element and must mount client-side only (it references
// `HTMLElement` at import time). Load it with ssr:false.
const NoodleAssistant = dynamic(
  () => import('@noodleseed/assistant/react').then((m) => m.NoodleAssistant),
  { ssr: false }
);

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
        router.pathname.includes('enterprise-onboarding')
          ? {
              route: router.asPath.split('?')[0],
              surface: 'enterprise_onboarding',
            }
          : router.pathname === '/onboarding'
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
