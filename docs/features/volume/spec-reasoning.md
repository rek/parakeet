# Spec: Weekly Volume Reasoning (GH#121)

**Status**: Implemented
**Domain**: Training Engine | Mobile App

## What This Covers

The volume dashboard (`volume.tsx`) shows weekly set counts per muscle group and MRV/MEV thresholds, but provides no explanation of *why* the numbers are what they are. This spec adds expandable rows that reveal two things when tapped:

1. **Volume breakdown** — which exercises contributed how many effective sets to each muscle, including RPE scaling and muscle contribution factors
2. **MRV/MEV source** — whether thresholds are sex-based research defaults or user-customized, and what the defaults would be

---

## Tasks

### 1. Pure function: `computeVolumeBreakdown`

**File: `packages/training-engine/src/volume/compute-volume-breakdown.ts`** (new)

- [ ] `computeVolumeBreakdown({ sessionLogs, muscleMapper })` — mirrors `computeWeeklyVolume` (`mrv-mev-calculator.ts:78-98`) but accumulates per-exercise detail instead of just totals
  - For each `CompletedSetLog`: call `muscleMapper(log.lift, log.exercise)` to get `MuscleContribution[]`
  - Compute `effectiveSets` same as existing: `log.setRpes ? sum(rpeSetMultiplier(rpe)) : log.completedSets`
  - For each `{ muscle, contribution }`: accumulate into a Map keyed by `(muscle, source)` where source is `log.exercise ?? log.lift ?? 'Unknown'`
  - Merge same-source entries across sessions (sum `rawSets`, `effectiveSets`, recompute `volumeAdded`)
  - `totalVolume` = `Math.round(sum of all volumeAdded)` — must match `computeWeeklyVolume` for same inputs
  - Sort `contributions` by `volumeAdded` descending
  - Source label: capitalize lift name for primary lifts (e.g. `"squat"` → `"Squat"`); use exercise name as-is for auxiliaries
  - Types (`ExerciseVolumeContribution`, `MuscleVolumeBreakdown`) defined in-file but NOT exported separately — consumers derive via `ReturnType<typeof computeVolumeBreakdown>` per code-style rule 3

**Existing code to reuse:**
- `rpeSetMultiplier` from `packages/training-engine/src/volume/rpe-scaler.ts`
- `MuscleMapper` type, `MUSCLE_GROUPS`, `MuscleGroup` from `mrv-mev-calculator.ts`
- `CompletedSetLog` from `packages/training-engine/src/types.ts`

**Export:** Add `export * from '../../volume/compute-volume-breakdown';` to `packages/training-engine/src/modules/volume/index.ts`

### 2. Pure function: `classifyConfigSource`

**File: `packages/training-engine/src/volume/classify-config-source.ts`** (new)

- [ ] `classifyConfigSource({ config, muscle, biologicalSex })` — compares a muscle's MRV/MEV against sex-based research defaults and returns whether it's customized
  - Returns `{ isCustom: boolean; defaultMev: number; defaultMrv: number }`
  - Uses `DEFAULT_MRV_MEV_CONFIG_MALE` / `DEFAULT_MRV_MEV_CONFIG_FEMALE` from `mrv-mev-calculator.ts`
  - `isCustom = config[muscle].mev !== defaults[muscle].mev || config[muscle].mrv !== defaults[muscle].mrv`
  - When `biologicalSex` is null, defaults to male constants

This keeps domain comparison logic out of the screen (code-style: "no business logic in components").

**Export:** Add `export * from '../../volume/classify-config-source';` to `packages/training-engine/src/modules/volume/index.ts`

### 3. Tests

**File: `packages/training-engine/src/volume/compute-volume-breakdown.test.ts`** (new)

- [ ] **Consistency invariant**: For any valid `sessionLogs`, `breakdown[muscle].totalVolume === computeWeeklyVolume(sessionLogs, mapper)[muscle]` for all 10 muscles
  - Test with: empty logs, single main lift session, main + aux session, multiple sessions with overlapping exercises
- [ ] **Merging**: Two sessions with same exercise (e.g. "Squat" on Monday and Wednesday) → single contribution entry with summed rawSets/effectiveSets
- [ ] **Fractional contributions**: Bench press (3 sets, RPE 9) → chest contribution 1.0 (volumeAdded=3.0), triceps contribution 0.4 (volumeAdded=1.2), shoulders contribution 0.4 (volumeAdded=1.2)
- [ ] **RPE scaling**: 4 sets with RPE [10, 8, 7, 5] → effectiveSets = 1.0 + 0.75 + 0.5 + 0.0 = 2.25
- [ ] **RPE edge cases**: `setRpes` with `undefined` entries (e.g. `[9, undefined, 7]` → 1.0 + 1.0 + 0.5 = 2.5), empty `setRpes` array `[]` (→ effectiveSets = 0), and `setRpes: undefined` (→ fallback to `completedSets`)
- [ ] **Sort order**: Contributions sorted by volumeAdded descending within each muscle
- [ ] **Empty logs**: Returns all muscles with totalVolume=0 and empty contributions array
- [ ] **Source labeling**: Lift-only log (`lift: 'bench', exercise: undefined`) produces source `"Bench"`; aux log (`exercise: "Lat Pulldown"`) produces source `"Lat Pulldown"` as-is

**File: `packages/training-engine/src/volume/classify-config-source.test.ts`** (new)

- [ ] Default male config → `isCustom: false`, correct default values
- [ ] Default female config → `isCustom: false`, correct female default values
- [ ] Custom MEV only → `isCustom: true`
- [ ] Custom MRV only → `isCustom: true`
- [ ] Null biologicalSex → falls back to male defaults

### 4. Hook update: `useWeeklyVolume`

