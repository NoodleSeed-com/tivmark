# Required Pull Request Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `main` require one always-present `pr-gate` status that fails
unless every validation suite relevant to a pull request's changed paths
passes.

**Architecture:** A tested shell classifier converts changed paths into web
and assistant booleans. An always-running pull-request workflow conditionally
calls the existing validation workflows and aggregates their results into one
stable required check. Existing push validation remains unchanged.

**Tech Stack:** GitHub Actions YAML, Bash, actionlint, GitHub branch protection
API.

## Global Constraints

- Work only on `ci/require-pr-gate` inside `.worktrees/require-pr-gate`.
- Preserve existing web and assistant validation commands, services, Node
  versions, and artifacts.
- Run both suites when the dispatcher or classifier changes.
- Documentation-only pull requests must produce `pr-gate` without running
  either application suite.
- Any failed, cancelled, or missing prerequisite must fail `pr-gate`.
- Do not require `pr-gate` in branch protection until its first successful
  pull-request run exists.
- Integrate only through merge-commit auto-merge.

---

### Task 1: Tested changed-path classifier

**Files:**

- Create: `.github/scripts/classify-pr-paths.test.sh`
- Create: `.github/scripts/classify-pr-paths.sh`

**Interfaces:**

- Consumes: NUL-delimited repository paths on standard input.
- Produces: `web=true|false` and `assistant=true|false`, one per line, for
  direct append to `$GITHUB_OUTPUT`.

- [ ] **Step 1: Write the classifier regression test**

Create `.github/scripts/classify-pr-paths.test.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

script_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
classifier="$script_dir/classify-pr-paths.sh"

assert_classification() {
  local expected=$1
  shift

  local actual
  actual=$(printf '%s\0' "$@" | "$classifier")

  if [[ "$actual" != "$expected" ]]; then
    printf 'expected:\n%s\nactual:\n%s\n' "$expected" "$actual" >&2
    return 1
  fi
}

assert_classification $'web=false\nassistant=false' \
  'docs/read me.md' \
  'AGENTS.md'
assert_classification $'web=true\nassistant=false' \
  'apps/web/components/$(not-executed).tsx'
assert_classification $'web=true\nassistant=false' \
  'package-lock.json'
assert_classification $'web=false\nassistant=true' \
  'apps/assistant/src/server.ts'
assert_classification $'web=true\nassistant=true' \
  '.github/workflows/pr-gate.yml'
assert_classification $'web=true\nassistant=true' \
  '.github/scripts/classify-pr-paths.test.sh'

printf 'classify-pr-paths tests passed\n'
```

- [ ] **Step 2: Run the test and confirm the missing implementation fails**

Run:

```bash
bash .github/scripts/classify-pr-paths.test.sh
```

Expected: non-zero exit because `classify-pr-paths.sh` does not exist.

- [ ] **Step 3: Implement the classifier**

Create `.github/scripts/classify-pr-paths.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

web=false
assistant=false

while IFS= read -r -d '' path; do
  case "$path" in
    apps/web/* | package.json | package-lock.json | \
      .github/workflows/web-ci.yml)
      web=true
      ;;
    apps/assistant/* | .github/workflows/assistant-ci.yml)
      assistant=true
      ;;
    .github/workflows/pr-gate.yml | \
      .github/scripts/classify-pr-paths.sh | \
      .github/scripts/classify-pr-paths.test.sh)
      web=true
      assistant=true
      ;;
  esac
done

printf 'web=%s\n' "$web"
printf 'assistant=%s\n' "$assistant"
```

- [ ] **Step 4: Make both scripts executable and rerun the test**

Run:

```bash
chmod +x \
  .github/scripts/classify-pr-paths.sh \
  .github/scripts/classify-pr-paths.test.sh
bash .github/scripts/classify-pr-paths.test.sh
```

Expected: `classify-pr-paths tests passed`.

- [ ] **Step 5: Commit the tested classifier**

```bash
git add \
  .github/scripts/classify-pr-paths.sh \
  .github/scripts/classify-pr-paths.test.sh
git commit -m "test(ci): add pull request path classifier"
```

### Task 2: Universal dispatcher and reusable suites

**Files:**

- Create: `.github/workflows/pr-gate.yml`
- Modify: `.github/workflows/web-ci.yml`
- Modify: `.github/workflows/assistant-ci.yml`

**Interfaces:**

- Consumes: The classifier outputs from Task 1.
- Produces: Conditional `web` and `assistant` jobs plus one displayed
  `pr-gate` result.

- [ ] **Step 1: Make existing suites reusable**

In both existing validation workflows, add `workflow_call:` under `on:` and
remove the direct `pull_request:` block. Keep every push trigger and job step
unchanged.

- [ ] **Step 2: Add the dispatcher**

Create `.github/workflows/pr-gate.yml`:

