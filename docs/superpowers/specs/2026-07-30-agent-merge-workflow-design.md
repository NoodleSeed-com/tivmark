# Agent Merge Workflow Design

## Purpose

Make every repository-changing AI-agent task use an isolated, repository-local
Git worktree and integrate through an auto-merged pull request that creates a
real merge commit on `main`.

This policy prevents direct work on `main`, abandoned worktrees, stale topic
branches, and squash-merge history that makes completed work appear unmerged.

## Current State

- The repository has no root-level agent instructions.
- `.worktrees/` already exists as the repository-local worktree convention and
  is ignored by Git.
- `main` is not protected.
- GitHub auto-merge and automatic branch deletion are disabled.
- Merge commits, squash merges, and rebase merges are all currently allowed.
- Three recent topic branches were squash-merged. Their resulting trees are
  identical to their commits on `main`, so merging them again would add false
  history or risk undoing newer changes.
- The local clone retains 27 remote-tracking refs for branches that no longer
  exist on GitHub.
- Five merged human-authored branches still exist on GitHub.
- Twelve open Dependabot pull requests have failing CI.

## Repository Instructions

Create one canonical root `AGENTS.md` that applies to the entire repository.
It will require agents to:

1. Fetch and prune remote refs before starting.
2. Confirm the primary checkout is not used for implementation.
3. Create a dedicated branch from current `origin/main`.
4. Create or use `.worktrees/<branch-slug>` for all tracked-file changes,
   commits, tests, and PR preparation.
5. Preserve unrelated dirty work and never reuse another task's worktree.
6. Run relevant validation before pushing.
7. Push the topic branch and open a pull request targeting `main`.
8. Wait for relevant CI checks to pass.
9. Enable merge-commit auto-merge with
   `gh pr merge --auto --merge <pr-number>`.
10. Never squash-merge, rebase-merge, or push directly to `main`.
11. Verify that the PR reached `MERGED` before removing the worktree and local
    branch.
12. Stop and report a blocker instead of bypassing the PR or auto-merge
    workflow.

Root `CLAUDE.md` and `GEMINI.md` files will direct their respective agents to
read and obey the canonical `AGENTS.md`. Existing scoped instructions under
`apps/assistant/` remain in force for that subtree.

## GitHub Enforcement

Update repository settings to:

- enable auto-merge;
- enable automatic deletion of merged head branches;
- allow merge commits;
- disallow squash merges;
- disallow rebase merges; and
- allow pull request branches to be updated when behind `main`.

Protect `main` with:

- pull requests required for changes;
- zero required approving reviews, so autonomous auto-merge remains possible;
- force pushes disabled;
- branch deletion disabled; and
- administrator enforcement enabled so an administrative agent cannot
  accidentally bypass the pull-request route.

Relevant test workflows remain path-filtered. Agents must wait for every check
that applies to their changed paths before enabling auto-merge. Creating a new
universal CI orchestrator is intentionally outside this branch-hygiene change.

## Existing Branch Cleanup

Do not create synthetic merges for work already squash-merged. Instead:

1. Prune deleted remote-tracking refs.
2. Remove the clean `feature/mark-focused-chat` linked worktree.
3. Delete the four local branches whose PRs are already merged:
   `feature/mark-focused-chat`, `fix/noodle-cli-compat`,
   `fix/mark-assistant-ref-lifecycle`, and `greet-logged-in-user`.
4. Delete the five live GitHub branches whose PRs are already merged:
   the same four branches plus
   `claude/csp-halo-script-loading-N6iyJ`.

Cleanup must occur only after checking that each worktree is clean and each PR
is in the `MERGED` state. The branch-cleanup operations are operational state
changes and do not need to be represented as commits in the policy PR.

## Dependabot

Dependabot remains enabled in this change. It is GitHub's automated dependency
update service, configured here to check `apps/web` npm packages daily and
GitHub Actions weekly.

No failing Dependabot PR will be merged as part of branch cleanup. Its current
backlog requires separate technical triage because the upgrades include peer
dependency conflicts, lint failures, unit-test failures, and end-to-end test
failures. Disabling or redesigning dependency automation is outside this
workflow-policy change.

## Verification

Before opening the policy PR:

- verify root agent files contain the canonical workflow and do not contradict
  scoped instructions;
- verify `.worktrees/` remains ignored;
- verify Markdown has no placeholders or broken relative references;
- verify the worktree is clean except for intended commits; and
- inspect the final diff against `origin/main`.

After applying GitHub settings:

- read the repository settings back through the GitHub API;
- read `main` protection back through the GitHub API;
- open the policy PR from its worktree branch;
- enable auto-merge with merge-commit strategy;
- confirm the PR reaches `MERGED`; and
- confirm the merge commit is present on `origin/main`.

## Failure Handling

If branch protection, repository settings, CI, or auto-merge cannot be enabled,
leave the topic branch and worktree intact and report the exact blocker. Do not
fall back to a direct push, squash merge, rebase merge, or manual local merge
into `main`.
