# Assistant

## Run locally (no account, no login)

```sh
noodle dev
```

`noodle dev` boots a local loopback MCP server on `src/server.ts` and hot-reloads on save. For a
one-shot check, run `noodle validate` (compile only) or `noodle test` (compile + MCP smoke).

## Deploy (requires a Noodle Seed account)

```sh
noodle login
noodle deploy --org <org> --app assistant
```

`noodle deploy` infers and saves the target on first run, so later deploys are just `noodle deploy`. (Optional: `noodle link --org <org> --app assistant` saves the target up front; `noodle start` scaffolds + deploys in one step.)

Put local managed secrets and variables in `.env.noodle` with `noodle secrets set` and
`noodle variables set`. The file is ignored by git and must not contain values you intend to share.

## Agent setup

`noodle init` generated non-secret project-local Codex and Claude Code instructions/skills. Commit those
files with `noodle.json`, and refresh them after CLI upgrades with `noodle agents setup --write`.

Your `src/server.ts` is yours: it compiles to portable manifest JSON (`noodle export manifest`) and runs
on the open-source engine you can self-host for free. See the Noodle self-host guide.
