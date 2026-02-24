# Spec: Soreness Check-In Screen

**Status**: Implemented
**Domain**: parakeet

## What This Covers

The pre-workout soreness rating screen that gates JIT session generation. Shown every time the user opens a session. After completing the ratings, the JIT generator runs and the workout screen opens with concrete sets.

## Tasks

**Screen: `apps/parakeet/app/session/soreness.tsx`**

**Route params:** `{ sessionId: string }`

**Muscles shown per session type:**
- Squat session → Quads, Glutes, Lower Back
- Bench session → Chest, Triceps, Shoulders
- Deadlift session → Hamstrings/Glutes, Lower Back, Upper Back

The screen reads the session's `primary_lift` to determine which muscles to show.

**UI layout:**
```
[Back]          Today's Workout — Squat        [Skip → straight to session]

  How are these muscles feeling today?

  ┌─────────────────────────────────────────────────┐
  │  Quads           [1] [2] [3] [4] [5]            │
  │  Glutes          [1] [2] [3] [4] [5]            │
  │  Lower Back      [1] [2] [3] [4] [5]            │
  └─────────────────────────────────────────────────┘

  1 = Fresh   2 = Mild   3 = Moderate   4 = High   5 = Severe

  [Generate Today's Workout →]
```

**Rating scale labels:**
- 1: Fresh — no soreness
- 2: Mild — slight tightness, no impact
- 3: Moderate — noticeable, some movement restriction
- 4: High — significant discomfort or limited range
- 5: Severe — should not train this muscle

**Soreness = 5 banner:** If any muscle is rated 5, show a warning card: "Severe soreness detected — today's workout will be a recovery session (light work at 40% intensity). You can still continue."

**"Skip" option:** If user skips soreness check-in, default all muscles to rating 1 (no adjustment). Log `skipped: true` in `soreness_checkins`.

**On "Generate Today's Workout" tap:**
1. Write soreness ratings to `soreness_checkins` table
2. Call JIT generator with full input (fetches all required data)
3. Show loading indicator: "Generating your workout..."
4. Write `planned_sets` and `jit_generated_at` to session in Supabase
5. Navigate to `session/[sessionId]` (the live workout screen)

**Supabase write:**
```typescript
await supabase.from('soreness_checkins').insert({
  session_id: sessionId,
  user_id: userId,
  ratings: { quads: 2, glutes: 1, lower_back: 3 },  // JSONB
  skipped: false,
  recorded_at: new Date().toISOString(),
})
```

**State:** Local Zustand `sorenessStore` holds current ratings during the screen session. Cleared after JIT generation completes.

## Dependencies

- [engine-007-jit-session-generator.md](../04-engine/engine-007-jit-session-generator.md)
- [engine-009-soreness-adjuster.md](../04-engine/engine-009-soreness-adjuster.md)
- [sessions-002-session-lifecycle-api.md](../07-sessions/sessions-002-session-lifecycle-api.md)
- [infra-002-supabase-setup.md](../01-infra/infra-002-supabase-setup.md)
