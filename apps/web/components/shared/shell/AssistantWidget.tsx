import dynamic from 'next/dynamic';

import env from '@/lib/env';

// The assistant renders a web component under the hood, so it must only load in the browser.
const NoodleAssistant = dynamic(
  () => import('@noodleseed/assistant/react').then((m) => m.NoodleAssistant),
  { ssr: false }
);

// Floating Tivmark assistant, rendered only inside the authenticated portal shell (AppShell).
// It fetches a short-lived session from /api/assistant/session, which reuses the NextAuth session.
export default function AssistantWidget() {
  if (!env.assistant.enabled) {
    return null;
  }

  return (
    <NoodleAssistant sessionEndpoint="/api/assistant/session" theme="auto" />
  );
}
