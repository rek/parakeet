#!/usr/bin/env bash
# Convenience wrapper: seeds diet protocols into local Supabase.
# Pulls the service key from `supabase status` automatically.
set -euo pipefail

if ! SERVICE_KEY=$(npx supabase status -o env 2>/dev/null | awk -F= '/SERVICE_ROLE_KEY/ {print $2}'); then
  echo "Could not read supabase status — is the local stack running? Try: npm run db:start" >&2
  exit 1
fi

if [[ -z "${SERVICE_KEY}" ]]; then
  echo "SERVICE_ROLE_KEY not found in supabase status output." >&2
  exit 1
fi

SUPABASE_URL="${SUPABASE_URL:-http://localhost:54321}" \
SUPABASE_SERVICE_KEY="${SERVICE_KEY}" \
  npx tsx tools/scripts/seed-diet-protocols.ts
