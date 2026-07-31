# Agent Merge Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Require repository-changing agents to work in `.worktrees/` and
integrate through auto-merged pull requests that create merge commits on
`main`.

**Architecture:** A canonical root `AGENTS.md` defines the workflow, while
small root adapters make Claude and Gemini consume the same policy. GitHub
repository settings and `main` protection enforce the merge strategy and PR
route. Operational cleanup removes already-merged worktrees and branch refs
without manufacturing duplicate history.

**Tech Stack:** Markdown, Git worktrees, GitHub repository API, GitHub CLI.

## Global Constraints

- All tracked-file changes must be made on a dedicated branch in a child
  directory of `.worktrees/` whose name matches the branch slug.
- Integration must use a pull request targeting `main`.
- Pull requests must use merge-commit auto-merge.
- Direct pushes, squash merges, and rebase merges to `main` are prohibited.
- Existing squash-merged work must be cleaned up, not merged a second time.
- Failing Dependabot pull requests must remain unmerged.
- Unrelated dirty work in other worktrees must remain untouched.

---

### Task 1: Canonical agent workflow

**Files:**

- Create: `AGENTS.md`
- Create: `CLAUDE.md`
- Create: `GEMINI.md`

**Interfaces:**

- Consumes: Git, GitHub CLI, the ignored `.worktrees/` directory.
- Produces: Repository-wide instructions consumed by future AI agents.

- [ ] **Step 1: Create the canonical root instructions**

Create `AGENTS.md` with these enforceable sections:

```markdown
# Repository Agent Workflow

## Scope and precedence

These instructions apply to every AI agent changing this repository.
More-specific `AGENTS.md`, `CLAUDE.md`, or `GEMINI.md` files may add
subtree-specific requirements, but they do not override this integration
workflow.

## Mandatory isolation

- Never implement changes in the primary checkout or directly on `main`.
- Fetch and prune `origin`, then branch from current `origin/main`.
- Use one dedicated branch and one matching child worktree under `.worktrees/`
  per task.
- Perform all edits, generated-file updates, commits, and validation inside
  that worktree.
- Preserve unrelated dirty work. Never reuse or remove another task's
  worktree.

## Validation and integration

- Run every check relevant to the changed paths before integration.
- Push the topic branch and open a pull request with base `main`.
- Wait for every applicable GitHub check to pass.
- Enable merge-commit auto-merge with
  `gh pr merge --auto --merge "$(gh pr view --json number --jq .number)"`.
- Never use squash merge, rebase merge, a direct push to `main`, or a local
  merge into `main`.
- If auto-merge, branch protection, permissions, or CI blocks integration,
  stop and report the blocker. Do not bypass the workflow.

## Completion and cleanup

- Do not call work complete until GitHub reports the pull request as `MERGED`.
- Verify the merge commit is reachable from `origin/main`.
- After merge, remove only the task's clean worktree and local topic branch.
- The repository deletes merged remote branches automatically; fetch with
  pruning to remove obsolete remote-tracking refs.
```

- [ ] **Step 2: Add cross-agent adapters**

Create `CLAUDE.md` and `GEMINI.md` with:

```markdown
# Repository Instructions

Read and obey the repository-root `AGENTS.md` before taking any action.
Subdirectory-specific instructions add to, but do not replace, that workflow.
```

- [ ] **Step 3: Validate the instruction files**

Run:

```bash
test -s AGENTS.md
test -s CLAUDE.md
test -s GEMINI.md
git check-ignore -q .worktrees
rg -n "gh pr merge --auto --merge" AGENTS.md
rg -n "Never implement changes.*main" AGENTS.md
git diff --check
```

Expected: every command exits successfully and the searches return one policy
line each.

- [ ] **Step 4: Commit the repository instructions**

```bash
git add AGENTS.md CLAUDE.md GEMINI.md
git commit -m "docs: enforce agent pull request workflow"
```

### Task 2: GitHub merge enforcement

**Files:**

- Modify: GitHub repository settings for `NoodleSeed-com/tivmark`.
- Modify: GitHub branch protection for `main`.

**Interfaces:**

- Consumes: Administrative GitHub access through `gh`.
- Produces: PR-only integration, merge-commit auto-merge, and automatic remote
  branch deletion.

- [ ] **Step 1: Enable the repository merge settings**

Run:

```bash
gh api --method PATCH repos/NoodleSeed-com/tivmark \
  -F allow_auto_merge=true \
  -F delete_branch_on_merge=true \
  -F allow_merge_commit=true \
  -F allow_squash_merge=false \
  -F allow_rebase_merge=false \
  -F allow_update_branch=true
```

- [ ] **Step 2: Protect `main`**

Send this JSON body to
`PUT repos/NoodleSeed-com/tivmark/branches/main/protection`:

