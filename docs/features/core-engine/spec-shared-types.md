# Spec: Shared Zod Schemas

**Status**: Implemented
**Domain**: Shared Types

## What This Covers

All Zod schemas in `packages/shared-types` that define the data contracts used by the parakeet app and training engine. Schemas serve two purposes: runtime validation at system boundaries (user input, Supabase responses) and static TypeScript type inference via `z.infer<>`.

`planned_sets` and formula work in **kg** (floats, multiples of 2.5). Session logging payloads use integer **grams** (`weight_grams`) for precise capture/storage. There is no lbs unit anywhere in the system.

## Tasks

**`packages/shared-types/src/user.schema.ts`:**
- [x] `UserSchema`: id, email, display_name, biological_sex ('female'|'male'), created_at
- [x] `UpdateUserSchema`: `Partial<Pick<User, 'display_name' | 'biological_sex'>>`

**`packages/shared-types/src/program.schema.ts`:**
- [x] `LiftSchema`: z.enum(['squat', 'bench', 'deadlift'])
- [x] `IntensityTypeSchema`: z.enum(['heavy', 'explosive', 'rep', 'deload'])
- [x] `PlannedSetSchema`: set_number, weight_kg (number, multiples of 2.5), reps, rpe_target (optional), reps_range (optional tuple)
- [x] `SessionSchema`: id, program_id, week_number, day_number, primary_lift, intensity_type, block_number, is_deload, planned_sets, status (`planned|in_progress|completed|skipped|missed`), planned_date
- [x] `ProgramSchema`: id, user_id, version, status, total_weeks, training_days_per_week, start_date, created_at
- [x] `ProgramWithSessionsSchema`: ProgramSchema + sessions array
- [x] `CreateProgramSchema`: lifter_maxes_id (optional), formula_config_id (optional), total_weeks, training_days_per_week, start_date

**`packages/shared-types/src/lifter-maxes.schema.ts`:**
- [x] `LiftInputSchema`: z.union of `{ type: '1rm', weight_kg: number }` and `{ type: '3rm', weight_kg: number, reps: number }`
  - `weight_kg`: `> 0` and `<= 500`
  - `3rm.reps`: integer `2..10`
- [x] `LifterMaxesInputSchema`: squat, bench, deadlift (each LiftInputSchema)
- [x] `LifterMaxesResponseSchema`: id, calculated_1rm (squat_kg, bench_kg, deadlift_kg), source (`input_1rm | input_3rm | mixed | system_calculated`), recorded_at

**`packages/shared-types/src/session-log.schema.ts`:**
- [x] `ActualSetSchema`: set_number, weight_grams (integer), reps_completed, rpe_actual (optional), actual_rest_seconds (optional), notes (optional), exercise (optional for auxiliary sets)
  - `reps_completed` allows `0` to represent a failed/time-capped set attempt
- [x] `CompleteSessionSchema`: actual_sets array, session_rpe (optional), session_notes (optional), started_at (optional), completed_at (optional)
- [x] `SessionLogSchema`: id, session_id, logged_at, actual_sets, session_rpe, completion_pct, performance_vs_plan

**`packages/shared-types/src/disruption.schema.ts`:**
- [x] `DisruptionTypeSchema`: z.enum(['injury', 'illness', 'travel', 'fatigue', 'equipment_unavailable', 'unprogrammed_event', 'other'])
- [x] `SeveritySchema`: z.enum(['minor', 'moderate', 'major'])
- [x] `CreateDisruptionSchema`: disruption_type, severity, affected_date_start, affected_date_end (optional), affected_lifts (optional), description (optional), session_ids_affected (optional)
- [x] `AdjustmentSuggestionSchema`: session_id, action (`weight_reduced|reps_reduced|session_skipped|exercise_substituted`), reduction_pct (optional), reps_reduction (optional), rationale, substitution_note (optional)
- [x] `DisruptionWithSuggestionsSchema`: Disruption + suggested_adjustments array

**`packages/shared-types/src/formula.schema.ts`:** (see formulas-003-config-validation.md)

**`packages/shared-types/src/jit.schema.ts`:** (see engine-011-llm-jit-generator.md)

**`packages/shared-types/src/cycle-review.schema.ts`:** (see engine-012-cycle-review-generator.md)

**`packages/shared-types/src/index.ts`:**
- [x] Re-exports all schemas and their inferred TypeScript types
  - Use `z.infer<typeof Schema>` to extract types: `export type User = z.infer<typeof UserSchema>`

**Conventions:**
- All schemas use `.strict()` where possible to catch unknown fields early
- Date fields: accept ISO 8601 string, transform to string (not Date object — avoids serialization issues)
- Weight fields: `weight_kg` for planning/formula/JIT and `weight_grams` for logged actual sets
- All optional fields use `.optional()` not `.nullable()` unless the field can legitimately be null in the response

## Dependencies

- [infra-001-nx-monorepo-setup.md](../infra/spec-monorepo.md)
