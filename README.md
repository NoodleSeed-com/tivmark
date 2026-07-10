# tivmark

Monorepo for the Tivmark project, containing both the marketing site and the
web application.

## Structure

```
.
├── apps/
│   ├── marketing/   # Static marketing site (HTML/CSS), deployed to Cloudflare Pages
│   └── web/         # Next.js app (fork of boxyhq/saas-starter-kit), self-contained & independently deployable
├── .github/workflows/
│   ├── deploy.yml   # Cloudflare Pages deploy for apps/marketing
│   └── web-ci.yml   # Build/lint/type-check/e2e CI for apps/web
└── package.json     # npm workspaces root
```

## Getting started

Install dependencies for all workspaces from the repo root:

```bash
npm install
```

### Web app (`apps/web`)

The Next.js app. Uses Prisma + PostgreSQL. See `apps/web/README.md` and
`apps/web/.env.example` for full configuration.

```bash
# Dev server (port 4002)
npm run dev:web

# Build / type-check / lint
npm run build:web
npm run check-types:web
npm run lint:web
```

### Marketing site (`apps/marketing`)

A static site served as-is. Open `apps/marketing/index.html` locally in a
browser, or deploy via Cloudflare Pages (handled by `.github/workflows/deploy.yml`).

## Dependency management

`apps/web/package-lock.json` is the canonical lockfile for the web app and is
used by its `Dockerfile` (`npm ci` with build context `apps/web`). **Make
dependency changes from inside `apps/web`** (e.g. `npm install <pkg>` run from
`apps/web`) so that lockfile stays in sync. Running app dependency installs
from the monorepo root would promote a root workspace lockfile and could leave
`apps/web/package-lock.json` stale, which would break the Docker build.

## Deploying

- **Marketing**: push to `main` changes under `apps/marketing/**` triggers
  `.github/workflows/deploy.yml`, which runs
  `wrangler pages deploy apps/marketing`.
- **Web app**: `apps/web` is self-contained and deployable on its own. It
  ships its own `Dockerfile`, `app.json`, `Procfile`, `docker-compose.yml`, and
  `.do/deploy.template.yaml`. DigitalOcean/App Platform deploys should use
  `source_dir: apps/web` (already set in `.do/deploy.template.yaml`).

## History

`apps/web` was imported from the former standalone `NoodleSeed-com/tivmark-app`
repository via `git subtree`, preserving its commit history. The upstream
(`boxyhq/saas-starter-kit`) relationship has been severed in this monorepo —
`apps/web` is treated as the source of truth going forward.