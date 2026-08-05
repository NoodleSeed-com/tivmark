import type { NextApiRequest, NextApiResponse } from 'next';
import { createAssistantSession } from '@noodleseed/assistant/server';

import env from '@/lib/env';
import { getSession } from '@/lib/session';

// Backend session exchange for the embedded Tivmark assistant.
//
// The browser widget (components/shared/shell/AssistantWidget.tsx) calls this endpoint. We verify the
// logged-in NextAuth session, then mint a short-lived assistant session bound to the request origin
// using the deployment-bound client credentials. The clientSecret never leaves the server. The
// verified identity remains available for authentication and delegated downstream authorization.

// Validate a browser-supplied locale / IANA time zone, dropping anything invalid so a bad cookie can
// never break session creation (the assistant then falls back to server defaults).
function resolvePreferences(
  rawLocale?: string,
  rawTimeZone?: string
): { locale?: string; timeZone?: string } | undefined {
  let locale: string | undefined;
  let timeZone: string | undefined;

  if (rawLocale) {
    try {
      locale = Intl.getCanonicalLocales(rawLocale)[0];
    } catch {
      /* invalid locale — drop */
    }
  }
  if (rawTimeZone) {
    try {
      timeZone = Intl.DateTimeFormat('en-US', {
        timeZone: rawTimeZone,
      }).resolvedOptions().timeZone;
    } catch {
      /* invalid time zone — drop */
    }
  }

  return locale || timeZone
    ? { ...(locale && { locale }), ...(timeZone && { timeZone }) }
    : undefined;
}

// Source the origin from trusted server config or the appUrl — never an arbitrary request header — and
// only when it is one of the assistant's allowed origins.
function resolveOrigin(req: NextApiRequest): string {
  const appOrigin = env.appUrl?.startsWith('http')
    ? new URL(env.appUrl).origin
    : undefined;
  const requestOrigin = req.headers.origin;
  const allowed = new Set(
    [appOrigin, 'http://localhost:4002'].filter(Boolean) as string[]
  );
  if (requestOrigin && allowed.has(requestOrigin)) return requestOrigin;
  return appOrigin ?? 'http://localhost:4002';
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: { message: 'Method not allowed' } });
  }

  const session = await getSession(req, res);
  if (!session?.user?.id) {
    return res.status(401).json({ error: { message: 'Unauthorized' } });
  }

  const { serviceUrl, clientId, clientSecret } = env.assistant;
  if (!serviceUrl || !clientId || !clientSecret) {
    return res
      .status(503)
      .json({ error: { message: 'Assistant is not configured' } });
  }

  // The browser widget records the user's IANA time zone / BCP-47 locale as cookies. Forward them as
  // backend `preferences` so the assistant grounds relative dates in the user's own zone. Validate
  // first — an invalid value is dropped rather than failing session creation.
  const preferences = resolvePreferences(
    req.cookies.tiv_locale,
    req.cookies.tiv_tz
  );

  try {
    const assistantSession = await createAssistantSession({
      serviceUrl,
      clientId,
      clientSecret,
      origin: resolveOrigin(req),
      user: {
        id: session.user.id,
        email: session.user.email ?? undefined,
        name: session.user.name ?? undefined,
      },
      ...(preferences ? { preferences } : {}),
    });

    // Forward the helper response unchanged — the browser client chooses the advertised endpoints.
    return res.status(200).json(assistantSession);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Failed to create assistant session';
    return res.status(502).json({ error: { message } });
  }
}
