# Spec: Developer Suggestions Channel

**Status**: Implemented
**Domain**: Training Engine + Data

## What This Covers

The developer suggestions output from cycle review LLM responses — structural insights that require code changes rather than config changes. Includes the `developer_suggestions` Supabase table, the data-access wrapper, and the developer-only settings screen that surfaces them.

## Tasks

### developer_suggestions Table

Add to migration:
```sql
CREATE TABLE developer_suggestions (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       uuid NOT NULL REFERENCES profiles(id),
  program_id    uuid NOT NULL REFERENCES programs(id),
  created_at    timestamptz NOT NULL DEFAULT now(),
  description   text NOT NULL,
  rationale     text NOT NULL,
  developer_note text NOT NULL,   -- explains what code change is needed
  priority      text NOT NULL CHECK (priority IN ('high', 'medium', 'low')),
  status        text NOT NULL DEFAULT 'unreviewed'
                  CHECK (status IN ('unreviewed', 'acknowledged', 'implemented', 'dismissed')),
  reviewed_at   timestamptz
);

ALTER TABLE developer_suggestions ENABLE ROW LEVEL SECURITY;
-- Only the app owner can read (single-user app — RLS allows both users to read)
CREATE POLICY "authenticated users can read developer suggestions"
  ON developer_suggestions FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "service role writes developer suggestions"
  ON developer_suggestions FOR INSERT WITH CHECK (true);
```

No RLS write for regular users — suggestions are written server-side via the cycle review LLM call (which runs in the Supabase Edge Function context, not directly from the client).

---

### Cycle Review Integration

**File: `packages/training-engine/src/review/cycle-review-generator.ts`**

The `CycleReview` type already contains `structuralSuggestions`. After the LLM returns a valid `CycleReview`, extract and store developer suggestions:

```typescript
// In apps/parakeet/src/lib/cycle-review.ts — storeCycleReview()
if (review.structuralSuggestions?.length) {
  await supabase.from('developer_suggestions').insert(
    review.structuralSuggestions.map(s => ({
      user_id: userId,
      program_id: programId,
      description: s.description,
      rationale: s.rationale,
      developer_note: s.developerNote,
      priority: s.priority,
    }))
  )
}
```

This extends the existing `storeCycleReview()` function in `apps/parakeet/src/lib/cycle-review.ts`.

---

### Data Access

**File: `apps/parakeet/src/lib/developer-suggestions.ts`**

```typescript
import { supabase } from './supabase'

export async function getDeveloperSuggestions() {
  const { data, error } = await supabase
    .from('developer_suggestions')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function updateSuggestionStatus(
  id: string,
  status: 'acknowledged' | 'implemented' | 'dismissed',
) {
  const { error } = await supabase
    .from('developer_suggestions')
    .update({ status, reviewed_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}
```

---

### Developer Settings Screen

**`apps/parakeet/app/settings/developer.tsx`** — extend existing developer screen with a "Cycle Feedback" section:

```
Cycle Feedback  [2 unreviewed]
──────────────────────────────────────────────
HIGH  Consider adding 5-day/week frequency
      "Lifter has consistently completed 4-day
       weeks at low RPE for 2 cycles..."
      Dev note: "Add frequency option to program
       generator — currently only 3/4 supported"
      [Acknowledge]  [Dismiss]

MED   Add Deficit Deadlift to aux pool
      "RDL shows no correlation for 2 cycles..."
      Dev note: "Add to auxiliary_exercises seed"
      [Acknowledge]  [Dismiss]
──────────────────────────────────────────────
Acknowledged (3)  Implemented (1)  Dismissed (2)
```

- Priority badge: red = high, amber = medium, grey = low
- "Unreviewed" count badge shown on the developer settings row in the main settings screen (same pattern as performance suggestions badge on the main settings icon)
- Acknowledged, Implemented, Dismissed entries collapsed into a count row; tappable to expand history

**Navigation:** Settings → Developer → "Cycle Feedback" section (no separate route — rendered within developer.tsx as a section).

---

### Badge Count

**`apps/parakeet/app/(tabs)/settings.tsx`** — extend existing badge logic:

```typescript
const unreviewedDeveloperSuggestions = await supabase
  .from('developer_suggestions')
  .select('id', { count: 'exact' })
  .eq('status', 'unreviewed')
```

Show a secondary badge on the "Developer" row in settings (separate from the performance suggestions badge on the Settings tab icon).

## Dependencies

- [engine-012-cycle-review-generator.md](./engine-012-cycle-review-generator.md) — `CycleReview.structuralSuggestions` source
- [mobile-014-cycle-review-screen.md](../09-mobile/mobile-014-cycle-review-screen.md) — cycle review triggers suggestion storage
