# Repository Agent Workflow

## Scope and precedence

These instructions apply to every AI agent changing this repository.
More-specific `AGENTS.md`, `CLAUDE.md`, or `GEMINI.md` files may add
subtree-specific requirements, but they do not override this isolation and
integration workflow.

## Mandatory isolation

- Never implement changes in the primary checkout or directly on `main`.
- Before starting, fetch and prune `origin`, then base the task branch on the
  current `origin/main`.
- Use one dedicated branch and one matching child worktree under
  `.worktrees/` per task.
- Perform all edits, generated-file updates, commits, and validation inside
  that task worktree.
- If the current checkout is already a task worktree under `.worktrees/`, use
  it instead of creating a nested worktree.
- Preserve unrelated dirty work. Never switch, reset, clean, reuse, or remove
  another task's checkout or worktree.
- If a repository-local task worktree cannot be created, stop and report the
  blocker instead of editing in the primary checkout.

From the repository root, the normal setup is:

```bash
git fetch --prune origin
git worktree add .worktrees/BRANCH-SLUG -b BRANCH-NAME origin/main
cd .worktrees/BRANCH-SLUG
```

Choose descriptive, task-specific values for `BRANCH-SLUG` and `BRANCH-NAME`.
Do not reuse a branch or directory owned by another task.

## Validation and integration

- Run every local check relevant to the changed paths before integration.
- Push the topic branch and open a pull request with base `main`.
- Wait for every applicable GitHub check to pass. If the branch is behind
  `main`, update it through the pull request before integration.
- Enable merge-commit auto-merge from the task worktree with:

  ```bash
  gh pr merge --auto --merge "$(gh pr view --json number --jq .number)"
  ```

- Never use squash merge, rebase merge, a direct push to `main`, or a local
  merge into `main`.
- If auto-merge, branch protection, permissions, or CI blocks integration,
  stop and report the exact blocker. Do not bypass the workflow.

## Completion and cleanup

- Do not call work complete until GitHub reports the pull request as `MERGED`.
- Fetch and prune `origin`, then verify the PR's merge commit is reachable from
  `origin/main`.
- After merge, remove only the task's clean worktree and local topic branch
  from another checkout.
- The repository deletes merged remote branches automatically. Pruning removes
  their obsolete local remote-tracking refs.
- Never remove a worktree with uncommitted or untracked work.
