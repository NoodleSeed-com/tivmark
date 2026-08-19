import type { NextApiRequest, NextApiResponse } from 'next';

/**
 * Mid-conversation sign-in, host side.
 *
 * A visitor starts anonymously on the public marketing embed at tivmark.com, asks for something
 * that needs an account, and the widget shows a sign-in card carrying a single-use
 * `signInTicket`. Spending that ticket binds the signed-in person to the visitor's EXISTING
 * conversation instead of minting a new one.
 *
 * Why a redirect rather than signing in on the marketing page: the browser client calls its
 * session endpoint with `credentials: 'same-origin'`, so a marketing page pointing at
 * app.tivmark.com would send no cookie and get a guaranteed 401. No CORS configuration changes
 * that. The visitor is therefore bounced to app.tivmark.com, where the ticket is spent by this
 * backend, on this origin, with the credentials that already exist here.
 *
 * The ticket rides in a short-lived cookie rather than the URL: a URL-borne ticket lands in
 * access logs, in the `Referer` of every subresource, and in browser history.
 */
export const ASSISTANT_SIGN_IN_TICKET_COOKIE = 'tiv_assistant_signin';

/** Matches the widget's own ticket lifetime closely enough to fail fast on a stale one. */
const TICKET_MAX_AGE_SECONDS = 600;

const cookieDomainSuffix = (host: string | undefined) =>
  host === 'tivmark.com' || host?.endsWith('.tivmark.com')
    ? '; Domain=.tivmark.com; Secure'
    : '';

/**
 * The cookie the marketing page sets before redirecting here. Host-only in local development,
 * where tivmark.com and localhost share no parent domain.
 */
export function signInTicketCookie(value: string, host?: string) {
  return (
    `${ASSISTANT_SIGN_IN_TICKET_COOKIE}=${encodeURIComponent(value)}` +
    `; Path=/; Max-Age=${TICKET_MAX_AGE_SECONDS}; SameSite=Lax` +
    cookieDomainSuffix(host)
  );
}

/** Clears it. A ticket is single-use, so it must not survive the request that spends it. */
export function clearSignInTicketCookie(host?: string) {
  return (
    `${ASSISTANT_SIGN_IN_TICKET_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax` +
    cookieDomainSuffix(host)
  );
}

/**
 * Read the ticket and clear it in the same breath.
 *
 * Cleared unconditionally, including when the exchange goes on to fail. Tickets are single-use,
 * so a ticket that has been presented once is spent whether or not we liked the answer; leaving
 * it in the jar would only attach it to some later, unrelated conversation.
 */
export function takeSignInTicket(
  req: NextApiRequest,
  res: NextApiResponse
): string | undefined {
  const ticket = req.cookies[ASSISTANT_SIGN_IN_TICKET_COOKIE];
  if (!ticket) return undefined;

  const existing = res.getHeader('Set-Cookie');
  const cleared = clearSignInTicketCookie(req.headers.host);
  res.setHeader(
    'Set-Cookie',
    Array.isArray(existing)
      ? [...existing, cleared]
      : existing
        ? [String(existing), cleared]
        : cleared
  );

  return ticket;
}

/**
 * How a refused sign-in should be handled.
 *
 * The distinction is the point of the typed refusals: a visitor who took too long is an ordinary
 * event that should quietly become a fresh conversation, while a client reaching for a
 * conversation it does not own is the one an operator should hear about.
 */
export type SignInRefusalHandling =
  | { readonly kind: 'retry-fresh'; readonly reason: string }
  | { readonly kind: 'alert'; readonly reason: string };

export function classifySignInRefusal(
  refusal: string
): SignInRefusalHandling | undefined {
  switch (refusal) {
    case 'elevation_ticket_expired':
      return {
        kind: 'retry-fresh',
        reason: 'the visitor took too long to sign in',
      };
    case 'elevation_ticket_invalid':
      return {
        kind: 'retry-fresh',
        reason: 'the ticket was already spent or unknown',
      };
    case 'elevation_already_signed_in':
      return {
        kind: 'retry-fresh',
        reason: 'that conversation is already signed in',
      };
    case 'elevation_session_unavailable':
      return {
        kind: 'retry-fresh',
        reason: 'the anonymous conversation is gone',
      };
    // Never retried and never silent: this means a client reached for a conversation belonging
    // to a different tenant.
    case 'elevation_tenant_mismatch':
      return {
        kind: 'alert',
        reason:
          'a sign-in ticket was presented for another tenant’s conversation',
      };
    default:
      return undefined;
  }
}
