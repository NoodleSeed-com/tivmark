# Assistant Showcase Simplification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> `superpowers:subagent-driven-development` or `superpowers:executing-plans` to
> implement this plan task-by-task.

**Goal:** Preserve Mark's polished people-ops demonstration while removing
greeting personalization and turning `src/server.ts` into a concise Noodle Seed
composition overview.

**Architecture:** Keep the deployable server definition in Noodle's required
single-file authoring boundary. Put the declarative composition first, followed
by labeled, foldable helpers for schemas, connector declarations, instructions,
and capability-specific tool groups.

**Tech Stack:** TypeScript, `@noodleseed/one`, React MCP Apps, Vitest, Jest,
Next.js, and the Noodle CLI.

## Global constraints

- Work only in the task worktree based on current `origin/main`.
- Preserve every operational tool, guided form, confirmation gate, widget,
  auth path, and welcome UI except the explicitly removed greeting behavior.
- Keep complete-list API semantics unchanged.
- Validate locally and integrate only through a merge-commit pull request.

## Tasks

1. Update assistant manifest tests first to require the exact retained tool
   surface, business titles, `my_teams.contextProvider`, and no session claims;
   run them and observe the expected failures.
2. Remove `greet`, display-name session claims, and name-personalization
   instructions; add titles and the context-provider marker; rerun the focused
   tests to green.
3. Reorder `server.ts` around a composition-first overview and labeled helper
   sections for contracts, connector configuration, instructions, context,
   time-off, equipment, and review definitions. Rerun the entire assistant test
   suite plus `noodle validate --json` after the refactor.
4. Add a focused web API test that proves session exchange keeps verified
   identity and preferences without a personalization claim. Observe it fail,
   remove the `claims.displayName` payload, and rerun the test and web type
   check.
5. Run the full assistant suite, `noodle validate --json`,
   `noodle test --json`, and `noodle check --json` for ChatGPT, Claude, and the
   embedded assistant. Confirm the title and context-provider warnings are
   gone and document the intentionally retained list advisory.
6. Commit, push, open a pull request against `main`, enable merge-commit
   auto-merge, wait for all checks and the `MERGED` state, verify the merge
   commit is reachable from `origin/main`, and remove only the clean task
   worktree and local branch.
