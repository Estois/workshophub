#!/bin/sh
set -e
echo "Applying database schema..."
cd /app/api && pnpm exec prisma db push --skip-generate
echo "Starting server..."
exec node /app/api/dist/server.js
