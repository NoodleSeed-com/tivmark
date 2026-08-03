#!/usr/bin/env bash
# Regenerate apps/web/package-lock.json as a standalone lockfile.
#
# The repo carries two lockfiles for apps/web:
#   - ./package-lock.json          the npm workspace root; what `npm install`
#                                  from apps/web actually writes, and what
#                                  web-ci installs from.
#   - ./apps/web/package-lock.json standalone; the Docker build context is
#                                  apps/web alone, so `npm ci` in the image and
#                                  in deploy-web.yml reads this one.
#
# npm only ever updates the workspace root, so any dependency change leaves the
# standalone lockfile behind and `npm ci` then fails the deploy. Regenerating it
# needs npm to *not* discover the workspace root, so the package is resolved in a
# scratch directory with no parent package.json.
#
# Usage: scripts/sync-web-lockfile.sh [--check]
#   --check  exit non-zero if the committed lockfile is out of date

set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
web_dir="$repo_root/apps/web"
lockfile="$web_dir/package-lock.json"

check_only=false
if [[ "${1:-}" == "--check" ]]; then
  check_only=true
elif [[ $# -gt 0 ]]; then
  echo "usage: $0 [--check]" >&2
  exit 2
fi

work_dir="$(mktemp -d)"
trap 'rm -rf "$work_dir"' EXIT

cp "$web_dir/package.json" "$work_dir/package.json"
cp "$lockfile" "$work_dir/package-lock.json"

# --package-lock-only resolves the tree without downloading or linking anything.
( cd "$work_dir" && npm install --package-lock-only --ignore-scripts >/dev/null )

if $check_only; then
  # Compare what `npm ci` actually depends on -- the resolved version of every
  # entry -- rather than the file byte-for-byte. npm writes cosmetic metadata
  # (`libc`, field ordering) that varies by npm version and host platform, so a
  # textual diff reports drift on any runner whose npm differs from the author's.
  node - "$lockfile" "$work_dir/package-lock.json" <<'NODE'
const { resolve } = require('node:path');
const [, , committedPath, freshPath] = process.argv;
const versions = (p) =>
  Object.fromEntries(
    Object.entries(require(resolve(p)).packages ?? {}).map(([k, v]) => [
      k,
      v.version ?? '',
    ]),
  );

const committed = versions(committedPath);
const fresh = versions(freshPath);
const drift = [...new Set([...Object.keys(committed), ...Object.keys(fresh)])]
  .filter((k) => committed[k] !== fresh[k])
  .sort();

if (drift.length === 0) {
  console.log('apps/web/package-lock.json is up to date.');
  process.exit(0);
}

console.error('apps/web/package-lock.json is out of date with apps/web/package.json.');
console.error('Run scripts/sync-web-lockfile.sh and commit the result.\n');
for (const k of drift.slice(0, 40)) {
  console.error(`  ${k || '(root)'}: ${committed[k] ?? '(absent)'} -> ${fresh[k] ?? '(absent)'}`);
}
if (drift.length > 40) console.error(`  ...and ${drift.length - 40} more`);
process.exit(1);
NODE
  exit 0
fi

cp "$work_dir/package-lock.json" "$lockfile"
echo "Regenerated apps/web/package-lock.json."
