# tivmark

Monorepo for the Tivmark project: a fictional people-ops SaaS that serves as
Noodle Seed's canonical sample customer site. It has three apps — a marketing
site, the product, and the Noodle Seed MCP app that makes the product reachable
by AI agents.

## Structure

```
.
├── apps/
│   ├── marketing/   # Static marketing site (HTML/CSS + nginx), Cloud Run
│   ├── web/         # Next.js app (fork of boxyhq/saas-starter-kit), Cloud Run
│   └── assistant/   # Noodle Seed MCP app — "Mark", the assistant on both sites
├── .github/workflows/
│   ├── pr-gate.yml         # Required check; runs only the suites a PR touches
│   ├── marketing-ci.yml    # Container, nginx config, served CSP and status codes
│   ├── web-ci.yml          # Lint/format/types/jest/build + Playwright e2e
│   ├── assistant-ci.yml    # noodle validate + vitest
│   ├── deploy.yml          # Cloud Run deploy for apps/marketing
│   ├── deploy-web.yml      # Cloud Run deploy for apps/web (+ prod db push)
│   └── dependabot-auto-merge.yml
└── package.json     # npm workspaces root (apps/web only)
```

### One assistant, two front doors

`apps/assistant` is a single Noodle Seed MCP server projected onto both sites:

- **`tivmark.com`** — an anonymous visitor. Reaches exactly two capabilities: a
  `knowledge()` component over Tivmark's product documentation, and a tool that
  shows how to contact the team. No account, no backend session route.
- **`app.tivmark.com`** — the signed-in user. Projects the whole server, with
  every tool running as that person through delegated token exchange.

The same server also answers external MCP hosts (ChatGPT, Claude, Codex).
`apps/assistant/src/server.ts` is the whole authoring surface.

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

A static site with no build step. Open `apps/marketing/index.html` directly, or
run the real container to exercise the nginx config, CSP header, and 404s:

```bash
docker build -t tivmark-marketing apps/marketing
docker run --rm -p 8080:8080 tivmark-marketing
```

### Assistant (`apps/assistant`)

A Noodle Seed MCP app authored in TypeScript. Run every `noodle` command
through the project-local binary — a globally installed CLI at a different
version fails validation with misleading errors.

```bash
npm run validate:assistant   # noodle validate
npm run test:assistant       # vitest
npm run check:assistant      # noodle validate --json && noodle test --json
npm --prefix apps/assistant run dev    # local MCP server, hot reload
```

`noodle test` is a customer-auth app's smoke test, so a **pass** is an
anonymous 401 with exact protected-resource metadata — not a `tools/list`.
Knowledge documents are staged at deploy time, so a local run reports
`knowledge_documents_missing` until the app has been deployed.

## Dependency management

`apps/web/package-lock.json` is the canonical lockfile for the web app and is
used by its `Dockerfile` (`npm ci` with build context `apps/web`). **Make
dependency changes from inside `apps/web`** (e.g. `npm install <pkg>` run from
`apps/web`) so that lockfile stays in sync. Running app dependency installs
from the monorepo root would promote a root workspace lockfile and could leave
`apps/web/package-lock.json` stale, which would break the Docker build.

## Deploying

Everything runs on Cloud Run in the `tivmark-app` GCP project — see
`docs/gcp-deployment.md`.

- **Marketing**: pushing to `main` under `apps/marketing/**` triggers
  `.github/workflows/deploy.yml`, which builds the container and deploys
  `tivmark-marketing`. **Merging ships to production immediately.**
- **Web app**: `apps/web` is self-contained and deployable on its own. It
  ships its own `Dockerfile`, `app.json`, `Procfile`, `docker-compose.yml`, and
  `.do/deploy.template.yaml`. DigitalOcean/App Platform deploys should use
  `source_dir: apps/web` (already set in `.do/deploy.template.yaml`). In this
  repo it deploys through `.github/workflows/deploy-web.yml` on push to `main`.
- **Assistant**: deployed with the Noodle CLI rather than a workflow, because
  it is a hosted mutation that names its own target:

  ```bash
  npm --prefix apps/assistant run deploy -- \
    --org noodleseed --app tivmark-assistant --env prod
  ```

  The deploy prints the non-secret public embed id for the marketing surface.

## History

`apps/web` was imported from the former standalone `NoodleSeed-com/tivmark-app`
repository via `git subtree`, preserving its commit history. The upstream
(`boxyhq/saas-starter-kit`) relationship has been severed in this monorepo —
`apps/web` is treated as the source of truth going forward.