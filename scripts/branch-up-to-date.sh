#!/usr/bin/env bash
set -euo pipefail

# Ensures the current branch has merged/rebased the latest origin/main
# before allowing a commit, so PRs don't go stale and conflict silently.
branch=$(git rev-parse --abbrev-ref HEAD)

if [ "$branch" = "main" ]; then
  exit 0
fi

if ! git remote get-url origin >/dev/null 2>&1; then
  echo "no 'origin' remote configured — skipping up-to-date check"
  exit 0
fi

git fetch origin main --quiet 2>/dev/null || {
  echo "could not fetch origin/main — skipping up-to-date check (offline?)"
  exit 0
}

behind=$(git rev-list --count HEAD..origin/main)

if [ "$behind" -gt 0 ]; then
  echo "Branch '$branch' is $behind commit(s) behind origin/main."
  echo "Run: git merge origin/main (or rebase) before committing."
  exit 1
fi

exit 0
