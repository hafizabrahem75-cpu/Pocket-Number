#!/bin/bash
set -e
pnpm install --frozen-lockfile

# Push DB schema only when a connection string is available.
# Without DATABASE_URL the push would fail and block every merge.
if [ -n "$DATABASE_URL" ]; then
  pnpm --filter db push
else
  echo "DATABASE_URL not set — skipping DB schema push. Set the secret and run: pnpm --filter @workspace/db run push"
fi
