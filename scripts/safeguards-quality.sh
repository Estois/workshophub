#!/usr/bin/env bash
set -euo pipefail

# Checks that every REASONS canvas's Safeguards section has at least 2
# bullet points and references a concrete WH-<n> story somewhere in the
# canvas (filename or body) — guards against a generated canvas with a
# thin or generic Safeguards section.
#
# Exempt branches (same family as reasons-lint.sh/branch-name-check.sh):
# main and chore-/harness- branches don't carry a story-specific canvas.
branch=$(git rev-parse --abbrev-ref HEAD)

if [ "$branch" = "main" ] || echo "$branch" | grep -iqE '^(chore|harness)-'; then
  exit 0
fi

shopt -s nullglob
files=(spdd/prompt/*.md)
shopt -u nullglob

if [ ${#files[@]} -eq 0 ]; then
  echo "spdd/prompt/ has no canvas files — nothing to check"
  exit 0
fi

status=0

for file in "${files[@]}"; do
  safeguards=$(awk '/^## Safeguards/{flag=1; next} /^## /{flag=0} flag' "$file")

  bullet_count=$(printf '%s\n' "$safeguards" | grep -cE '^[0-9]+\.|^- ')
  if [ "$bullet_count" -lt 2 ]; then
    echo "$file: Safeguards section has $bullet_count bullet(s), needs at least 2"
    status=1
  fi

  if ! grep -qiE 'WH-[0-9]+' "$file"; then
    echo "$file: no WH-<n> reference found anywhere in the canvas"
    status=1
  fi
done

exit $status
