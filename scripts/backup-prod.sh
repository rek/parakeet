#!/usr/bin/env bash
#
# Backup production Supabase data (data-only; schema lives in migrations).
#
# Usage:
#   SUPABASE_DB_PASSWORD=<password> ./tools/scripts/backup-prod.sh
#
# Optional:
#   --project-ref <ref>   Override default project ref
#   --output <path>       Override output file path
#
# The password is your Supabase database password.
# Find it in: Supabase Dashboard -> Settings -> Database

set -euo pipefail

PROJECT_REF="xfjttjhfmwkhlmienxap"
OUTPUT=""

while [[ $# -gt 0 ]]; do
  case $1 in
    --project-ref) PROJECT_REF="$2"; shift 2 ;;
    --output) OUTPUT="$2"; shift 2 ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

if [[ -z "${SUPABASE_DB_PASSWORD:-}" ]]; then
  echo "Error: SUPABASE_DB_PASSWORD is required"
  echo "Usage: SUPABASE_DB_PASSWORD=<password> $0"
  exit 1
fi

BACKUP_DIR="$(cd "$(dirname "$0")/.." && pwd)/backups"
mkdir -p "$BACKUP_DIR"

if [[ -z "$OUTPUT" ]]; then
  OUTPUT="$BACKUP_DIR/backup_$(date +%Y%m%d_%H%M%S).sql"
fi

echo "=== Backup started at $(date -Iseconds) ==="
echo "Project ref: $PROJECT_REF"
echo "Output file: $OUTPUT"
echo ""
echo "[$(date +%H:%M:%S)] Starting db dump..."

# Run dump with a progress indicator in the background
npx supabase db dump \
  -p "$SUPABASE_DB_PASSWORD" \
  --project-ref "$PROJECT_REF" \
  --data-only \
  > "$OUTPUT" 2>&1 &
DUMP_PID=$!

# Print a dot every 5 seconds so we know it's still running
while kill -0 "$DUMP_PID" 2>/dev/null; do
  sleep 5
  if [[ -f "$OUTPUT" ]]; then
    CURRENT_SIZE=$(wc -c < "$OUTPUT" 2>/dev/null || echo 0)
    echo "[$(date +%H:%M:%S)] Still running... output so far: $(numfmt --to=iec "$CURRENT_SIZE" 2>/dev/null || echo "${CURRENT_SIZE} bytes")"
  else
    echo "[$(date +%H:%M:%S)] Still running... (no output file yet)"
  fi
done

# Check exit code
wait "$DUMP_PID"
EXIT_CODE=$?

if [[ $EXIT_CODE -ne 0 ]]; then
  echo ""
  echo "[$(date +%H:%M:%S)] ERROR: db dump failed with exit code $EXIT_CODE"
  if [[ -f "$OUTPUT" ]]; then
    echo "--- Last 20 lines of output ---"
    tail -20 "$OUTPUT"
  fi
  exit $EXIT_CODE
fi

SIZE=$(wc -c < "$OUTPUT")
echo ""
echo "[$(date +%H:%M:%S)] Backup saved to $OUTPUT ($(numfmt --to=iec "$SIZE"))"
echo "=== Backup finished at $(date -Iseconds) ==="
