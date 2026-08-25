# GCP deployment

Tivmark deploys into the `tivmark-app` Google Cloud project in `us-central1`.

## Services

- `tivmark-marketing`: Cloud Run service for `apps/marketing`, intended for `tivmark.com` and `www.tivmark.com`.
- `tivmark-web`: Cloud Run service for `apps/web`, intended for `app.tivmark.com`.
- `tivmark`: Artifact Registry Docker repository used by both services.
- Cloud SQL Postgres supplies the web app database.
- Secret Manager supplies production runtime secrets.

## Required GitHub repository secrets

- `GCP_WORKLOAD_IDENTITY_PROVIDER`
- `GCP_SERVICE_ACCOUNT`

## Required Secret Manager secrets

- `database-url`
- `nextauth-secret`
- `oauth-private-jwk`
- `noodle-assistant-client-secret` — the backend credential `apps/web` uses to
  mint assistant sessions. Never reaches the browser.
- `assistant-deleg-client-secret` — the customer half of delegated token
  exchange. Must equal `TIVMARK_DELEG_CLIENT_SECRET` on the Noodle side.

Additional SMTP, OAuth, Svix, Stripe, Sentry, and reCAPTCHA secrets can be added later when those integrations are enabled.

## The assistant (`apps/assistant`)

`apps/assistant` does **not** deploy through GitHub Actions. It is a Noodle Seed
MCP app deployed with the Noodle CLI against `noodleseed/tivmark-assistant/prod`,
and its configuration lives on the Noodle service rather than in GCP:

| Setting | Where | Notes |
| :-- | :-- | :-- |
| `ASSISTANT_MODEL_BASE_URL`, `ASSISTANT_MODEL` | `noodle variables set` | Never in the SaaS environment |
| `ASSISTANT_MODEL_API_KEY` | `noodle secrets set` | Never in the SaaS environment |
| `TIVMARK_DELEG_CLIENT_ID` / `_SECRET` | `noodle variables`/`secrets set` | Pairs with the GCP secrets above |
| `NOODLE_KNOWLEDGE_ENABLED` | `noodle variables set --runtime cloud` | Knowledge is feature-gated per environment and will not serve without it |

The public marketing surface has no secret at all: `noodle deploy` provisions a
non-secret embed id, which is pasted into `apps/marketing/index.html` and is
safe in page source. It is stable across deploys, so redeploys and rollbacks
swap the projection under a page that never changes.

Two operational commands worth knowing:

```bash
noodle assistant embeds list                  # origins, capabilities, today's spend vs cap
noodle assistant budget set --turns-per-day 0 # kill switch; stops in-flight conversations
```

Prefer the budget kill switch to revoking an embed, which destroys the pasted id.

## Content-Security-Policy

`apps/marketing/nginx.conf` holds the site's single CSP, served as a response
header. It must allow the Noodle service origin in **`script-src`,
`connect-src`, and `frame-src`**. `script-src` is the one that cannot report its
own failure: if it blocks the embed script, no widget code runs at all, so
nothing on the page can complain. `marketing-ci.yml` asserts all three against
the served header.

## DNS records

Cloud Run domain mappings are already created. Configure these records at the DNS host:

```text
tivmark.com.      A      216.239.32.21
tivmark.com.      A      216.239.34.21
tivmark.com.      A      216.239.36.21
tivmark.com.      A      216.239.38.21
tivmark.com.      AAAA   2001:4860:4802:32::15
tivmark.com.      AAAA   2001:4860:4802:34::15
tivmark.com.      AAAA   2001:4860:4802:36::15
tivmark.com.      AAAA   2001:4860:4802:38::15
www.tivmark.com.  CNAME  ghs.googlehosted.com.
app.tivmark.com.  CNAME  ghs.googlehosted.com.
```

`tivmark.com` currently resolves through Cloudflare. Certificate provisioning for the GCP mappings will remain pending until those records are changed.

## One-time GCP setup checklist

1. Reauthenticate locally: `gcloud auth login`.
2. Confirm the active project: `gcloud config set project tivmark-app`.
3. Enable APIs: Cloud Run, Artifact Registry, Cloud SQL Admin, Secret Manager, IAM Credentials, Cloud Build.
4. Create Artifact Registry Docker repo `tivmark` in `us-central1`.
5. Create the Cloud SQL Postgres instance/database/user and write the final connection string to Secret Manager as `DATABASE_URL`.
6. Create or confirm a GitHub deploy service account with Cloud Run Admin, Artifact Registry Writer, Secret Manager Secret Accessor, Service Account User, and Cloud SQL Client permissions.
7. Configure Workload Identity Federation for GitHub Actions and save its provider plus service account email as GitHub secrets.
8. Deploy from `main`, then map `tivmark.com`, `www.tivmark.com`, and `app.tivmark.com` to the Cloud Run services.
