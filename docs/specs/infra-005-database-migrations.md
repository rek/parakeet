# Spec: Database Migrations

**Status**: Planned
**Domain**: Infrastructure

## What This Covers

Migration tooling setup, the initial schema SQL, and the workflow for applying migrations in development and production.

## Tasks

**Migration tooling:**
- Use `node-pg-migrate` (npm package) in `packages/db`
- Migration files: `packages/db/migrations/` (sequential: `001_initial_schema.sql`, etc.)
- Config: `database.json` at package root (reads `DATABASE_URL` env var)
- Add npm scripts: `db:migrate`, `db:migrate:create`, `db:migrate:down`

**001_initial_schema.sql — tables to create:**
- `users` — UUID PK, firebase_uid, email, display_name, timestamps, soft delete
- `lifter_maxes` — UUID PK, user_id FK, recorded_at, source enum, squat/bench/deadlift 1RM (integer tenths), raw input fields, notes
- `formula_configs` — UUID PK, user_id FK, version, is_active, source enum, overrides JSONB, ai fields
- `sessions` — UUID PK, program_id FK, user_id FK, week/day numbers, primary_lift enum, intensity_type enum, block_number, planned_sets JSONB, status enum, timestamps
- `session_logs` — UUID PK, session_id FK, user_id FK, logged_at, started/completed timestamps, actual_sets JSONB, session_rpe, is_correction, performance_vs_plan, completion_pct
- `edge_cases` — UUID PK, user_id FK, program_id FK, session_id FK, case_type enum, severity enum, date range, affected_lifts text[], adjustment_applied JSONB, status enum
- `performance_metrics` — UUID PK, user_id FK, session_log_id FK, recorded_at, lift, intensity_type, block/week numbers, volume/intensity/RPE metrics, estimated_1rm
- `recovery_snapshots` — UUID PK, user_id FK, recorded_at, source, sleep fields, HRV/HR fields, biomarker fields, raw_payload JSONB
- All indexes as specified in the architecture plan
- All check constraints (enums enforced at DB level, not just application)

**002_formula_versioning.sql:**
- Add `programs` table (depends on `lifter_maxes` and `formula_configs` being stable)

**Local dev workflow:**
```bash
# Start local Postgres (via docker-compose)
# Apply migrations
cd packages/db && npm run db:migrate

# Create new migration
npm run db:migrate:create -- add_biomarker_details
```

**Production migration workflow (CI/CD):**
- Migrations run as a step in `deploy-api.yml` before the new Cloud Run revision receives traffic
- Use Cloud SQL Auth Proxy in CI to connect to production DB
- Migration must complete with exit code 0 before deployment proceeds

## Dependencies

- [infra-002-gcp-project-bootstrap.md](./infra-002-gcp-project-bootstrap.md)

## References

- ADR: [004-postgresql-cloud-sql.md](../decisions/004-postgresql-cloud-sql.md)
