# NoodleSeed — spec request: delegated downstream auth (`delegatedOAuth` / `delegatedSessionCookie`)

> For the NoodleSeed developers. We want the embedded assistant to call a customer's downstream API
> **as the signed-in end user**, so the downstream API enforces its own per-user authorization and
> data filtering (not a shared service credential + a forwarded, spoofable user id). The connector
> `auth` union offers `delegatedOAuth` and `delegatedSessionCookie` for exactly this, but the
> **broker ↔ downstream contract is undocumented**. We need the exact contract to build the
> downstream endpoint that matches it.

## Our setup (concrete, so you can answer specifically)
- Deployment: `noodleseed/tivmark-assistant/prod`, access `customers`.
- Verified identity already works (thanks for the recent fixes): `server.auth = customerAuth.bridge({
  provider: 'tivmark-portal', user: { id, email, name, roles } })`, and the browser session is minted
  by our backend via `createAssistantSession({ user: { id, email, name } })`. Inside tools,
  `user.id` / `user.email` resolve correctly.
- Downstream: `https://app.tivmark.com/api/v1/...`. Its API accepts a **user-scoped JWT**
  (issuer `https://app.tivmark.com/oauth`, audience `tivmark-api`, `sub = <userId>`, `scope`,
  ES256) and then runs as that user (membership + per-user filtering enforced by the API). We can
  mint such a JWT on demand for a given user.
- Goal: the connector obtains a **per-request, per-user** downstream token so
  `GET /api/v1/teams/{team}/time-off` runs as the end user.

The connector `auth` shapes we see in the SDK types (`@noodle-borg/authoring/dist/connectors.d.ts`):
```ts
{ kind: 'delegatedOAuth';        provider: string; tokenUrl?: string;
  clientId?: string|ConfigRef;   clientSecret?: string|ConfigRef; scopes?: string[] }
{ kind: 'delegatedSessionCookie'; provider: string; sessionUrl: string; tokenField?: string }
```

## What we need documented — `delegatedOAuth`
1. **The exact HTTP request** the broker makes to `tokenUrl`: method, headers, `Content-Type`, and the
   full body/params. Which `grant_type`? (Token exchange, RFC 8693? A custom grant?)
2. **How the verified customer identity is conveyed** to `tokenUrl`. Is it a signed assertion (JWT)
   as `subject_token`/`assertion`? What are its claims (`sub`, `email`, issuer, audience)? How do we
   **verify** it is genuinely from NoodleSeed for the correct user — is there a **JWKS/issuer** we
   validate against? (This is the crux: our endpoint must not trust a spoofable plaintext id.)
3. **Client authentication** to `tokenUrl`: how are `clientId`/`clientSecret` presented
   (`client_secret_basic`? `client_secret_post`?), and where are they registered on your side?
4. **`provider`**: what does this string map to? Does it require registering a provider/app in the
   NoodleSeed dashboard, and what config (redirect/token URLs, client) does that entail?
5. **Expected response** shape the broker parses (`{ access_token, token_type, expires_in }`?),
   and **token lifecycle**: does the broker cache the token per user/session until `expires_in`, call
   `tokenUrl` on every request, or support refresh?
6. **How the token is applied** to downstream operations (assumed `Authorization: Bearer <token>` —
   please confirm; any origin/header constraints).

## What we need documented — `delegatedSessionCookie`
7. What request does the broker send to `sessionUrl` (method, headers, body)?
8. **Which cookie/credential** does it present? Our downstream (`app.tivmark.com`) is a *different
   origin* from the assistant gateway (`cloud.noodleseed.dev`), so the end user's app.tivmark.com
   session cookie is not available to the broker — what exactly is forwarded, and how is the user
   identified/verified at `sessionUrl`?
9. What is `tokenField` read from in the JSON response, and how is that token then applied downstream?

## General
10. Which `customerAuth` variants pair with `delegatedOAuth`/`delegatedSessionCookie`, and **how the
    `customerAuth` identity flows into the delegation exchange** (does the broker sign the current
    `user` claims into the assertion it sends downstream?).
11. Is there a **worked example** (server.ts + the downstream endpoint it expects) for either kind?
    The skills reference a SharePoint/Microsoft delegated example but it isn't bundled locally.

## What we'll build once we have the contract
A downstream endpoint (e.g. `POST https://app.tivmark.com/api/assistant/oauth/token`) that:
1. authenticates the NoodleSeed broker (client credential),
2. **verifies the NoodleSeed-signed user assertion** (via your JWKS/issuer) to obtain the trusted
   `userId`,
3. mints a short-lived user-scoped Tivmark JWT (`issueAccessToken(userId, clientId, scopes)`), and
4. returns it in the shape your broker expects.

The connector would then be:
```ts
auth: {
  kind: 'delegatedOAuth',
  provider: 'tivmark',
  tokenUrl: 'https://app.tivmark.com/api/assistant/oauth/token',
  clientId: secret('TIVMARK_DELEG_CLIENT_ID'),
  clientSecret: secret('TIVMARK_DELEG_CLIENT_SECRET'),
  scopes: ['time_off'],
}
```
Please confirm/correct this shape and fill in the request/assertion/verification details above.

## Why it matters
Without this, our only options are (a) a shared service credential + a forwarded user id the
downstream must trust (bypasses the API's own per-user security — not acceptable to us), or (b)
guessing your broker's contract and iterating against a black box. A short contract doc (or the
worked example) unblocks a clean, correct implementation.
