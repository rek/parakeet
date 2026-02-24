# Spec: Lifter Maxes (Supabase Direct)

**Status**: Implemented
**Domain**: Program Management

## What This Covers

Submitting 1RM or 3RM lift data and retrieving historical max snapshots. The first step in onboarding. All data goes directly to Supabase; no backend API. All weights stored as integer grams.

## Tasks

**`apps/parakeet/lib/lifter-maxes.ts`:**

```typescript
// Submit new maxes (onboarding or update)
async function submitMaxes(input: LifterMaxesInput): Promise<LifterMaxes> {
  const userId = (await supabase.auth.getUser()).data.user!.id

  // For 3RM inputs: estimate 1RM using Epley formula
  const squat1RmKg   = input.squat.type === '3rm'
    ? estimateOneRepMax_Epley(input.squat.weightKg, input.squat.reps)
    : input.squat.weightKg
  const bench1RmKg   = input.bench.type === '3rm'
    ? estimateOneRepMax_Epley(input.bench.weightKg, input.bench.reps)
    : input.bench.weightKg
  const deadlift1RmKg = input.deadlift.type === '3rm'
    ? estimateOneRepMax_Epley(input.deadlift.weightKg, input.deadlift.reps)
    : input.deadlift.weightKg

  const { data } = await supabase.from('lifter_maxes').insert({
    user_id: userId,
    // Store as integer grams
    squat_1rm_grams:    kgToGrams(squat1RmKg),
    bench_1rm_grams:    kgToGrams(bench1RmKg),
    deadlift_1rm_grams: kgToGrams(deadlift1RmKg),
    // Preserve raw input
    squat_input_grams:    kgToGrams(input.squat.weightKg),
    squat_input_reps:     input.squat.type === '3rm' ? input.squat.reps : null,
    bench_input_grams:    kgToGrams(input.bench.weightKg),
    bench_input_reps:     input.bench.type === '3rm' ? input.bench.reps : null,
    deadlift_input_grams: kgToGrams(input.deadlift.weightKg),
    deadlift_input_reps:  input.deadlift.type === '3rm' ? input.deadlift.reps : null,
    source: inferSource(input),  // 'input_1rm' | 'input_3rm' | 'mixed'
    recorded_at: new Date().toISOString(),
  }).select().single()

  return data
}

// Get most recent maxes for this user
async function getCurrentMaxes(userId: string): Promise<LifterMaxes | null> {
  const { data } = await supabase
    .from('lifter_maxes')
    .select('*')
    .eq('user_id', userId)
    .order('recorded_at', { ascending: false })
    .limit(1)
    .single()
  return data
}

// Get 1RM for a specific lift (returns kg float)
async function getCurrentOneRmKg(userId: string, lift: Lift): Promise<number | null> {
  const maxes = await getCurrentMaxes(userId)
  if (!maxes) return null
  return gramsToKg(maxes[`${lift}_1rm_grams`])
}
```

**`LifterMaxesInput` type:**
```typescript
interface LifterMaxesInput {
  squat:    { type: '1rm' | '3rm'; weightKg: number; reps?: number }
  bench:    { type: '1rm' | '3rm'; weightKg: number; reps?: number }
  deadlift: { type: '1rm' | '3rm'; weightKg: number; reps?: number }
}
```

**Validation (Zod, shared-types):**
- `weightKg > 0` and `weightKg <= 500` (hard cap)
- If `type === '3rm'`: `reps` required, 2–10
- All three lifts required in a single submission

**Onboarding screen `apps/parakeet/app/(auth)/onboarding/lift-maxes.tsx`:**
- Toggle per lift: "1RM" vs "3RM"
- Weight input in kg with live Epley preview: "Est. 1RM: 143.0 kg"
- Submit calls `submitMaxes()` → navigates to program-settings screen

## Dependencies

- [engine-001-one-rep-max-formulas.md](../04-engine/engine-001-one-rep-max-formulas.md)
- [auth-001-supabase-auth-setup.md](../02-auth/auth-001-supabase-auth-setup.md)
- [types-001-zod-schemas.md](../03-types/types-001-zod-schemas.md)
