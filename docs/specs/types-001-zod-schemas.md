# Spec: Shared Zod Schemas

**Status**: Planned
**Domain**: Shared Types

## What This Covers

All Zod schemas in `packages/shared-types` that define the API contract between the mobile app and the API. These schemas serve dual purpose: runtime validation on the API and static TypeScript type inference for the client.

## Tasks

**`packages/shared-types/src/user.schema.ts`:**
- `UserSchema`: id, email, display_name, unit_preference ('lbs'|'kg'), created_at
- `UpdateUserSchema`: Partial<Pick<User, 'display_name' | 'unit_preference'>>

**`packages/shared-types/src/program.schema.ts`:**
- `LiftSchema`: z.enum(['squat', 'bench', 'deadlift'])
- `IntensityTypeSchema`: z.enum(['heavy', 'explosive', 'rep', 'deload'])
- `PlannedSetSchema`: set_number, weight_lbs, reps, rpe_target (optional), reps_range (optional tuple)
- `SessionSchema`: id, program_id, week_number, day_number, primary_lift, intensity_type, block_number, is_deload, planned_sets, status, planned_date
- `ProgramSchema`: id, user_id, version, status, total_weeks, training_days_per_week, start_date, created_at
- `ProgramWithSessionsSchema`: ProgramSchema + sessions array
- `CreateProgramSchema`: lifter_maxes_id (optional), formula_config_id (optional), total_weeks, training_days_per_week, start_date

**`packages/shared-types/src/lifter-maxes.schema.ts`:**
- `LiftInputSchema`: z.union of `{ type: '1rm', weight_lbs: number }` and `{ type: '3rm', weight_lbs: number, reps: number }`
- `LifterMaxesInputSchema`: squat, bench, deadlift (each LiftInputSchema)
- `LifterMaxesResponseSchema`: id, calculated_1rm (squat_lbs, bench_lbs, deadlift_lbs), source, recorded_at

**`packages/shared-types/src/session-log.schema.ts`:**
- `ActualSetSchema`: set_number, weight_lbs, reps_completed, rpe_actual (optional), notes (optional)
- `CompleteSessionSchema`: actual_sets array, session_rpe (optional), session_notes (optional), started_at (optional), completed_at (optional)
- `SessionLogSchema`: id, session_id, logged_at, actual_sets, session_rpe, completion_pct, performance_vs_plan

**`packages/shared-types/src/edge-case.schema.ts`:**
- `CaseTypeSchema`: z.enum([injury, illness, travel, fatigue, equipment_unavailable, other])
- `SeveritySchema`: z.enum([minor, moderate, major])
- `CreateEdgeCaseSchema`: case_type, severity, affected_date_start, affected_date_end (optional), affected_lifts (optional), description (optional), session_ids_affected (optional)
- `AdjustmentSuggestionSchema`: session_id, action, reduction_pct (optional), rationale, substitution_note (optional)
- `EdgeCaseWithSuggestionsSchema`: EdgeCase + suggested_adjustments array

**`packages/shared-types/src/formula.schema.ts`:** (see formulas-003-config-validation.md)

**`packages/shared-types/src/index.ts`:**
- Re-exports all schemas and their inferred TypeScript types
- Use `z.infer<typeof Schema>` to extract types: `export type User = z.infer<typeof UserSchema>`

**Conventions:**
- All schemas use `.strict()` where possible to catch unknown fields early
- Date fields: accept ISO 8601 string, transform to string (not Date object — avoids serialization issues)
- Weight fields in API: always `weight_lbs` (float), never tenths integers (those are internal DB format only)
- All optional fields use `.optional()` not `.nullable()` unless the field can legitimately be null in the response

## Dependencies

- [infra-001-nx-monorepo-setup.md](./infra-001-nx-monorepo-setup.md)
