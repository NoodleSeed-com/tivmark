#!/usr/bin/env bash
#
# Sync apps/web/prisma/schema.prisma to the PRODUCTION Cloud SQL database via `prisma db push`.
#
# This repo manages its Postgres schema with `prisma db push` (the prisma/migrations/ dir is frozen
# at 2024 and omits every newer model). Nothing in the Cloud Run deploy applies schema changes, so a
# new model in schema.prisma does NOT reach prod until this script runs. It is used both:
#   * locally/manually to apply a schema change now, and
#   * by .github/workflows/deploy-web.yml on every deploy (so future changes apply automatically).
#
# Requirements: gcloud already authenticated (local: `gcloud auth login`; CI: WIF) with permission to
# read the DB secret (roles/secretmanager.secretAccessor) and connect to Cloud SQL (roles/cloudsql.client),
# plus python3 and node/npm (npm ci already run in apps/web). The Cloud SQL Auth Proxy is downloaded
# on demand if not on PATH.
#
# The database URL is never printed. `db push` is additive-safe: without --accept-data-loss it refuses
# destructive changes rather than dropping data.

set -euo pipefail

GCP_PROJECT_ID="${GCP_PROJECT_ID:-tivmark-app}"
CLOUD_SQL_CONNECTION_NAME="${CLOUD_SQL_CONNECTION_NAME:-tivmark-app:us-central1:tivmark-app-db}"
DB_SECRET_NAME="${DB_SECRET_NAME:-database-url}"
PROXY_PORT="${PROXY_PORT:-6543}"
PROXY_VERSION="${PROXY_VERSION:-v2.14.1}"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WEB_DIR="$REPO_ROOT/apps/web"

log() { printf '==> %s\n' "$*" >&2; }

# --- locate or download the Cloud SQL Auth Proxy v2 -------------------------------------------------
PROXY_BIN="$(command -v cloud-sql-proxy || true)"
if [[ -z "$PROXY_BIN" ]]; then
  case "$(uname -s)" in
    Linux) os="linux" ;;
    Darwin) os="darwin" ;;
    *) log "Unsupported OS: $(uname -s)"; exit 1 ;;
  esac
  case "$(uname -m)" in
    x86_64|amd64) arch="amd64" ;;
    arm64|aarch64) arch="arm64" ;;
    *) log "Unsupported arch: $(uname -m)"; exit 1 ;;
  esac
  PROXY_BIN="$(mktemp -d)/cloud-sql-proxy"
  log "Downloading Cloud SQL Auth Proxy ${PROXY_VERSION} (${os}.${arch})"
  curl -sSf -o "$PROXY_BIN" \
    "https://storage.googleapis.com/cloud-sql-connectors/cloud-sql-proxy/${PROXY_VERSION}/cloud-sql-proxy.${os}.${arch}"
  chmod +x "$PROXY_BIN"
fi

# --- fetch prod DATABASE_URL from Secret Manager (kept out of logs) --------------------------------
log "Reading DB secret '${DB_SECRET_NAME}' from project '${GCP_PROJECT_ID}'"
SECRET_URL="$(gcloud secrets versions access latest \
  --secret="$DB_SECRET_NAME" --project="$GCP_PROJECT_ID")"

# --- start the proxy and ensure it is cleaned up ---------------------------------------------------
log "Starting Cloud SQL Auth Proxy for ${CLOUD_SQL_CONNECTION_NAME} on 127.0.0.1:${PROXY_PORT}"
"$PROXY_BIN" "$CLOUD_SQL_CONNECTION_NAME" --port "$PROXY_PORT" >/tmp/cloud-sql-proxy.log 2>&1 &
PROXY_PID=$!
cleanup() { kill "$PROXY_PID" >/dev/null 2>&1 || true; }
trap cleanup EXIT

# wait until the proxy is accepting connections
for i in $(seq 1 30); do
  if (exec 3<>"/dev/tcp/127.0.0.1/${PROXY_PORT}") 2>/dev/null; then exec 3>&- 3<&-; break; fi
  if ! kill -0 "$PROXY_PID" 2>/dev/null; then log "Proxy exited early:"; cat /tmp/cloud-sql-proxy.log >&2; exit 1; fi
  sleep 1
done

# --- rewrite the socket URL into a TCP URL pointing at the proxy (secret stays in env, not argv) ----
TCP_URL="$(SECRET_URL="$SECRET_URL" PROXY_PORT="$PROXY_PORT" python3 - <<'PY'
import os, urllib.parse
u = urllib.parse.urlparse(os.environ["SECRET_URL"])
# Keep the userinfo (user:password) exactly as-is; it is already percent-encoded in the source URL,
# so re-encoding it would corrupt the password. Only swap the host:port to the local proxy.
userinfo = u.netloc.rsplit("@", 1)[0] if "@" in u.netloc else ""
host = f"127.0.0.1:{os.environ['PROXY_PORT']}"
netloc = f"{userinfo}@{host}" if userinfo else host
# Drop the "?host=/cloudsql/..." socket param; keep any others (schema, sslmode, ...).
q = [(k, v) for k, v in urllib.parse.parse_qsl(u.query, keep_blank_values=True) if k != "host"]
new = u._replace(netloc=netloc, query=urllib.parse.urlencode(q))
print(urllib.parse.urlunparse(new))
PY
)"

# --- apply the schema ------------------------------------------------------------------------------
log "Running: prisma db push --skip-generate (against production)"
cd "$WEB_DIR"
DATABASE_URL="$TCP_URL" npx prisma db push --skip-generate

log "Done. Production schema is in sync with schema.prisma."
