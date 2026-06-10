# Spec: Cycle Review Screen

**Status**: Implemented
**Domain**: parakeet App

## What This Covers

The cycle review screen showing LLM-generated coaching analysis after a training cycle completes. Accessible from the History tab on any completed program. Includes formula suggestion management (accept/dismiss) and a developer-only structural suggestions section.

## Tasks

**`apps/parakeet/app/history/cycle-review/[programId].tsx`:**

Navigation path: History tab → completed program card → "Review" button.

**Loading state:**

- Query `cycle_reviews` table via React Query with `programId`
- If no row exists yet: show "Analysis in progress..." with spinner + "Generating your coaching review — usually takes under 30 seconds" subtitle
- Poll every 10 seconds via React Query `refetchInterval: 10_000` until row appears
- Once row exists: render full review
- If query fails: render explicit error state with retry action (do not show indefinite loading)
- [x] (landed) **Distinguish "no pending row" from "pending row" earlier.** Today the retry surface only appears after 60s. If `triggerCycleReview` errored before writing a pending row, the screen polls a non-existent row for a minute with no signal. Distinguish in the hook: `query.data == null` (no row) → show retry after 20-30s; `query.data?.status === 'pending'` → keep current 60s threshold.
- [x] (landed) **Render an explicit "review generated but empty" placeholder.** When the LLM responds with minimal data (no `progressByLift`, no `auxiliaryInsights`), the screen renders only the header — visually indistinguishable from a still-loading state. Add a short copy block: "Review generated but no actionable insights found this cycle."

**History-tab entry point:**

- [x] (landed) **Hide or disable "Review" button on archived programs that have no cycle review row** — history.tsx renders a Review button for every past program regardless of whether a review actually exists. For scheduled programs ended before 80% completion, no review was ever generated; tapping Review lands on the cycle review screen and spins forever (or eventually falls through to on-demand generation of a partial report). Action: fetch `cycle_reviews.program_id IN (...)` alongside the program list and only render the Review button when a row exists, OR label archived-without-review programs with a disabled "No review — program ended early" pill. This prevents a dead-end UX path for users who abandon a program early.

**Supabase Realtime (preferred over polling):**

- Subscribe to `cycle_reviews` insert events filtered by `program_id`
- On insert: invalidate React Query cache → triggers re-render
- Cancel `refetchInterval` once row is present
- Also stop polling on hard query error; capture the error via Sentry.

**Screen sections (in order):**

### 1. Overall Summary Card

- LLM `overallAssessment` text (2–3 sentences)
- Cycle dates + completion % header
- WILKS score change (start vs. end of cycle, from `compiledReport.meta`)

### 2. Lift Progress Cards

Three cards (Squat / Bench / Deadlift), each showing:

- `progressByLift[lift].rating` → badge: Excellent (green) / Good (blue) / Stalled (yellow) / Concerning (red)
- 1RM start → end: "120 kg → 127.5 kg (+7.5 kg)"
- LLM `progressByLift[lift].narrative` text

### 3. Auxiliary Exercise Insights

- `mostCorrelated` list: each item shows exercise name, lift, and LLM explanation
- `leastEffective` list: same format
- `recommendedChanges` (if present): "Consider adding: [X]" / "Consider removing: [Y]"

### 4. Volume Heatmap

- Grid: weeks (rows) × 9 muscle groups (columns)
- Cell colour: white (<MEV), green (MEV–80% MRV), yellow (80–100% MRV), red (>MRV)
- Data from `compiledReport.weeklyVolume`
- Scrollable horizontally if needed

### 5. Formula Suggestions

- Only shown if `llmResponse.formulaSuggestions.length > 0`
- Each suggestion card shows: description, rationale, priority badge
- "Accept" button → opens the formula editor pre-filled from the suggestion's `description`/`rationale`. (The structured `overrides` record was removed from `CycleReviewSchema` — OpenAI strict-schema mode is incompatible with `z.record(z.string(), z.unknown())`. Acceptance is now a navigation hand-off rather than a one-click apply.)
- "Dismiss" button → calls `deactivateFormulaConfig(suggestionId, userId)`; dismisses card
- On accept: show "Formula updated" toast + navigate to formula editor if user wants to review
- Suggestion identity must map to persisted `formula_configs` rows if dismiss is expected to mutate backend state.

### 6. Next Cycle Recommendations

- LLM `nextCycleRecommendations` text (natural language summary)
- Displayed in a highlighted card with a "→ Start Next Cycle" button that navigates to onboarding/program-settings with pre-filled values where possible

### 7. Developer Suggestions (developer mode only)

- Hidden unless `__DEV__` or developer mode enabled in Settings
- List of structural suggestions from `llmResponse.structuralSuggestions`
- Each item: description + developer note (no user actions — read-only)
- "These items require code changes — for developer review only"

**`apps/parakeet/hooks/useCycleReview.ts`:**

```typescript
export function useCycleReview(programId: string) {
  const { user } = useAuth();

  // Poll until cycle_reviews row appears
  const query = useQuery({
    queryKey: ['cycle-review', programId],
    queryFn: () => getCycleReview(programId, user.id),
    refetchInterval: (data) => (data ? false : 10_000), // stop polling once data exists
  });

  // Realtime subscription for instant update
  useEffect(() => {
    const channel = supabase
      .channel(`cycle-review-${programId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'cycle_reviews',
          filter: `program_id=eq.${programId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['cycle-review', programId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [programId]);

  return query;
}
```

**`apps/parakeet/lib/cycle-review.ts` (read helper):**

```typescript
export async function getCycleReview(programId: string, userId: string) {
  const { data } = await supabase.from('cycle_reviews').select('*').eq('program_id', programId).eq('user_id', userId).maybeSingle();
  return data; // null if not yet generated
}
```

Current behavior note: this helper may generate and store a review when a row is missing (not strictly read-only), so UI must treat "missing row" and "error" as separate states.

**Notification:**

- When `cycle_reviews` row is inserted, the Realtime subscription triggers cache invalidation
- If app is backgrounded, `expo-notifications` local notification: "Your cycle review is ready" with deep link to `history/cycle-review/[programId]`
- Notification is scheduled in `onCycleComplete()` (defined in `engine-012`) via `expo-notifications`

## Dependencies

- [engine-012-cycle-review-generator.md](./spec-generator.md)
- [parakeet-007-formula-editor-screen.md](./parakeet-007-formula-editor-screen.md)
- [parakeet-001-expo-router-layout.md](./parakeet-001-expo-router-layout.md)
- [parakeet-008-supabase-client-setup.md](./parakeet-008-supabase-client-setup.md)

---