**File: `apps/parakeet/src/modules/training-volume/hooks/useWeeklyVolume.ts`**

- [ ] Import `computeVolumeBreakdown` from `@parakeet/training-engine`
- [ ] In `queryFn`, after computing `weekly`: call `computeVolumeBreakdown({ sessionLogs: logs, muscleMapper: getMusclesForLift })`
- [ ] Thread `profile?.biological_sex` into return value
- [ ] Return shape becomes: `{ weekly, status, remaining, config, breakdown, biologicalSex }`

No new query — breakdown derived from same `logs` already fetched. No performance concern (~15-20 logs per week).

### 5. Fix pre-existing `qk` violation

**File: `apps/parakeet/src/platform/query/keys.ts`**

- [ ] Add `volume` entry to `qk`:
  ```typescript
  volume: {
    weekly: (userId?: string, windowStart?: string) => ['volume', 'weekly', userId, windowStart] as const,
  },
  ```

**File: `apps/parakeet/src/modules/training-volume/hooks/useWeeklyVolume.ts`**

- [ ] Replace raw `queryKey: ['volume', 'weekly', user?.id, rollingWindowStart()]` with `queryKey: qk.volume.weekly(user?.id, rollingWindowStart())`
- [ ] Import `qk` from `@platform/query`

This fixes a pre-existing invariant violation (CLAUDE.md: "Query keys must use the canonical `qk` helper").

### 6. UI: Expandable muscle bars

**File: `apps/parakeet/src/app/volume.tsx`**

- [ ] Add `expandedMuscle` state: `useState<MuscleGroup | null>(null)`
- [ ] Wrap each `MuscleBar` in `TouchableOpacity` that toggles `expandedMuscle` (tap same = collapse, tap different = switch)
- [ ] Add chevron indicator to `MuscleBar`: `▸` when collapsed, `▾` when expanded, placed after muscle label
- [ ] Pass `breakdown`, `config`, `biologicalSex` from `useWeeklyVolume` data to `MuscleBar`

**MuscleBar changes:**
- [ ] Accept new props: `expanded: boolean`, `breakdown: MuscleVolumeBreakdown`, `biologicalSex`, `onToggle`
- [ ] When `expanded`, render detail section below the bar track

**Detail section — Volume breakdown:**

For each contribution in `breakdown.contributions`:
```
  Squat            4s × 1.0  = 4.0
  Leg Press        3s × 1.0  = 3.0
  Bulgarian Split  2s × 0.75 = 1.5
```
- Left: exercise/lift name (flex 1, truncate if needed)
- Center: `{rawSets}s × {contribution}` in secondary text
- Right: `{volumeAdded}` to 1 decimal place (e.g. "1.5")
- If RPE scaling reduced effective sets (`rawSets !== effectiveSets`): show `{rawSets}s (eff. {effectiveSets}) × {contribution}` so user sees the RPE impact

**Detail section — Config reasoning:**

Use `classifyConfigSource` from training-engine (Task 2):
- If not custom: `MRV {mrv} · MEV {mev}  Research defaults ({sex})`
- If custom: `MRV {mrv} · MEV {mev}  Custom (default: {defaultMrv} / {defaultMev})`

Rendered as a single line in muted/tertiary text below the breakdown rows.

**New styles to add to `buildStyles`:**
- `chevron`: small text next to label, `fontSize: 12`, `color: textTertiary`
- `detailContainer`: `paddingLeft: 4, paddingBottom: 8, gap: 4`
- `detailRow`: `flexDirection: 'row', alignItems: 'center'`
- `detailSource`: `flex: 1, fontSize: 12, color: text`
- `detailFormula`: `fontSize: 11, color: textSecondary, width: 90`
- `detailValue`: `fontSize: 12, fontWeight: '600', color: text, width: 36, textAlign: 'right'`
- `reasoningText`: `fontSize: 11, color: textTertiary, marginTop: 4`

---

## Dependencies

- `computeWeeklyVolume` in `packages/training-engine/src/volume/mrv-mev-calculator.ts` — logic to mirror
- `rpeSetMultiplier` in `packages/training-engine/src/volume/rpe-scaler.ts` — RPE scaling
- `getMusclesForLift` in `packages/training-engine/src/volume/muscle-mapper.ts` — muscle mapping
- `DEFAULT_MRV_MEV_CONFIG_MALE/FEMALE` in `mrv-mev-calculator.ts` — for config comparison
- `useWeeklyVolume` in `apps/parakeet/src/modules/training-volume/hooks/` — hook to extend
- `qk` in `apps/parakeet/src/platform/query/keys.ts` — query key registry to extend

## Verification

```bash
npx nx test training-engine -- src/volume/compute-volume-breakdown.test.ts
npx nx test training-engine -- src/volume/classify-config-source.test.ts
npx tsc --noEmit -p apps/parakeet/tsconfig.typecheck.json
npm run check:boundaries
npx nx affected -t test
```

Manual: open Volume screen → tap a muscle → verify breakdown rows sum to the displayed total → verify config line shows correct source (custom vs default) → tap another muscle → first one collapses.

## Domain Review Notes

The following pre-existing issues were identified during domain review and tracked as separate GitHub issues. They are NOT in scope for this spec but may affect displayed values:

- Female glute MRV (20) is lower than male (22) — inverted, should be ~26-28
- RPE scaling curve is conservative at RPE 7-8 vs research (Refalo et al. 2023/2024)
- Squat glute contribution 0.75 is high vs EMG data (~0.5-0.6)
- Deadlift upper_back contribution 0.5 is low vs isometric demands (~0.65-0.75)
- Core MEV=8 is high for powerlifters getting indirect work from compounds
- Beginner MEV multiplier 1.0 should be lower (0.8-0.85)
