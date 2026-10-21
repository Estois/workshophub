#!/usr/bin/env bash
set -euo pipefail

REQUIRED_HEADINGS=(
  "## Requirements"
  "## Entities"
  "## Approach"
  "## Structure"
  "## Operations"
  "## Norms"
  "## Safeguards"
)

branch=$(git rev-parse --abbrev-ref HEAD)

if [ "$branch" = "main" ] || echo "$branch" | grep -iqE '^(chore|harness)-'; then
  exit 0
fi

if [ ! -d spdd/prompt ]; then
  echo "spdd/prompt/ missing: REASONS canvas is required for this branch"
  exit 1
fi

shopt -s nullglob
files=(spdd/prompt/*.md)
shopt -u nullglob

if [ ${#files[@]} -eq 0 ]; then
  echo "spdd/prompt/ has no canvas files: REASONS canvas is required for this branch"
  exit 1
fi

status=0

for file in "${files[@]}"; do
  for heading in "${REQUIRED_HEADINGS[@]}"; do
    if ! grep -qxF "$heading" "$file"; then
      echo "$file: missing '$heading'"
      status=1
    fi
  done
done

exit $status
