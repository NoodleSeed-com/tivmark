import { useEffect } from 'react';
import dynamic from 'next/dynamic';

import env from '@/lib/env';

// The Noodle assistant renders a custom element and must mount client-side only (it references
// `HTMLElement` at import time). Load it with ssr:false.
const NoodleAssistant = dynamic(
  () => import('@noodleseed/assistant/react').then((m) => m.NoodleAssistant),
  { ssr: false }
);

// Launcher (round FAB) colors — each theme's Tivmark `primary`, chosen to contrast with the page
// canvas so the button doesn't blend in. Passed as literal values because the launcher renders
// inside the assistant's own custom element (shadow DOM), where the app's DaisyUI CSS variables
// don't reach. Overrides the deployed assistant's server-side branding accent.
const ASSISTANT_APPEARANCE = {
  light: { launcher: { surface: '#1a2744', text: '#f7f5f0' } }, // navy button, cream icon on the cream canvas
  dark: { launcher: { surface: '#c9a96e', text: '#111c33' } }, // gold button, navy icon on the navy canvas
} as const;

// One-year cookie so the backend session route can read the browser's IANA time zone / locale and
// forward them as trusted `preferences` (see pages/api/assistant/session.ts).
function setPreferenceCookie(name: string, value: string) {
  if (!value) return;
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=31536000; SameSite=Lax`;
}

export default function AssistantWidget() {
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
      sessionEndpoint="/api/assistant/session"
      theme="auto"
      appearance={ASSISTANT_APPEARANCE}
      onAppearanceWarning={(warning) =>
        // Dev-only signal: the client flags low-contrast launcher colors so we can retune if needed.
        console.warn('[assistant] appearance warning', warning)
      }
    />
  );
}
