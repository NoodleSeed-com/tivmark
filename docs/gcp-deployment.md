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

Additional SMTP, OAuth, Svix, Stripe, Sentry, and reCAPTCHA secrets can be added later when those integrations are enabled.

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