```json
{
  "required_status_checks": null,
  "enforce_admins": true,
  "required_pull_request_reviews": {
    "dismiss_stale_reviews": false,
    "require_code_owner_reviews": false,
    "required_approving_review_count": 0,
    "require_last_push_approval": false
  },
  "restrictions": null,
  "required_linear_history": false,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "block_creations": false,
  "required_conversation_resolution": true,
  "lock_branch": false,
  "allow_fork_syncing": true
}
```

- [ ] **Step 3: Read settings back**

Run:

```bash
gh api repos/NoodleSeed-com/tivmark --jq \
  '{allow_auto_merge,delete_branch_on_merge,allow_merge_commit,allow_squash_merge,allow_rebase_merge,allow_update_branch}'
gh api repos/NoodleSeed-com/tivmark/branches/main/protection
```

Expected: auto-merge, branch deletion, merge commits, and branch updates are
enabled; squash and rebase are disabled; PR reviews are required with zero
approvals; admin enforcement is enabled; force pushes and deletion are
disabled.

### Task 3: Verify, publish, and auto-merge the policy

**Files:**

- Verify: all committed files against `origin/main`.
- Create: GitHub pull request targeting `main`.

**Interfaces:**

- Consumes: Tasks 1 and 2.
- Produces: A merge commit on `main` containing the specification, plan, and
  agent instructions.

- [ ] **Step 1: Run final local verification**

```bash
git diff --check origin/main...HEAD
git status --short
git log --oneline origin/main..HEAD
git diff --stat origin/main...HEAD
```

Expected: no whitespace errors, a clean worktree, the intended commits only,
and changes limited to the specification, plan, and root instruction files.

- [ ] **Step 2: Push and open the pull request**

```bash
git push -u origin chore/enforce-agent-merge-workflow
gh pr create \
  --base main \
  --head chore/enforce-agent-merge-workflow \
  --title "docs: enforce agent merge workflow" \
  --body "## Summary

- require repository-local worktrees for agent changes
- require merge-commit auto-merge through pull requests
- document and enforce branch cleanup

## Verification

- instruction policy assertions
- Markdown whitespace validation
- GitHub settings read-back"
```

- [ ] **Step 3: Enable merge-commit auto-merge**

```bash
task_pr_number=$(gh pr view --json number --jq .number)
gh pr merge --auto --merge "$task_pr_number"
```

- [ ] **Step 4: Verify integration**

```bash
task_pr_number=$(gh pr view --json number --jq .number)
task_merge_commit=$(gh pr view "$task_pr_number" --json mergeCommit --jq .mergeCommit.oid)
gh pr view "$task_pr_number" --json state,mergedAt,mergeCommit,url
git fetch --prune origin
git merge-base --is-ancestor "$task_merge_commit" origin/main
```

Expected: the pull request state is `MERGED` and its merge commit is reachable
from `origin/main`.

### Task 4: Remove already-merged branch clutter

**Files:**

- Remove: clean linked worktree `.worktrees/mark-focused-chat`.
- Remove: four merged local topic branches.
- Remove: five merged remote topic branches.
- Prune: deleted `origin/*` tracking refs.

**Interfaces:**

- Consumes: GitHub PR states for pull requests 1, 20, 42, 43, and 44.
- Produces: A branch list containing active work only.

- [ ] **Step 1: Revalidate cleanup targets**

Confirm the linked worktree is clean and that PRs 1, 20, 42, 43, and 44 all
report `MERGED`. Stop if any condition differs.

- [ ] **Step 2: Remove the obsolete linked worktree**

```bash
git worktree remove \
  /Users/fahdrafi/VSCode/noodle-seed/tivmark/.worktrees/mark-focused-chat
```

- [ ] **Step 3: Delete merged local branches**

Delete `greet-logged-in-user` normally. Force-delete the three squash-merged
local branches only after confirming their PR state and previously verified
tree equivalence:

```bash
git branch -d greet-logged-in-user
git branch -D feature/mark-focused-chat
git branch -D fix/noodle-cli-compat
git branch -D fix/mark-assistant-ref-lifecycle
```

- [ ] **Step 4: Delete merged GitHub branches**

Delete:

```text
claude/csp-halo-script-loading-N6iyJ
feature/mark-focused-chat
fix/mark-assistant-ref-lifecycle
fix/noodle-cli-compat
greet-logged-in-user
```

- [ ] **Step 5: Prune and verify**

```bash
git fetch --prune origin
git worktree list
git branch --all --verbose
gh api repos/NoodleSeed-com/tivmark/branches --paginate --jq '.[].name'
```

Expected: the obsolete worktree and merged branch names are absent. `main`,
the current OAuth worktree branch, the policy worktree until its local cleanup,
and the twelve open Dependabot branches remain.

- [ ] **Step 6: Remove the merged policy worktree and local branch**

After confirming the policy PR is merged and this worktree is clean, remove
this worktree from another checkout and delete
`chore/enforce-agent-merge-workflow`.
