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

## Dependency updates

- `apps/web` carries two lockfiles and they desync in opposite directions.
  Never hand-edit either one.
  - `npm install` writes only the workspace-root `package-lock.json`. The Docker
    build context is `apps/web` alone, so its `npm ci` — and the one in
    `deploy-web.yml` — reads `apps/web/package-lock.json` instead.
  - After any dependency change run `scripts/sync-web-lockfile.sh`, then commit
    both lockfiles.
  - `web-ci` enforces both halves, and both are needed:
    `scripts/sync-web-lockfile.sh --check` covers the standalone lockfile,
    `npm ci --dry-run` covers the workspace-root one.
- Majors that are blocked upstream are listed with their reasons in
  `.github/dependabot.yml`. Each was attempted and reverted, not assumed. Read
  the reason before removing an entry.
- Keep majors grouped. `zod` and `@asteasolutions/zod-to-openapi` have mutually
  exclusive peer ranges across the v3/v4 boundary, so they fail to resolve
  individually and succeed only in one pull request.
- A pull request merged by the auto-merge workflow is committed by
  `GITHUB_TOKEN`, and GitHub does not trigger workflows from those pushes, so no
  deploy runs for it. After a Dependabot pull request merges, check whether
  `deploy-web.yml` ran against the new `main`, and dispatch it if not:

  ```bash
  gh workflow run deploy-web.yml --ref main
  ```

## Open follow-ups

Each needs its own branch and pull request, under the workflow above. Ordered by
what unblocks the most.

1. Give the auto-merge step in `.github/workflows/dependabot-auto-merge.yml` a
   PAT or GitHub App token. Until then every auto-merged dependency update lands
   on `main` undeployed, and someone has to notice. Needs a repository owner to
   create the secret; an agent cannot.
2. React 19 and Next 16, together. Blocked by `@boxyhq/react-ui@3.5.3`, which
   declares `react` and `react-dom` as dependencies capped at `^18` while its
   peer ranges allow `^19`. That duplicates React and breaks prerendering, and
   npm `overrides` do not collapse it. Also drags in a tsconfig
   `moduleResolution` change and new React Compiler lint rules. Unblocks
   `eslint` 10, which `eslint-config-next@15` holds at `^9`.
3. Prisma 7. `url` moves out of the schema datasource into `prisma.config.ts`
   and `PrismaClient` requires a driver adapter. `main` pushes the prod schema
   on merge, so stage this deliberately.
4. The i18n cluster (`i18next`, `react-i18next`, `next-i18next`). When it lands,
   delete the local `Trans` prop type in
   `apps/web/pages/well-known/saml-configuration.tsx`, which exists only to work
   around the v17-style typing.
5. Tailwind 4. Requires daisyUI 5, which strands `react-daisyui` — unmaintained
   since 2024 and imported by 44 files.
6. `nodemailer` 9, once next-auth v5 lands and its `^7` peer is gone.
7. Decide whether `apps/assistant` should receive Dependabot version updates. It
   has none today; security alerts cover it regardless.
