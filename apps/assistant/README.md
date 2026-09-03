# Tivmark assistant

## Update and validate

```sh
npm update @noodleseed/one
npm exec -- noodle agents setup --write
npm run validate
npm test
npm exec -- noodle check --target embedded-assistant --json
```

Use Node 24. The SDK manifest follows `latest`; commit the generated lockfile to
record the release actually validated. The browser client in `apps/web` also
follows `latest`; update it through the workspace and run
`scripts/sync-web-lockfile.sh` from the repository root, committing both web
lockfiles. A plain install can retain the previous locked release.

`npm exec -- noodle dev` runs the local loopback server with hot reload.
`npm exec -- noodle test --json` performs a runtime smoke, which requires this
application's managed local configuration and authenticated customer context.
Compilation and unit tests do not prove live credentials or customer access.

## Deploy (explicit production approval required)

```sh
npm exec -- noodle status --org noodleseed --app tivmark-assistant --env prod --service https://cloud.noodleseed.dev --json
npm exec -- noodle deploy --org noodleseed --app tivmark-assistant --env prod --version <new-version> --access customers --service https://cloud.noodleseed.dev --no-save --no-prompt --json
```

Use the current supported public CLI with existing operator credentials. Confirm
the target and choose an unused version before publishing. Preserve `customers`
access and existing hosted configuration. Retain the SDK-exported manifest's
size and SHA-256 alongside the source revision and installed package versions.

Run one normal deployment, including its built-in preflight. If it fails, retain
the structured error, request ID, phase, and elapsed time; inspect those before
any further attempt. Do not use internal preflight imports, read CLI credential
files, or build a retry loop. Confirm hosted status and an authenticated customer
journey before claiming production readiness.

Put local managed secrets and variables in `.env.noodle` with `noodle secrets set` and
`noodle variables set`. The file is ignored by git and must not contain values you intend to share.

## Agent setup

`noodle init` generated non-secret project-local Codex and Claude Code instructions/skills. Commit those
files with `noodle.json`, and refresh them after CLI upgrades with `noodle agents setup --write`.

Your `src/server.ts` is yours: it compiles to portable manifest JSON (`noodle export manifest`) and runs
on the open-source engine you can self-host for free. See the Noodle self-host guide.
