# Conversational Business Onboarding Demo Design

## Funnel boundary

An anonymous visitor designs a concrete Tivmark workspace on `tivmark.com`, sees
the resulting blueprint before registering, then creates or signs into a Tivmark
account and completes one confirmed, authenticated workspace-configuration write
inside `app.tivmark.com`.

## Target user and conversational job

The target user is an evaluator setting up a new business. Their job is: “Help me
set up Tivmark for my business.” Mark asks only for the business name, team-size
band, time zone, primary goal, and starter leave allowances. It does not ask for
an email or password; Tivmark's normal signup screen owns identity and terms.

## Journey

1. The marketing CTA opens Mark with the onboarding prompt.
2. Mark collects the minimum setup facts conversationally and calls
   `design_business_workspace`.
3. `WorkspaceBlueprint` renders the proposed business profile, starter policy,
   and activation steps. Its structured output is also copied into a short-lived,
   untrusted first-party cookie strictly for signup prefill and visual continuity.
4. The visitor explicitly asks Mark to create the workspace. Mark calls
   `complete_business_onboarding`; on the mixed surface Noodle pauses at identity.
5. The latest embed exposes separate sign-in and create-account intents. The host
   sends a new user to signup and an existing user to login, preserving the
   single-use Noodle sign-in ticket in a parent-domain cookie.
6. Signup prefills the business name from the validated blueprint hint. When
   email confirmation and CAPTCHA do not require a second ceremony, Tivmark signs
   the new owner in and sends them to `/onboarding`; otherwise normal verification
   and login retain the same callback.
7. The authenticated embed spends the Noodle ticket. The exact pending tool call
   resumes and stops at the normal confirmation card—signup is not consent.
8. Accepting confirmation invokes one delegated Tivmark API operation. The API
   identifies or creates the owner's business, transactionally persists its
   profile and all four time-off policies, and returns a receipt.
9. `WorkspaceReady` renders the configured team, policies, verification boundary,
   and useful next steps. The ordinary onboarding page refreshes to show the same
   persisted result.

## Tools

- `design_business_workspace` — anonymous-safe, read-only blueprint generator.
  Takes business name, size band, IANA time zone, primary goal, and three finite
  leave allowances; unpaid leave is explicitly unlimited.
- `complete_business_onboarding` — identity-dependent, confirm-gated action. Takes
  the same exact blueprint fields and makes one delegated connector call to
  Tivmark's idempotent completion endpoint.

The existing tools remain available. `my_teams` continues to be the portable
authenticated context provider.

## Widgets and display modes

- `WorkspaceBlueprint` — inline card with the proposed profile, leave policy, and
  one conversational “Create this workspace” action.
- `WorkspaceReady` — inline receipt with the persisted result and follow-up chips.

Both remain one column and useful at 280px. Fullscreen and picture-in-picture are
deliberately unused because the review surface is compact and not long-running.

## Grounding and authority

- Pre-signup blueprint values come from the visitor and are visibly reviewable.
- The browser cookie is an untrusted continuity hint, schema-validated on every
  read, never an authorization credential.
- Identity comes from Tivmark's authenticated backend session.
- The Noodle connector uses delegated token exchange; Tivmark's API authorizes the
  user and performs the business write.
- The final API response, not the model or cookie, is the authoritative receipt.

## Failure and recovery

- Missing/invalid blueprint cookie: signup still works and the server-held Noodle
  interaction remains authoritative.
- Expired/invalid elevation ticket: the existing session exchange falls back to a
  fresh authenticated conversation; `/onboarding` still displays the blueprint.
- Existing matching business: completion is an idempotent update.
- Existing user with no matching business: completion creates the business and
  then applies the same policy transaction.
- Connector/API error: confirmation remains non-successful and no receipt claims
  completion.

## Acceptance

From the production marketing CTA, a signed-out visitor can create a visible
workspace blueprint, choose Create account, see the business name prefilled,
register, arrive at `/onboarding`, confirm the resumed action, and see the same
business profile and policy both in Mark's receipt and the regular Tivmark page.
