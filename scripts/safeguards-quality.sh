#!/usr/bin/env bash
set -euo pipefail

# Checks the current branch's own REASONS canvas for a Safeguards section
# with at least 2 bullet points, and a reference to a concrete WH-<n>
# story somewhere in the canvas — guards against a generated canvas with a
# thin or generic Safeguards section.
#
# Scoping note: branch names use the story number (e.g. wh-4-...) but
# canvas filenames use the fork's own issue number (e.g. WH-10-...), so
# these two numbers don't correspond and can't be matched by name. Instead
# this checks only the most-recently-modified canvas file, on the
# assumption (true of this repo's actual workflow) that a canvas is
# written once, immediately before implementation begins on that branch —
# so the newest one is the current branch's. This means a thin Safeguards
# section in an older, already-merged canvas never blocks commits on an
# unrelated later branch.
#
# Exempt branches (same family as reasons-lint.sh/branch-name-check.sh):
# main and chore-/harness- branches don't carry a story-specific canvas.
branch=$(git rev-parse --abbrev-ref HEAD)

if [ "$branch" = "main" ] || echo "$branch" | grep -iqE '^(chore|harness)-'; then
  exit 0
fi

shopt -s nullglob
all_files=(spdd/prompt/*.md)
shopt -u nullglob

if [ ${#all_files[@]} -eq 0 ]; then
  echo "spdd/prompt/ has no canvas files — nothing to check"
  exit 0
fi

newest=$(ls -t "${all_files[@]}" | head -n1)
files=("$newest")

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