```yaml
name: pr-gate

on:
  pull_request:
    branches:
      - main

permissions:
  contents: read

jobs:
  changes:
    name: detect changes
    runs-on: ubuntu-latest
    outputs:
      web: ${{ steps.classify.outputs.web }}
      assistant: ${{ steps.classify.outputs.assistant }}
    steps:
      - uses: actions/checkout@v6
        with:
          ref: ${{ github.event.pull_request.head.sha }}
          fetch-depth: 0
      - name: Classify changed paths
        id: classify
        env:
          BASE_SHA: ${{ github.event.pull_request.base.sha }}
          HEAD_SHA: ${{ github.event.pull_request.head.sha }}
        run: |
          git diff --name-only -z "$BASE_SHA" "$HEAD_SHA" |
            .github/scripts/classify-pr-paths.sh >> "$GITHUB_OUTPUT"

  web:
    needs: changes
    if: needs.changes.outputs.web == 'true'
    uses: ./.github/workflows/web-ci.yml

  assistant:
    needs: changes
    if: needs.changes.outputs.assistant == 'true'
    uses: ./.github/workflows/assistant-ci.yml

  gate:
    name: pr-gate
    if: ${{ always() }}
    needs:
      - changes
      - web
      - assistant
    runs-on: ubuntu-latest
    steps:
      - name: Require every applicable suite
        env:
          CHANGES_RESULT: ${{ needs.changes.result }}
          WEB_RESULT: ${{ needs.web.result }}
          ASSISTANT_RESULT: ${{ needs.assistant.result }}
        run: |
          if [[ "$CHANGES_RESULT" != "success" ]]; then
            echo "Path detection did not succeed: $CHANGES_RESULT" >&2
            exit 1
          fi

          for result in "$WEB_RESULT" "$ASSISTANT_RESULT"; do
            case "$result" in
              success | skipped) ;;
              *)
                echo "An applicable validation suite did not succeed: $result" >&2
                exit 1
                ;;
            esac
          done
```

- [ ] **Step 3: Validate workflow structure**

Run:

```bash
actionlint
bash .github/scripts/classify-pr-paths.test.sh
rg -n 'workflow_call' \
  .github/workflows/web-ci.yml \
  .github/workflows/assistant-ci.yml
if rg -n 'pull_request:' \
  .github/workflows/web-ci.yml \
  .github/workflows/assistant-ci.yml; then
  exit 1
fi
rg -n 'name: pr-gate|uses: \./\.github/workflows/(web|assistant)-ci\.yml' \
  .github/workflows/pr-gate.yml
git diff --check
```

Expected: actionlint and classifier tests pass, each reusable workflow exposes
`workflow_call`, neither retains a direct pull-request trigger, and the
dispatcher contains the required name and calls.

- [ ] **Step 4: Run application regression tests**

Run:

```bash
npm test -- --runInBand
```

from `apps/web`, then:

```bash
npm run validate
npm test
```

from `apps/assistant`.

Expected: all web and assistant tests pass and assistant validation succeeds.

- [ ] **Step 5: Commit the dispatcher**

```bash
git add \
  .github/workflows/pr-gate.yml \
  .github/workflows/web-ci.yml \
  .github/workflows/assistant-ci.yml
git commit -m "ci: require path-aware pull request validation"
```

### Task 3: Publish, require, and auto-merge the gate

**Files:**

- Create: GitHub pull request from `ci/require-pr-gate` to `main`.
- Modify: `main` required status checks after the first successful gate run.

**Interfaces:**

- Consumes: Tasks 1 and 2.
- Produces: A required strict `pr-gate` status on `main`.

- [ ] **Step 1: Commit this implementation plan**

```bash
git add docs/superpowers/plans/2026-07-31-required-pr-gate.md
git commit -m "docs: plan required pull request gate"
```

- [ ] **Step 2: Run final local verification**

```bash
actionlint
bash .github/scripts/classify-pr-paths.test.sh
git diff --check origin/main...HEAD
git status --short
git log --oneline origin/main..HEAD
git diff --stat origin/main...HEAD
```

Expected: clean worktree, no validation errors, and only the design, plan,
classifier, test, and three workflow files differ from `origin/main`.

- [ ] **Step 3: Push and open the pull request**

```bash
git push -u origin ci/require-pr-gate
gh pr create \
  --base main \
  --head ci/require-pr-gate \
  --title "ci: require path-aware pull request validation" \
  --body "## Summary

- add one always-running pull request gate
- run web and assistant CI only for relevant paths
- fail closed when an applicable suite does not succeed

## Verification

- actionlint
- classifier regression tests
- web unit tests
- assistant validation and tests"
```

- [ ] **Step 4: Wait for the new gate and both called suites**

Run:

```bash
task_pr_number=$(gh pr view --json number --jq .number)
gh pr checks "$task_pr_number" --watch
```

Expected: the displayed `pr-gate` check, web reusable workflow, and assistant
reusable workflow all pass.

- [ ] **Step 5: Require the observed gate**

Update `main` protection with strict required status checks containing the
single context `pr-gate`, while preserving:

```json
{
  "enforce_admins": true,
  "required_approving_review_count": 0,
  "required_conversation_resolution": true,
  "required_linear_history": false,
  "allow_force_pushes": false,
  "allow_deletions": false
}
```

- [ ] **Step 6: Enable merge-commit auto-merge**

```bash
task_pr_number=$(gh pr view --json number --jq .number)
gh pr merge --auto --merge "$task_pr_number"
```

- [ ] **Step 7: Verify integration and protection**

```bash
task_pr_number=$(gh pr view --json number --jq .number)
task_merge_commit=$(
  gh pr view "$task_pr_number" --json mergeCommit --jq .mergeCommit.oid
)
gh pr view "$task_pr_number" --json state,mergedAt,mergeCommit,url
git fetch --prune origin
git merge-base --is-ancestor "$task_merge_commit" origin/main
gh api repos/NoodleSeed-com/tivmark/branches/main/protection
```

Expected: the pull request is merged by a two-parent merge commit reachable
from `origin/main`, and branch protection reports strict required context
`pr-gate`.

- [ ] **Step 8: Clean the merged task worktree**

From the primary checkout, confirm `.worktrees/require-pr-gate` is clean,
remove it, prune worktree metadata, and delete local branch
`ci/require-pr-gate`.
