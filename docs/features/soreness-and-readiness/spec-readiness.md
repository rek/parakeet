# Spec: Readiness Adjuster (Sleep & Energy)

**Status**: Draft
**Domain**: Training Engine

## What This Covers

Adds a pure `getReadinessModifier` function that combines sleep quality and energy level into an intensity/volume modifier for the JIT pipeline. Applied alongside the RPE adjustment at Step 2.

## Tasks

### ReadinessModifier type and function

**File: `packages/training-engine/src/adjustments/readiness-adjuster.ts`**

```typescript
export type ReadinessLevel = 1 | 2 | 3  // 1=poor/low, 2=ok/normal, 3=great/high

export interface ReadinessModifier {
  setReduction: number
  intensityMultiplier: number
  rationale: string | null
}
```

Function: `getReadinessModifier(sleepQuality?: ReadinessLevel, energyLevel?: ReadinessLevel): ReadinessModifier`

Lookup table:

| Sleep | Energy | setReduction | intensityMultiplier | rationale |
|-------|--------|-------------|--------------------|----|
| 1 | 1 | 1 | 0.95 | "Poor sleep + low energy — reduced 1 set, intensity −5%" |
| 1 | 2 | 0 | 0.975 | "Poor sleep — intensity −2.5%" |
| 1 | 3 | 0 | 0.975 | "Poor sleep — intensity −2.5%" |
| 2 | 1 | 0 | 0.975 | "Low energy — intensity −2.5%" |
| 2 | 2 | 0 | 1.0 | null |
| 2 | 3 | 0 | 1.0 | null |
| 3 | 1 | 0 | 0.975 | "Low energy — intensity −2.5%" |
| 3 | 2 | 0 | 1.0 | null |
| 3 | 3 | 0 | 1.025 | "Good sleep + high energy — intensity +2.5%" |

When both params are undefined, return the neutral modifier (0, 1.0, null).

### Export

**File: `packages/training-engine/src/index.ts`**

Add `export * from './adjustments/readiness-adjuster'` alongside the existing soreness-adjuster export.

### JITInput extension

**File: `packages/training-engine/src/generator/jit-session-generator.ts`**

Add to `JITInput`:
```typescript
sleepQuality?: 1 | 2 | 3
energyLevel?: 1 | 2 | 3
```

In `generateJITSession`, after Step 2 (RPE history adjustment), add:

```typescript
// Step 2b — Readiness adjustment (sleep + energy)
const readinessModifier = getReadinessModifier(input.sleepQuality, input.energyLevel)
if (readinessModifier.intensityMultiplier !== 1.0) {
  intensityMultiplier *= readinessModifier.intensityMultiplier
}
plannedCount = Math.max(1, plannedCount - readinessModifier.setReduction)
if (readinessModifier.rationale) rationale.push(readinessModifier.rationale)
```

### Tests

**File: `packages/training-engine/src/adjustments/__tests__/readiness-adjuster.test.ts`**

Test cases:
- Both undefined → neutral (no change)
- Poor sleep + low energy → setReduction 1, intensity 0.95
- Poor sleep + normal energy → intensity 0.975
- Good sleep + high energy → intensity 1.025
- Normal sleep + normal energy → neutral
- One poor, one great → the poor signal dominates (0.975)

## Domain References

- [domain/adjustments.md](../../domain/adjustments.md) — readiness modifier table (sleep x energy combinations)
- [domain/athlete-signals.md](../../domain/athlete-signals.md) — sleep and energy signal definitions
