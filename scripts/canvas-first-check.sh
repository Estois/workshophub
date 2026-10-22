#!/usr/bin/env bash
set -euo pipefail

# Used by the Canvas-First PreToolUse hook. Blocks Write/Edit on code files
# (api/src, app/src) if the current branch has no spdd/prompt/*.md canvas
# yet — enforces "write the REASONS canvas before writing code."
#
# Exempt: main, chore-/harness- branches (no story canvas expected), and
# any file outside api/src or app/src (canvas files, scripts, docs, etc.
# must always be editable).
FILE="${1:-}"

if [[ "$FILE" != api/src/* ]] && [[ "$FILE" != app/src/* ]]; then
  exit 0
fi

branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")

if [ "$branch" = "main" ] || echo "$branch" | grep -iqE '^(chore|harness)-'; then
  exit 0
fi

shopt -s nullglob
files=(spdd/prompt/*.md)
shopt -u nullglob

if [ ${#files[@]} -eq 0 ]; then
  echo "No REASONS canvas found in spdd/prompt/ — write one (/spdd-reasons-canvas) before editing $FILE" >&2
  exit 2
fi

exit 0
