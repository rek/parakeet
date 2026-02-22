# Spec: Performance Metrics Worker (Pub/Sub Consumer)

**Status**: Planned
**Domain**: Sessions & Performance

## What This Covers

The `analytics-worker` Cloud Run service that consumes `session.completed` Pub/Sub messages and writes to the `performance_metrics` table. This decouples analytics computation from the request path.

## Tasks

**Worker entry point (`apps/api/src/worker/analytics-worker.ts`):**
- Fastify server with single route: `POST /pubsub` (Pub/Sub push endpoint)
- Verify `Authorization: Bearer` token matches the Pub/Sub service account (prevent unauthorized pushes)
- Parse Pub/Sub message: extract `session_log_id`, `user_id`, `lift`, `intensity_type`, `block_number`
- Implement idempotency check: `SELECT 1 FROM processed_events WHERE event_id = $1`
  - If already processed: return 200 immediately (at-least-once safe)
  - If not processed: proceed
- Fetch `session_log` row and linked `session` row from DB
- Compute metrics:
  - `planned_volume_tenths`: sum of `(planned_weight_tenths × planned_reps)` across all planned sets
  - `actual_volume_tenths`: same for actual sets
  - `planned_intensity_pct`: `planned_weight_tenths / (user's current 1rm_tenths)`
  - `actual_intensity_pct`: actual weight / 1RM
  - `max_rpe_actual`, `avg_rpe_actual`: from `actual_sets` JSONB
  - `completion_pct`: from `session_logs.completion_pct`
  - `estimated_1rm_tenths`: if rep day or heavy day with known reps, compute Epley estimate
- Insert `performance_metrics` row
- Insert `processed_events` row with `event_id = session_log_id`, TTL 7 days
- Return HTTP 200 to acknowledge message (Pub/Sub retry if non-200)

**Dead-letter queue:**
- Configure Pub/Sub dead-letter topic: `session-completed-dlq`
- After 5 failed delivery attempts, message goes to DLQ
- Alert (Cloud Monitoring) on DLQ message count > 0

**Processed events table (add to migration):**
```sql
CREATE TABLE processed_events (
  event_id TEXT PRIMARY KEY,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- Cleanup job: DELETE FROM processed_events WHERE processed_at < NOW() - INTERVAL '7 days'
```

## Dependencies

- [sessions-003-session-completion-api.md](./sessions-003-session-completion-api.md)
- [infra-003-cloud-run-api-service.md](./infra-003-cloud-run-api-service.md)
