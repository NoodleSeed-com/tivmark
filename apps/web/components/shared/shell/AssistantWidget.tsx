import dynamic from 'next/dynamic';
import { useEffect } from 'react';

import env from '@/lib/env';

// The assistant renders a web component under the hood, so it must only load in the browser.
const NoodleAssistant = dynamic(
  () => import('@noodleseed/assistant/react').then((m) => m.NoodleAssistant),
  { ssr: false }
);

// Persist the browser's IANA time zone + locale in cookies so the session endpoint can forward them
// as backend-verified `preferences` when it mints the assistant session. This lets the assistant
// resolve relative dates ("next Thursday") in the user's own zone. Written before the widget mounts
// its first turn; the widget re-mints sessions, so later turns always carry the preference.
function useCaptureLocalePreferences() {
  useEffect(() => {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const locale = navigator.language;
      const attrs = `Path=/; Max-Age=${60 * 60 * 24 * 365}; SameSite=Lax${
        window.location.protocol === 'https:' ? '; Secure' : ''
      }`;
      if (tz) document.cookie = `tiv_tz=${encodeURIComponent(tz)}; ${attrs}`;
      if (locale)
        document.cookie = `tiv_locale=${encodeURIComponent(locale)}; ${attrs}`;
    } catch {
      // Non-fatal: the assistant falls back to server defaults when preferences are absent.
    }
  }, []);
}

// Floating Tivmark assistant, rendered only inside the authenticated portal shell (AppShell).
// It fetches a short-lived session from /api/assistant/session, which reuses the NextAuth session.
export default function AssistantWidget() {
  useCaptureLocalePreferences();

  if (!env.assistant.enabled) {
    return null;
  }

  return (
    <NoodleAssistant sessionEndpoint="/api/assistant/session" theme="auto" />
  );
}
