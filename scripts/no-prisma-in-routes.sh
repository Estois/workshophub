#!/usr/bin/env bash
set -euo pipefail

# Enforces the route -> service -> prisma layering rule from CLAUDE.md's
# Team norms: "No Prisma calls in route handlers."
#
# api/src/routes/admin.ts and api/src/routes/training-sessions.ts are
# exempt: CLAUDE.md documents both as intentionally seeded security
# vulnerabilities for later workshops ("don't clean them up without being
# asked"). This sensor must not fail on pre-existing seeded state.
EXEMPT_FILES=(
  "api/src/routes/admin.ts"
  "api/src/routes/training-sessions.ts"
)

status=0

shopt -s nullglob
files=(api/src/routes/*.ts)
shopt -u nullglob

for file in "${files[@]}"; do
  exempt=0
  for ex in "${EXEMPT_FILES[@]}"; do
    if [ "$file" = "$ex" ]; then
      exempt=1
      break
    fi
  done
  if [ "$exempt" = "1" ]; then
    continue
  fi

  if grep -qE "from ['\"]@prisma/client['\"]|from ['\"].*lib/prisma['\"]" "$file"; then
    echo "$file: imports Prisma directly — route handlers must call a service function instead"
    status=1
  fi
done

exit $status
