# Spec: Lifter Maxes API

**Status**: Planned
**Domain**: Program Management

## What This Covers

Endpoints for submitting 1RM or 3RM lift data and retrieving historical max snapshots. This is the first step in onboarding.

## Tasks

**Repository (`apps/api/src/modules/programs/lifter-maxes.repository.ts`):**
- `create(userId: string, data: CreateLifterMaxesData): Promise<LifterMaxes>`
- `findCurrent(userId: string): Promise<LifterMaxes | null>` — most recent by `recorded_at`
- `findAll(userId: string, pagination: PaginationParams): Promise<PaginatedResult<LifterMaxes>>`

**Service (`apps/api/src/modules/programs/lifter-maxes.service.ts`):**
- `submitMaxes(userId: string, input: LifterMaxesInput): Promise<LifterMaxes>`
  - For each lift, if `type === '3rm'`: call `estimateOneRepMax_Epley(weight, reps)` from training-engine
  - Convert lbs to tenths integer for DB storage
  - Preserve raw input (weight_tenths + reps) in separate columns for audit
  - Set `source` based on input mix: `'input_1rm'`, `'input_3rm'`, or `'mixed'`

**Routes (`apps/api/src/modules/programs/programs.routes.ts`):**
- `POST /v1/lifter-maxes` — Submit maxes; return calculated 1RMs and generated ID
  - Request body validated against `LifterMaxesInputSchema` (Zod from shared-types)
  - Response: `{ id, calculated_1rm: { squat_lbs, bench_lbs, deadlift_lbs }, source, recorded_at }`
- `GET /v1/lifter-maxes` — List historical maxes (paginated, newest first)
- `GET /v1/lifter-maxes/current` — Get the most recent maxes snapshot

**Validation rules:**
- All three lifts must be provided in a single request
- Weight must be > 0 and < 1500 lbs
- Reps (for 3RM input) must be 2-10

## Dependencies

- [engine-001-one-rep-max-formulas.md](./engine-001-one-rep-max-formulas.md)
- [auth-002-user-profile-api.md](./auth-002-user-profile-api.md)
- [types-001-zod-schemas.md](./types-001-zod-schemas.md)
