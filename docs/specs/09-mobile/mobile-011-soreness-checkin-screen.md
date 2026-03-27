# Spec: Soreness Check-In Screen

**Status**: Implemented
**Domain**: parakeet

## What This Covers

The pre-workout soreness rating screen that gates JIT session generation. Shown only when **starting a new (`planned`) session**. Resuming an already `in_progress` session bypasses this screen entirely — both `WorkoutCard` ("Resume Workout" button) and `SessionSummary` (tapping an in_progress row) navigate directly to `session/[sessionId]` using cached JIT data.

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

  ┌──────────────────────────────────────────────────────────┐
  │  Quads                                                  │
  │  [1] [2] [3] [4] [5] [6] [7] [8] [9] [10]              │
  │                                                         │
  │  Glutes                                                 │
  │  [1] [2] [3] [4] [5] [6] [7] [8] [9] [10]              │
  │                                                         │
  │  Lower Back                                             │
  │  [1] [2] [3] [4] [5] [6] [7] [8] [9] [10]              │
  └──────────────────────────────────────────────────────────┘

  1–4 Fresh · 5–6 Moderate · 7–8 High · 9–10 Severe

  [Generate Today's Workout →]
```

**Rating scale tiers:**

- 1–4: Fresh — no soreness, no adjustment
- 5–6: Moderate — noticeable, reduces 1 set
- 7–8: High — significant discomfort, reduces 2 sets + 5% intensity (males); 1 set + 3% (females)
- 9–10: Severe — should not train this muscle, triggers recovery mode

**Severe soreness banner:** If any muscle is rated >= 9, show a warning card: "Severe soreness detected — today's workout will be a recovery session (light work at 40% intensity). You can still continue."

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
  ratings: { quads: 2, glutes: 1, lower_back: 3 }, // JSONB
  skipped: false,
  recorded_at: new Date().toISOString(),
});
```

**State:** Local Zustand `sorenessStore` holds current ratings during the screen session. Cleared after JIT generation completes.

## Dependencies

- [engine-007-jit-session-generator.md](../04-engine/engine-007-jit-session-generator.md)
- [engine-009-soreness-adjuster.md](../04-engine/engine-009-soreness-adjuster.md)
- [sessions-002-session-lifecycle-api.md](../07-sessions/sessions-002-session-lifecycle-api.md)
- [infra-002-supabase-setup.md](../01-infra/infra-002-supabase-setup.md)
