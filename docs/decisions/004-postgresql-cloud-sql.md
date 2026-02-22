# ADR-004: PostgreSQL on Cloud SQL as Primary Database

**Date**: 2026-02-22
**Status**: Accepted

## Context

We need a primary data store for all user, program, session, and performance data. The data model includes relational entities with strong foreign key constraints (programs → users → lifter_maxes), append-only time-series data (session_logs, performance_metrics), and semi-structured JSON data (program snapshots, formula overrides, planned/actual sets). Future phases will require time-series queries across recovery and performance data for a correlation engine.

## Decision

Use **PostgreSQL 14** hosted on **GCP Cloud SQL** (fully managed).

- Private IP only (no public internet access)
- Cloud SQL Auth Proxy for local development connections
- Point-in-time recovery (PITR) enabled from day one
- Daily automated backups with 7-day retention
- Read replica added before Phase 2 launch

## Rationale

### Pros
- ACID transactions critical for program generation (write program_snapshot + session rows atomically)
- JSONB support handles semi-structured data (program snapshots, formula overrides, set logs) without sacrificing SQL query capability
- Time-series queries for performance_metrics and recovery_snapshots work well with proper indexes (no separate time-series DB needed at Phase 1 scale)
- Partial indexes (`WHERE status != 'resolved'`) keep frequent queries efficient
- `gen_random_uuid()` built-in for primary key generation
- Managed Cloud SQL handles backups, patching, failover — no DBA required
- GCP-native integration: Cloud Run connects via VPC connector, IAM authentication supported

### Cons
- Not optimized for extremely high-frequency time-series at massive scale (>1M data points/user) — acceptable for Phase 1-3 scale
- Cloud SQL costs more than a self-managed Postgres instance on GCE — accepted for operational simplicity
- Schema migrations require careful management (no automatic rollbacks)

## Alternatives Considered

### Alternative 1: Firebase Firestore
- NoSQL document database, native GCP integration
- **Why not chosen:** Poor fit for relational data (programs → sessions → logs foreign keys). SQL queries for time-series analytics would require duplicating data or using complex Firestore queries. ACID transactions across collections are limited.

### Alternative 2: Supabase (PostgreSQL + BaaS)
- Managed Postgres with built-in auth, real-time subscriptions, REST API generation
- **Why not chosen:** We are using Firebase Auth (already decided) and building our own API layer. Supabase's added BaaS features create overlap and potential confusion. Cloud SQL gives us clean, purpose-built Postgres without opinionated abstractions.

### Alternative 3: AlloyDB (GCP)
- PostgreSQL-compatible, significantly higher performance for analytics
- **Why not chosen:** 3-5× more expensive than Cloud SQL for similar capacity. AlloyDB is appropriate when Phase 2+ analytics query load justifies the cost. Cloud SQL to AlloyDB migration is straightforward (same wire protocol).

### Alternative 4: Cloud Spanner
- Globally distributed, horizontally scalable RDBMS
- **Why not chosen:** Massive overkill for Phase 1. Spanner pricing and operational complexity are only justified at global scale. Not a realistic consideration until we have millions of active users.

## Consequences

### Positive
- Program generation is atomic: single transaction writes `programs`, `sessions`, and publishes Pub/Sub event
- Session logs are append-only with correct constraints, enabling reliable audit trail
- JSONB columns enable schema evolution (add new set fields) without migrations
- PITR and daily backups protect against data loss from day one

### Negative
- Schema migrations must be managed carefully — use `packages/db/migrations/` with sequential SQL files
- All application code must use parameterized queries (never string interpolation) to prevent SQL injection
- Connection pooling via `pg-pool` in the API; Cloud Run concurrency setting must account for max connections

### Neutral
- Weights stored as integer tenths (e.g., 225.5 lbs = 2255) to avoid floating-point precision issues in the database; conversion to float happens at the application layer

## Implementation Notes

**Connection management (apps/api/src/plugins/database.ts):**
```typescript
import { Pool } from 'pg'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,           // max connections per Cloud Run instance
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
})
```

**Local development (Cloud SQL Auth Proxy):**
```bash
# Download and run Cloud SQL Auth Proxy
./cloud-sql-proxy --port 5432 parakeet-dev:us-central1:parakeet-db
# Then connect via localhost:5432
```

**Migration workflow:**
```bash
# Apply migrations (using node-pg-migrate or Flyway)
npm run db:migrate -- --env production

# Create new migration
npm run db:migrate:create -- add_biomarker_logs
```

## References

- [Cloud SQL for PostgreSQL](https://cloud.google.com/sql/docs/postgres)
- [Cloud SQL Auth Proxy](https://cloud.google.com/sql/docs/postgres/auth-proxy)
- [Cloud SQL PITR](https://cloud.google.com/sql/docs/postgres/backup-recovery/pitr)
