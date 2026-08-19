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

assert_classification $'web=false\nassistant=false\nmarketing=false' \
  'docs/read me.md' \
  'AGENTS.md'
# This literal proves shell syntax in a filename is never evaluated.
# shellcheck disable=SC2016
assert_classification $'web=true\nassistant=false\nmarketing=false' \
  'apps/web/components/$(not-executed).tsx'
assert_classification $'web=true\nassistant=false\nmarketing=false' \
  'package-lock.json'
assert_classification $'web=true\nassistant=false\nmarketing=false' \
  'scripts/sync-web-lockfile.sh'
assert_classification $'web=false\nassistant=true\nmarketing=false' \
  'apps/assistant/src/server.ts'
assert_classification $'web=true\nassistant=true\nmarketing=true' \
  '.github/workflows/pr-gate.yml'
assert_classification $'web=true\nassistant=true\nmarketing=true' \
  '.github/scripts/classify-pr-paths.test.sh'
assert_classification $'web=false\nassistant=false\nmarketing=true' \
  'apps/marketing/index.html'
assert_classification $'web=false\nassistant=false\nmarketing=true' \
  'apps/marketing/nginx.conf'

printf 'classify-pr-paths tests passed\n'
