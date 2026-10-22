#!/usr/bin/env bash
set -euo pipefail

# Used by the Run-Tests PostToolUse hook. When a route or service source
# file is modified, runs its corresponding unit/integration test file (if
# one exists) so regressions surface immediately rather than at commit time.
FILE="${1:-}"

if [[ "$FILE" != api/src/routes/*.ts ]] && [[ "$FILE" != api/src/services/*.ts ]]; then
  exit 0
fi

base=$(basename "$FILE" .ts)

cd api || exit 0

for dir in tests/unit tests/integration; do
  shopt -s nullglob
  matches=("$dir"/*"$base"*.test.ts)
  shopt -u nullglob
  for match in "${matches[@]}"; do
    pnpm exec jest "$match" --silent || true
  done
done

exit 0
