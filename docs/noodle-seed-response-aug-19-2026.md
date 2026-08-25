# Re: Everything Tivmark needs — outage fixed in production, six confirmations answered

**To:** Tivmark
**From:** Noodle Seed engineering
**Date:** 2026-08-19
**Refs:** fb-1163, fb-1164

**Short version: everything is in production as of tonight (system-r601), and we verified the fix
against your literal preflight request before writing this.** The §1 outage is root-caused — it was
memory, not a roll-forward, and your own §1.2 matrix was the decisive evidence. Your exact
preflight (same compiled manifest, same target) now returns `200 ready:true` with zero config
errors: **v19 is clear to deploy.** The §2.4 fixes 1–3 had already reached production in r594
earlier today; r601 adds the outage fixes and — because your confirmation #1 caught a real defect —
the elevation store that production never had wired. With r601 live you can flip `signIn: true` as
part of the v19 deploy. All six §3 confirmations are answered below, two with corrections in your
favor. Pin `@noodleseed/one@0.129.2` and `@noodleseed/assistant@1.20.0` (unchanged — today's fixes
were service/CLI-side).

---

## 1 — The preflight 503: root cause, and why nothing you varied mattered

**Your deploy preflight was OOM-killing the production instance.** The compiled manifest for your
0.127-migrated server is ~4.9 MB (inline widget bundles). The deploy lane parsed every manifest with
a YAML parser — JSON is valid YAML, so it "worked" — and on your manifest that allocated ~+228 MB of
transient memory **twice per preflight** (the route's CSP gate, then the compile). Peak process
memory on your exact request: **545 MB**, on Cloud Run instances capped at **512 MiB**. The
container died mid-request, and Google's edge answered for the corpse with the bare
`503 Service Unavailable` you saw — no JSON envelope, no service log line, nothing attributable.

That explains every row of your matrix, which we want to acknowledge was exceptional triage:

- **Env/version/access/CLI/knowledge made no difference** because the trigger rode in the manifest
  bytes, which were the same in every variant.
- **The failure survived service roll-forwards** because every build shared the same parser and the
  same memory cap. Your "roll-forward without clearing the condition" inference was exactly right.
- **The §1.4 contradiction** (doctor says 503, your curl says 401) dissolves: doctor's
  endpoint-health probe is an HTTP `HEAD`, and your 2–3-minute retry monitor was repeatedly
  OOM-killing the single warm instance — probes that landed during a kill window got the edge 503,
  probes between kills got the correct 401/405. Same backend, different moments. (Your monitor is
  harmless now that the fix is live, but during an incident like this it was the thing keeping the
  instance down — worth a longer backoff next time.)
- **Your §1.5 candidate 1 was correct** — the main deploy preflight call. Candidate 3 (knowledge
  preflight) is excluded by construction: it fails closed as `403 knowledge_not_enabled`, never 503.
- **First failure "on the plain 0.127-migrated server"**: the 0.127 migration is what pushed your
  compiled manifest over the memory cliff. v18 deployed on 2026-07-31 because it was compiled by the
  earlier line and was smaller. The onset tracked *your* migration, not our deploys — which is why
  it defeated both your bisection and ours until we diffed the manifest itself.

**Fixes (all in production, system-r601):**

1. Manifest documents parse JSON-first (YAML remains the authored-source fallback). On your
   manifest: peak memory 545 MB → 287 MB, preflight latency ~6 s → ~110 ms. Validated locally
   against your literal preflight request.
2. The service's Cloud Run memory floor is pinned at 1 GiB in the deploy pipeline and the release
   promoter — the 512 MiB margin was proven too thin to ever trust again.
3. The CLI now gzips the preflight body, like the deploy call always did (your 4.9 MB upload
   becomes ~1 MB on the wire).

**§1.6 is fixed too:** `ambiguous_server_version` now names the highest deployed version and offers
the next one ready to paste (`noodle deploy --version 19`), so the out-of-band `noodle status`
lookup disappears. We considered `--version next` and deliberately stopped short: under concurrent
deploys it is non-deterministic, and the enriched error gives you the same one-liner with the number
visible before it is spent.

## 2 — Release state for the sign-in fixes (read before flipping `signIn: true`)

Your three §2.4 fixes are **already in production**: system-r594 promoted today ~15:37Z carries the
origin re-pin (fix 1), both classification halves (fix 2), and the issuer rebind (fix 3), plus the
`embed --check` corrections, the doctor elevation probe, and the documentation pass from §4. The npm
artifacts you verified (`one@0.128.0`, `assistant@1.20.0`, `agent-kit@0.76.0`) are that release.

**The hold is over as of r601** (confirmation #1 below): r594's production service had no elevation
store at all — the sign-in card would never have rendered and a spent ticket would have answered
`503 elevation_unavailable`. r601 wires the durable store, so your §2.5 sequence is runnable end to
end the moment v19 deploys with `signIn: true`.

Your acceptance criteria, against what is merged: fix 1 (re-pin to the presented origin, member of
the compiled union, CORS follows, refusal-before-spend preserves the ticket) — all three pinned by
tests, including the ticket-survives-refusal property you asked us to keep. Fix 2 — `my_teams` with
no `${user}` reference on a mixed surface is visible anonymously and raises `auth_requested`, never
`credential_unavailable`; pure-public projection of delegated-auth tools is a deploy-preflight
error (`assistant_public_delegated_auth`); the join is deploy-time binding data, no authoring change
on your side. Fix 3 — post-elevation delegated exchanges assert the elevating client's issuer,
identical to a fresh authenticated mint, which your issuer-pinning token endpoint requires.

## 3 — The six confirmations

1. **Elevation store on production: NO — and thank you.** Your question exposed that nothing in the
   hosted composition root ever constructed the elevation store: the feature was complete at every
   layer except the one that turns it on. Fixed and **live in r601**: a Postgres-backed store,
   provisioned automatically alongside the other assistant stores (its schema self-installs on
   boot), no per-tenant step. The answer to your confirmation is now yes — spend away.
2. **Knowledge, end to end: yes on all three.** (a) `NOODLE_KNOWLEDGE_ENABLED=true` at cloud env
   scope is the entire gate — it is a per-tenant managed variable (org→app→env inheritance), no
   service-side flag, no org entitlement, no billing gate. (b) The managed crawler and managed
   index (bundled BM25) provision automatically; the first crawl fires on deploy activation for
   every component with sites. (c) `noodle knowledge list/status/refresh` work for any org member
   once a deployment declares the component (`status` 404s until v19 is active, by design).
   Crawl budgets: 20,000 pages/month per org, 10,000 per app — your six documents and one site
   scope are nowhere near them. And yes: deploy v19 now and we will watch the publication and
   first crawl from our side and confirm.
3. **Embed provisioning and budgets: same deploy, and printed.** The deploy response provisions the
   embed id for a public or mixed surface and the CLI prints it with a paste-ready snippet
   (`--json`: `data.embedId`). It is idempotent across redeploys and never overwrites a budget you
   set. Defaults for a new surface: **1,000 turns/day** and **300 sessions/day** (UTC), adjustable
   via `noodle assistant budget set --turns-per-day / --mints-per-day` (0 is the kill switch);
   `noodle assistant embeds list` shows caps, live spend, and a `(default)` marker. One number to
   plan demos around: per-address fairness caps of **10 session mints/hour and 60 turns/hour per
   client address** are structural and not raisable per tenant — a single demo machine reloading
   the page hits those long before the daily caps. Rare edge worth knowing: embed provisioning
   never fails a deploy; if the id is ever missing from the output, redeploy prints it.
4. **Release coordinates: pin system-r601** = `@noodleseed/one@0.129.2`,
   `@noodleseed/assistant@1.20.0`, `@noodleseed/agent-kit@0.76.0`. It is in production now and
   carries everything in this letter; the assistant package is unchanged from what you already
   verified on npm.
5. **`routing` on both arms is intended.** The shipped 1.20.0 types are canonical; our email
   preceded the follow-up landing the same night. The in-source comment states the reason we kept
   it: elevation is the first authenticated moment, so it is the only chance a routed connector's
   session gets its backend-verified routes.
6. **"Remembers but does not replay," in writing.** The skill reference now says, verbatim: *"the
   assistant remembers the conversation (recent history feeds the model), but no transcript is
   replayed to the browser, so after a full-page navigation the visible panel starts fresh. Say
   'the assistant remembers', never 'your conversation will reappear'."* ADR 0201 records the same
   commitment, with a transcript endpoint as explicit future work. Your reading of
   `replayed: true` (idempotent re-POSTs of interaction decisions, not history) is correct.

## 4 — Your welcome-not-blocking list

- `embed --check` corrections, the doctor probes, and the documentation pass: **shipped in r594.**
- **Ambient papercut: fixed, in r601.** An anonymous principal with a delegated-auth ambient
  provider now short-circuits to `ambientStatus: 'unavailable'` without paying the doomed
  token-exchange round trip.
- **Deploy `--version` ergonomics: fixed** as described in §1.6 above.
- **CLI-version treadmill:** the honest answer is that the window is *the current release plus the
  immediately preceding one*, as exact versions, by construction of the release manifest. Your
  mid-incident 409 was the release train moving twice in one window. Widening to N releases (or
  semver-range matching) is a real, small change we have noted as a follow-up rather than shipped
  today; your report is the case study for it.

## 5 — Your definition-of-done table, from our side

Every gated row is unblocked now. We already ran your literal compiled manifest against production
after r601 promoted: `200 ready:true`, no missing config — so rows A–D and H clear the moment you
run the v19 deploy, and row G clears with the same deploy once `signIn: true` is set. Rows E and F
needed nothing. Your §2.5 checks in Appendix B are the right ladder; `noodle assistant doctor` now
also proves the elevation leg with a synthetic ticket, so run it last and it will certify the
whole path.

Two of your six confirmations uncovered production defects we had not caught (the missing elevation
store; the preflight OOM you documented into a corner for us). The reproduction matrix in §1.2 —
especially "first failure predates knowledge" and "the signature survived a roll-forward" — is what
let us stop bisecting service builds and diff the request instead. Please keep writing these.
