# Required Pull Request Gate Design

## Purpose

Make GitHub, rather than agent convention alone, prevent pull requests from
merging until every validation suite relevant to their changed paths passes.

The repository will expose one stable required status check named `pr-gate`.
Documentation-only and policy-only pull requests will receive that check
without paying the cost of the web or assistant test suites.

## Current State

- `main` requires pull requests and merge commits.
- Auto-merge is enabled.
- `web-ci` and `assistant-ci` are filtered independently by changed paths.
- Branch protection has no required status checks.
- An agent can therefore request auto-merge before a path-filtered workflow
  finishes, and GitHub has no required check that forces it to wait.

## Approaches Considered

### Run both suites for every pull request

This is mechanically simple but unnecessarily runs browser, database, build,
and assistant validation for documentation-only changes.

### Poll independent workflow results

An always-running job could query GitHub for `web-ci` and `assistant-ci`.
This retains the existing files but introduces race conditions between
workflow creation, status discovery, reruns, and API polling.

### Dispatch reusable workflows and aggregate their results

This is the selected design. One pull-request workflow determines what
changed, conditionally invokes the existing suites as reusable workflows, and
publishes a final fail-closed result.

## Workflow Architecture

Create `.github/workflows/pr-gate.yml` with four jobs:

1. `changes` checks out the pull request head with full history, diffs the pull
   request base and head commits, and emits `web` and `assistant` boolean
   outputs.
2. `web` calls `.github/workflows/web-ci.yml` only when `web` is true.
3. `assistant` calls `.github/workflows/assistant-ci.yml` only when
   `assistant` is true.
4. `gate` runs with `if: always()`, is displayed as `pr-gate`, and succeeds
   only when:
   - `changes` succeeded; and
   - each conditional suite either succeeded or was skipped.

Any cancelled, failed, or missing prerequisite causes `pr-gate` to fail.

## Path Classification

The web suite runs for:

- `apps/web/**`;
- the root `package.json` or `package-lock.json`;
- `.github/workflows/web-ci.yml`; or
- either `.github/scripts/classify-pr-paths.sh` or its test; or
- `.github/workflows/pr-gate.yml`.

The assistant suite runs for:

- `apps/assistant/**`;
- `.github/workflows/assistant-ci.yml`; or
- either `.github/scripts/classify-pr-paths.sh` or its test; or
- `.github/workflows/pr-gate.yml`.

Changing `pr-gate.yml` deliberately runs both suites. Other documentation,
agent instructions, and repository-policy files run only the fast detector
and final gate.

Path detection uses a NUL-delimited `git diff` loop so filenames containing
spaces or shell metacharacters cannot corrupt classification.

The classifier lives in `.github/scripts/classify-pr-paths.sh`, reads
NUL-delimited paths from standard input, and prints GitHub-compatible
`web=true|false` and `assistant=true|false` outputs. A repository test covers
documentation-only, web, assistant, root-package, workflow, and
shell-metacharacter filenames.

## Reusable Validation Workflows

Update `web-ci.yml` and `assistant-ci.yml` to accept `workflow_call`.

Their existing push triggers remain unchanged so merges to `main` and
`release` still validate and surface deployment-adjacent regressions. Their
direct `pull_request` triggers are removed to avoid duplicate validation; all
pull-request execution flows through `pr-gate.yml`.

The validation jobs, services, Node versions, commands, and artifacts remain
unchanged.

## Branch Protection Rollout

The new status cannot be required before GitHub has observed it. Rollout is:

1. Push this branch and open its pull request.
2. Let the pull request execute `pr-gate`; changing `pr-gate.yml` runs both
   validation suites.
3. Confirm `pr-gate`, web validation, and assistant validation succeed.
4. Update `main` protection so required status checks are strict and contain
   the exact context `pr-gate`.
5. Request merge-commit auto-merge.
6. Confirm the pull request merges and the new merge commit is reachable from
   `origin/main`.
7. Read branch protection back and confirm `pr-gate` remains required.

If GitHub does not expose the expected check name or any suite fails, leave
branch protection unchanged and stop with the worktree intact.

## Validation

Local verification will:

- run the installed `actionlint` binary against every workflow;
- run the path-classifier regression test;
- assert that `pr-gate.yml` has a pull-request trigger, the four designed jobs,
  reusable workflow calls, and a final job named `pr-gate`;
- assert that `web-ci.yml` and `assistant-ci.yml` expose `workflow_call` and no
  longer expose direct pull-request triggers;
- run the web unit suite;
- run assistant validation and tests; and
- inspect the final diff and whitespace.

GitHub verification will use the actual pull request checks as the
authoritative validation of workflow syntax and orchestration.

## Scope

This change does not modify Dependabot configuration, application code,
deployment workflows, test commands, or approval requirements. Dependabot
pull requests will receive `pr-gate` the next time GitHub emits a pull-request
event for them.
