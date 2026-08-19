import type { NextApiRequest, NextApiResponse } from 'next';
import {
  AssistantSessionExchangeError,
  createAssistantSession,
} from '@noodleseed/assistant/server';

import env from '@/lib/env';
import { getSession } from '@/lib/session';
import { getTeamMembershipsWithSlug } from 'models/team';
import { Role } from '@prisma/client';
import {
  classifySignInRefusal,
  takeSignInTicket,
} from '@/lib/assistant/elevation';

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

// Verified session context for the assistant. The server declares which of these it accepts
// in `embeddedAssistant({ sessionClaims })`; anything not declared there is dropped at
// exchange, so this cannot widen what the model sees on its own.
//
// These ground the conversation -- which teams, which slug, whether to offer reviewer
// actions. They authorize nothing: every tool still reaches Tivmark through delegated token
// exchange, and this API remains the boundary.
//
// Fails open on purpose. A database hiccup should degrade Mark's grounding to the ambient
// team lookup, not fail the session and leave the user with no assistant at all.
async function resolveClaims(userId: string, name?: string | null) {
  try {
    const memberships = await getTeamMembershipsWithSlug(userId);
    const reviewer = memberships.filter(
      (membership) =>
        membership.role === Role.OWNER || membership.role === Role.ADMIN
    );

    const claims: Record<string, string> = {};
    if (name) claims.displayName = name;
    if (memberships.length) {
      claims.teamSlugs = memberships.map((m) => m.slug).join(',');
    }
    if (reviewer.length) {
      claims.reviewerTeamSlugs = reviewer.map((m) => m.slug).join(',');
    }

    return Object.keys(claims).length > 0 ? claims : undefined;
  } catch {
    return undefined;
  }
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

  const claims = await resolveClaims(session.user.id, session.user.name);

  // A visitor arriving from the public marketing embed carries a single-use sign-in ticket.
  // Spending it binds this signed-in person to the conversation they already started, instead of
  // minting a new one. Read-and-clear: a presented ticket is spent either way.
  const signInTicket = takeSignInTicket(req, res);

  const base = {
    serviceUrl,
    clientId,
    clientSecret,
    // The origin the conversation will CONTINUE on, which is this app — not the marketing origin
    // it began on. Sessions are origin-pinned, so spending the ticket here is what moves the
    // conversation onto an origin whose session endpoint the widget can actually reach.
    origin: resolveOrigin(req),
    user: {
      id: session.user.id,
      email: session.user.email ?? undefined,
      name: session.user.name ?? undefined,
    },
    ...(preferences ? { preferences } : {}),
    ...(claims ? { claims } : {}),
  };

  try {
    const assistantSession = signInTicket
      ? await createAssistantSession({ ...base, signInTicket })
      : await createAssistantSession(base);

    // Forward the helper response unchanged — the browser client chooses the advertised endpoints.
    return res.status(200).json(assistantSession);
  } catch (err) {
    // A refused sign-in must not cost the user their assistant. Every refusal except a tenant
    // mismatch means "that conversation cannot be joined" -- so start a fresh one, which is
    // exactly what the user would have got had they never been offered sign-in.
    const refusal =
      err instanceof AssistantSessionExchangeError
        ? err.elevationRefusal
        : undefined;
    const handling = refusal ? classifySignInRefusal(refusal) : undefined;

    if (handling?.kind === 'alert') {
      // Never retried: a ticket presented for another tenant's conversation is a boundary
      // event, not a transient one.
      console.error('[assistant] sign-in refused:', refusal, handling.reason);
    } else if (handling?.kind === 'retry-fresh') {
      console.warn(
        '[assistant] sign-in not applied:',
        refusal,
        handling.reason
      );
      try {
        return res.status(200).json(await createAssistantSession(base));
      } catch {
        // Fall through to the error below with the original failure.
      }
    }

    const message =
      err instanceof Error ? err.message : 'Failed to create assistant session';
    return res.status(502).json({ error: { message } });
  }
}
