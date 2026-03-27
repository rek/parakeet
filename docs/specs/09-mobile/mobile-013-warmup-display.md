# Spec: Warmup Display

**Status**: Implemented
**Domain**: parakeet

## What This Covers

How warmup sets are displayed and tracked in the live session screen. Warmup sets appear in a collapsible section above the working sets. They are check-off only — no weight editing, no RPE, not logged to the database.

## Tasks

**Screen: `apps/parakeet/app/session/[sessionId].tsx` (additions)**

**Data flow:**

```typescript
// After JIT generation completes, also compute warmup
const jitOutput = await generateAndSaveSession(sessionId);
const warmupConfig = await getWarmupConfig(userId, session.primary_lift);

// Working weight = first main lift set (already adjusted by JIT)
const workingWeight = jitOutput.mainLiftSets[0]?.weight_kg ?? 0;
const warmupSets = generateWarmupSets(workingWeight, warmupConfig);
```

Warmup sets are computed locally, never stored in Supabase.

**UI layout (session screen):**

```
▼ Warmup Sets  [collapse]          ← tappable header, chevron rotates

  Set 1    45 kg (bar-adjacent) × 5    [✓] Done
  Set 2    67.5 kg              × 3    [✓] Done
  Set 3    85 kg                × 2    [ ] Done
  Set 4    102.5 kg             × 1    [ ] Done

─────────────────────────────────────
  Working Sets

  Set 1    112.5 kg   × 5    RPE [  ]    [ ] Done
  Set 2    112.5 kg   × 5    RPE [  ]    [ ] Done
```

**Collapse behavior:**

- Default: expanded on first-ever session for this lift
- After that: collapsed by default (stored in AsyncStorage keyed by `warmup_collapsed_${lift}`)
- Collapsing hides the set rows but keeps the header visible with a summary: "Warmup (4 sets, up to 102.5 kg)"

**Warmup set row:**

- Weight and reps displayed (read-only, not editable)
- Checkbox to mark Done — local state only, not persisted
- Completed rows shown with muted/strikethrough styling
- No RPE input (warmup RPE is irrelevant for training data)

**"20 kg (bar)" display:**

- When `weightKg <= 20`, display weight as `"Bar (20 kg)"` with a different visual treatment (pill badge instead of plain text)

**Recovery mode interaction:**

- If JIT produced a recovery session (soreness 9-10 → 40%×3×5) and the user has no explicit warmup config, warmup sets are shortened to `minimal` protocol automatically
- If working weight is below 40kg and no explicit config: use `minimal` protocol (prevents absurd warmup sets for very light loads)
- If the user has explicitly set a warmup protocol for the lift, it is always honored regardless of recovery mode or working weight

**State (local only, Zustand `sessionStore`):**

```typescript
interface WarmupState {
  sets: WarmupSet[];
  completedIndices: Set<number>;
  isCollapsed: boolean;
}
```

## Dependencies

- [../04-engine/engine-010-warmup-calculator.md](../04-engine/engine-010-warmup-calculator.md)
- [../05-data/data-003-warmup-config.md](../05-data/data-003-warmup-config.md)
- [../04-engine/engine-007-jit-session-generator.md](../04-engine/engine-007-jit-session-generator.md)
