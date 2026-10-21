#!/usr/bin/env bash
set -euo pipefail

branch=$(git rev-parse --abbrev-ref HEAD)

if [ "$branch" = "main" ]; then
  exit 0
fi

if echo "$branch" | grep -iqE 'wh-[0-9]+'; then
  exit 0
fi

if echo "$branch" | grep -iqE '^(harness|chore)-'; then
  exit 0
fi

echo "branch '$branch' does not match expected pattern (contains 'wh-<digits>', is 'main', or starts with 'harness-'/'chore-')"
exit 1
