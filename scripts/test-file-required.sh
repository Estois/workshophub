#!/usr/bin/env bash
set -euo pipefail

# Requires a test file change whenever a route or service file changes in
# the same commit — checked against staged changes (pre-commit context).
branch=$(git rev-parse --abbrev-ref HEAD)

if [ "$branch" = "main" ] || echo "$branch" | grep -iqE '^(chore|harness)-'; then
  exit 0
fi

staged=$(git diff --cached --name-only --diff-filter=ACM)

code_changed=$(echo "$staged" | grep -E '^api/src/(routes|services)/.*\.ts$' || true)
if [ -z "$code_changed" ]; then
  exit 0
fi

tests_changed=$(echo "$staged" | grep -E '^api/tests/.*\.ts$' || true)
if [ -z "$tests_changed" ]; then
  echo "Route/service files changed without a corresponding test file change:"
  echo "$code_changed" | sed 's/^/  /'
  echo "Add or update a test in api/tests/ before committing."
  exit 1
fi

exit 0
