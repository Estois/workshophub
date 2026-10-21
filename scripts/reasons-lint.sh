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

if [ ! -d spdd/prompt ]; then
  exit 0
fi

shopt -s nullglob
files=(spdd/prompt/*.md)
shopt -u nullglob

if [ ${#files[@]} -eq 0 ]; then
  exit 0
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
