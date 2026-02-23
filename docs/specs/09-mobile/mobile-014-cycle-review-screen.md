# Spec: Cycle Review Screen

**Status**: Planned
**Domain**: Mobile App

## What This Covers

The cycle review screen showing LLM-generated coaching analysis after a training cycle completes. Accessible from the History tab on any completed program. Includes formula suggestion management (accept/dismiss) and a developer-only structural suggestions section.

## Tasks

**`apps/mobile/app/history/cycle-review/[programId].tsx`:**

Navigation path: History tab → completed program card → "Review" button.

**Loading state:**
- Query `cycle_reviews` table via React Query with `programId`
- If no row exists yet: show "Analysis in progress..." with spinner + "Generating your coaching review — usually takes under 30 seconds" subtitle
- Poll every 10 seconds via React Query `refetchInterval: 10_000` until row appears
- Once row exists: render full review

**Supabase Realtime (preferred over polling):**
- Subscribe to `cycle_reviews` insert events filtered by `program_id`
- On insert: invalidate React Query cache → triggers re-render
- Cancel `refetchInterval` once row is present

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
- "Accept" button → calls `createFormulaOverride()` with `suggestion.overrides`; dismisses card
- "Dismiss" button → calls `deactivateFormulaConfig(suggestionId, userId)`; dismisses card
- On accept: show "Formula updated" toast + navigate to formula editor if user wants to review

### 6. Next Cycle Recommendations
- LLM `nextCycleRecommendations` text (natural language summary)
- Displayed in a highlighted card with a "→ Start Next Cycle" button that navigates to onboarding/program-settings with pre-filled values where possible

### 7. Developer Suggestions (developer mode only)
- Hidden unless `__DEV__` or developer mode enabled in Settings
- List of structural suggestions from `llmResponse.structuralSuggestions`
- Each item: description + developer note (no user actions — read-only)
- "These items require code changes — for developer review only"

**`apps/mobile/hooks/useCycleReview.ts`:**

```typescript
export function useCycleReview(programId: string) {
  const { user } = useAuth()

  // Poll until cycle_reviews row appears
  const query = useQuery({
    queryKey: ['cycle-review', programId],
    queryFn: () => getCycleReview(programId, user.id),
    refetchInterval: (data) => (data ? false : 10_000),  // stop polling once data exists
  })

  // Realtime subscription for instant update
  useEffect(() => {
    const channel = supabase
      .channel(`cycle-review-${programId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'cycle_reviews',
        filter: `program_id=eq.${programId}`,
      }, () => {
        queryClient.invalidateQueries({ queryKey: ['cycle-review', programId] })
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [programId])

  return query
}
```

**`apps/mobile/lib/cycle-review.ts` (read helper):**

```typescript
export async function getCycleReview(programId: string, userId: string) {
  const { data } = await supabase
    .from('cycle_reviews')
    .select('*')
    .eq('program_id', programId)
    .eq('user_id', userId)
    .maybeSingle()
  return data  // null if not yet generated
}
```

**Notification:**
- When `cycle_reviews` row is inserted, the Realtime subscription triggers cache invalidation
- If app is backgrounded, `expo-notifications` local notification: "Your cycle review is ready" with deep link to `history/cycle-review/[programId]`
- Notification is scheduled in `onCycleComplete()` (defined in `engine-012`) via `expo-notifications`

## Dependencies

- [engine-012-cycle-review-generator.md](../04-engine/engine-012-cycle-review-generator.md)
- [mobile-007-formula-editor-screen.md](./mobile-007-formula-editor-screen.md)
- [mobile-001-expo-router-layout.md](./mobile-001-expo-router-layout.md)
- [mobile-008-supabase-client-setup.md](./mobile-008-supabase-client-setup.md)
