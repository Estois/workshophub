#!/usr/bin/env bash
set -euo pipefail

# Blocks new raw SQL (prisma.$queryRaw / $queryRawUnsafe / $executeRaw /
# $executeRawUnsafe) to prevent SQL injection.
#
# api/src/routes/training-sessions.ts is exempt: CLAUDE.md documents its
# $queryRawUnsafe /search endpoint as an intentionally seeded SQL injection
# vulnerability for Workshop 8 ("don't clean them up without being asked").
EXEMPT_FILES=(
  "api/src/routes/training-sessions.ts"
)

status=0

shopt -s nullglob
files=(api/src/**/*.ts)
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

  if grep -qE '\$(queryRaw|executeRaw)(Unsafe)?' "$file"; then
    echo "$file: uses raw SQL (\$queryRaw/\$executeRaw family) — use the Prisma query builder instead"
    status=1
  fi
done

exit $status
