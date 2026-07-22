<!-- BEGIN NOODLE AGENT CONTEXT -->
<!-- noodle-agent-kit:0.29.0 hash:9945f8d8122b4176 -->
# Noodle Seed Project Context

Agent target: Claude Code.

Build this project as a Noodle Seed MCP server or app authored in TypeScript. This is an agent-native CLI: every command speaks `--json`, so drive the loop below by parsing machine state — not by reading source or scraping human prose.

## Agent-native loop

- **Read the skill first**: read the `noodle-seed` skill `SKILL.md` and scan its `references/` index (including `references/examples.md`) so you build from the shipped patterns — list-returning connectors, secret scoping, widgets, testing — instead of rediscovering them.
- Discover: `noodle commands --json` — every command, flag, and exit code (don't read source).
- Design the experience before authoring — the funnel/handoff boundary, tools, widgets, and grounding — see the `noodle-seed` skill `references/experience-design.md`.
- Author: edit `src/server.ts` — follow the capability recipe in the `noodle-seed` skill.
- Validate: `noodle validate --json` → on failure `{ok:false,error:{code,message,fix,next,errors:[{code,path,message}]}}`; per-field detail is in `error.errors[]`.
- Repair: fix each `error.errors[]` entry at its `path`, re-run validate; `noodle validate --fix-prompt` gives ready repair prose. Never freeform re-edit.
- Smoke: `noodle test --json`.
- Apps/widgets: `noodle check --json` (add `--target chatgpt|claude`) then `noodle devtools`.
- Deploy: `noodle deploy` (auth fails clean → `error.next` = `noodle login`).
- Wire into a host: `noodle connect <codex|claude-code|chatgpt>`.
- Health: `noodle metrics --agent-output`.
- Stale skill? `noodle agents doctor --json` → `noodle agents setup --write`.

The exact `--json`/exit-code contract is in the `noodle-seed` skill and its `references/agent-contract.md`. Human-oriented command prose lives in the project README, not here.

## Widget design default

Generated widgets, official examples, and agent-authored MCP Apps must start with `@noodleseed/one/react` primitives and semantic tokens. Custom React/CSS or third-party components remain valid when the kit lacks the required behavior or the developer explicitly requests them.

## Safety

- Keep secrets, bearer tokens, refresh tokens, static access keys, `.env.noodle` values, and `~/.noodle/config.json` out of prompts, logs, docs, tests, and generated files.
- Do not hand-author manifest JSON or YAML, runtime artifact JSON, connector IR, or hosted asset metadata.
- Do not add static data-plane credential paths; hosted access is identity-based.

## Project Defaults

- name: tivmark-assistant
- entrypoint: src/server.ts
- env: prod
- access: customers
- template: widget
- org: noodleseed
- app: tivmark-assistant

Generated Noodle agent files are project-local and non-secret. Refresh them with `noodle agents setup --write`.
<!-- END NOODLE AGENT CONTEXT -->
