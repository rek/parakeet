#!/usr/bin/env bash
# Seed diet protocols — one command for local and prod.
#
# If SUPABASE_URL + SUPABASE_SERVICE_KEY are already set in the env,
# uses those (prod / CI / anything non-local).
# Otherwise falls back to reading the local stack's service key via
# `supabase status` and targets http://localhost:54321.
#
# Examples:
#   npm run db:seed:diet                                       # local
#   SUPABASE_URL=https://<ref>.supabase.co \
#   SUPABASE_SERVICE_KEY=<service-role-key> \
#     npm run db:seed:diet                                     # prod
set -euo pipefail

if [[ -z "${SUPABASE_URL:-}" || -z "${SUPABASE_SERVICE_KEY:-}" ]]; then
  if ! SERVICE_KEY=$(npx supabase status -o env 2>/dev/null | awk -F= '/SERVICE_ROLE_KEY/ {print $2}'); then
    echo "No SUPABASE_URL / SUPABASE_SERVICE_KEY in env, and local stack not running." >&2
    echo "  local:  npm run db:start  then re-run" >&2
    echo "  remote: SUPABASE_URL=https://<ref>.supabase.co SUPABASE_SERVICE_KEY=<key> npm run db:seed:diet" >&2
    exit 1
  fi
  if [[ -z "${SERVICE_KEY}" ]]; then
    echo "SERVICE_ROLE_KEY not found in supabase status output." >&2
    exit 1
  fi
  export SUPABASE_URL="${SUPABASE_URL:-http://localhost:54321}"
  export SUPABASE_SERVICE_KEY="${SERVICE_KEY}"
fi

echo "Seeding $SUPABASE_URL"
npx tsx tools/scripts/seed-diet-protocols.ts
