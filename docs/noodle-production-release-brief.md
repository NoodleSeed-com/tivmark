# Production release request: restore deploys, then ship the sign-in release

**From:** Tivmark **To:** Noodle Seed engineering **Date:** 2026-08-19
**Refs:** fb-1163, fb-1164 (both P0, area `deploys`)

Two asks, in order. The first is an outage and blocks everything. The second is work you have
already merged on dev — we are asking for the production release, and listing exactly which
three fixes gate us so you can scope it.

---

## 1 — P0: deploys have been down ~9 hours

`noodle deploy` has returned HTTP 503 from the preflight continuously since ~05:30Z for org
`noodleseed`, app `tivmark-assistant`.

```json
{"code":"deploy_preflight_failed","message":"request failed (503)","detail":{"status":503}}
```

**Reproduced across:** both `prod` and `dev` · with and without `--version` · with and without
`--access customers` · CLI **0.127.2 and 0.128.0** · with and without a `knowledge()` component.
Retried automatically every 2–3 minutes for ~9 hours; the signature changed exactly once, briefly
becoming `client_version_unsupported` (409) before reverting.

**What still works**, which is why this looks isolated to the preflight path rather than the
service:

| Layer | State |
| :-- | :-- |
| Control plane reads | `whoami`, `status`, `envs`, `apps`, `service capabilities`, `variables set` — all succeed |
| `noodle doctor` | 10/11 pass; sole failure is `Endpoint health — HTTP 503` |
| Data plane | Deployed v18 answers **401** to anonymous POST and **405** to GET — the correct customer-auth boundary |
| Deployment record | `health.state=ready`, `config.ok=true`, no missing secrets |

So a healthy, ready deployment cannot be redeployed. Note also that doctor's endpoint-health
probe reports 503 for an endpoint that answers 401 correctly when probed directly — those two
disagree, which may point at which upstream the preflight actually calls.

From the CLI source the preflight POSTs under
`/v1/orgs/{org}/apps/{app}/envs/{env}/` — `assets/preflight`, and `knowledge/preflight` when
knowledge is declared.

> **Triage warning.** CLI 0.128 added a *local* pre-check that returns `ambiguous_server_version`
> when `--version` is omitted, before any network call. It masks the 503 and looks like recovery
> — we misread it as such for a minute. **Verify with `--version` passed explicitly**, or you
> will get a client-side error and conclude the service is healthy.

**Impact:** nothing ships for `apps/assistant`. Concretely it blocks deploying our new
`publicWebsite` surface, which blocks the marketing embed, because the non-secret embed id only
exists after a successful deploy. Everything else in that change set is merged and green.

---

## 2 — Please release the sign-in work to production

Thank you for the reply and for shipping `signInTicket`, the typed refusals, and the rename the
same day. We verified all three in `@noodleseed/assistant@1.20.0` on npm and have built against
them:

- `apps/web/lib/assistant/elevation.ts` + session route spend a `signInTicket`, handling refusals
  by kind — four recover into a fresh conversation, `elevation_tenant_mismatch` is escalated and
  never retried.
- `apps/marketing` carries the ticket to `app.tivmark.com` on a short-lived parent-domain cookie
  and redirects, per your confirmation that the redirect handoff is mandatory.

**`signIn: true` is off, and stays off until three of your dev-merged fixes reach production.**
Enabling it against today's production would produce a sign-in that appears to succeed and then
breaks — the exact trap your finding described. In priority order for us:

1. **Origin re-pin at elevation.** Without it our elevated token is minted against `tivmark.com`
   and CORS-blocked from `app.tivmark.com` on every turn. **This is the single blocker.**
2. **Connector-auth-kind classification** (your §5 fix 2). Until it lands, our
   `delegatedTokenExchange` tools need the `${user}`-reference workaround to raise the card at
   all. We are keeping the workaround; it becomes redundant, not wrong.
3. **Issuer rebind to the elevating client.** Without it a post-elevation delegated exchange
   asserts the wrong issuer against our token endpoint at `app.tivmark.com/api/assistant/oauth/token`.

Also welcome, not blocking: the `embed --check` corrections (`script-src` for public surfaces,
real CSP parse, env aliasing) and the doctor elevation probe.

---

## What we need from you

1. **Restore the deploy preflight.** This is the whole critical path.
2. **Give us a date for the release** carrying items 1–3 above, so we can schedule turning
   `signIn: true` on rather than polling npm.

Once deploys work we can complete the demo in minutes: deploy, take the embed id, publish the
marketing embed, and verify live. It is the last step and it has been ready since last night.

---

*Verification commands, if useful:*

```bash
noodle deploy --org noodleseed --app tivmark-assistant --env prod --access customers --version 19 --json
noodle doctor --service https://cloud.noodleseed.dev --json
noodle status --org noodleseed --app tivmark-assistant --env prod --json
```
