# Spec: Lifter Maxes (Supabase Direct)

**Status**: Implemented
**Domain**: Program Management

## What This Covers

Submitting 1RM or 3RM lift data and retrieving historical max snapshots. The first step in onboarding. All data goes directly to Supabase; no backend API. All weights stored as integer grams.

## Tasks

**`apps/parakeet/lib/lifter-maxes.ts`:**
- [x] `submitMaxes(input: LifterMaxesInput): Promise<LifterMaxes>`
  - For 3RM inputs: estimate 1RM using Epley formula
  - Stores calculated 1RM as integer grams (`kgToGrams()`)
  - Preserves raw input (input_grams and input_reps)
  - `source`: `'input_1rm' | 'input_3rm' | 'mixed'`
- [x] `getCurrentMaxes(userId: string): Promise<LifterMaxes | null>` — most recent row
- [x] `getCurrentOneRmKg(userId: string, lift: Lift): Promise<number | null>` — returns kg float from most recent row

**`LifterMaxesInput` type:**
```typescript
interface LifterMaxesInput {
  squat:    { type: '1rm' | '3rm'; weightKg: number; reps?: number }
  bench:    { type: '1rm' | '3rm'; weightKg: number; reps?: number }
  deadlift: { type: '1rm' | '3rm'; weightKg: number; reps?: number }
}
```

**Validation (Zod, shared-types):**
- [x] `weightKg > 0` and `weightKg <= 500` (hard cap)
- [x] If `type === '3rm'`: `reps` required, 2–10
- [x] All three lifts required in a single submission

**Onboarding screen `apps/parakeet/app/(auth)/onboarding/lift-maxes.tsx`:**
- [x] Toggle per lift: "1RM" vs "3RM"
- [x] Weight input in kg with live Epley preview: "Est. 1RM: 143.0 kg"
- [x] Submit calls `submitMaxes()` → navigates to program-settings screen

## Dependencies

- [engine-001-one-rep-max-formulas.md](../04-engine/engine-001-one-rep-max-formulas.md)
- [auth-001-supabase-auth-setup.md](../02-auth/auth-001-supabase-auth-setup.md)
- [types-001-zod-schemas.md](../03-types/types-001-zod-schemas.md)
