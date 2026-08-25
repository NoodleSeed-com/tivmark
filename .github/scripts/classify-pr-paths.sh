#!/usr/bin/env bash
set -euo pipefail

web=false
assistant=false
marketing=false

while IFS= read -r -d '' path; do
  case "$path" in
    apps/web/* | package.json | package-lock.json | \
      scripts/sync-web-lockfile.sh | \
      .github/workflows/web-ci.yml)
      web=true
      ;;
    apps/assistant/* | .github/workflows/assistant-ci.yml)
      assistant=true
      ;;
    apps/marketing/* | .github/workflows/marketing-ci.yml)
      marketing=true
      ;;
    .github/workflows/pr-gate.yml | \
      .github/scripts/classify-pr-paths.sh | \
      .github/scripts/classify-pr-paths.test.sh)
      web=true
      assistant=true
      marketing=true
      ;;
  esac
done

printf 'web=%s\n' "$web"
printf 'assistant=%s\n' "$assistant"
printf 'marketing=%s\n' "$marketing"
