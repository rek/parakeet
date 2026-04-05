# Dashboard — AI Telemetry Viewer

## Problem

During development, the AI components of the JIT pipeline (LLM adjustments, hybrid strategy comparisons, cycle reviews, formula suggestions) produce structured output that is hard to inspect from within the mobile app. Developers need a fast way to read and compare this data without querying the database manually.

## Solution

A plain React (Vite) web app at `apps/dashboard` that connects directly to Supabase (bypassing RLS via service_role key) and displays AI telemetry in a developer-friendly UI.

## Constraints

- Internal tool only — service_role key, never shipped to users
- No auth — assumes local or trusted network access
- Two environments: local Supabase (always available) and production Supabase (optional, requires prod keys in `.env.local`)
- Read-only — no mutations to the database

## Architecture

```
apps/dashboard/
  src/
    lib/
      supabase.ts          # Exports clients{local, prod} — two named clients
      SupabaseContext.tsx  # React context for env switching; useSupabase() hook
      theme.ts             # TypeScript constants pointing to CSS vars (for inline styles)
    styles.css             # CSS custom properties (colours, borders, overlays)
    app/
      app.tsx              # Sidebar nav + local/prod toggle
      Logs.tsx             # Timeline — all AI events unified feed
      JITLogs.tsx          # JIT session adjustments
      WorkoutSummaries.tsx # Completed sessions — RPE, PRs, performance
      MotivationalLogs.tsx # Post-workout motivational messages — LLM input context + output
      ComparisonLogs.tsx   # Hybrid strategy diffs
      CycleReviews.tsx     # Cycle review output
      FormulaSuggestions.tsx
      DeveloperSuggestions.tsx
    components/
      Badge.tsx            # Colour-coded status badges
      JsonViewer.tsx       # Collapsible JSON tree
```

## Timeline Aggregation Rule

`Logs.tsx` is the unified AI event feed. **Every new dashboard page that reads from its own Supabase table must also add a corresponding entry to `Logs.tsx`**. Failure to do so means the Timeline shows 0 for that event type while the detail page shows data — a confusing discrepancy.

Checklist when adding a new dashboard page:
1. Add the Supabase query to `Promise.all` in `Logs.tsx`
2. Add an entry to `typeConfig` with colour/label/icon
3. Add a field to `Stats` and a `StatCard`
4. Map the results to `TimelineEvent[]`

## JsonViewer Usage

`JsonViewer` requires either `label` (gives it a toggle button) or `defaultCollapsed={false}` (renders open immediately). Without one of these, content initialises hidden with no UI escape hatch — visually appears empty.

## Env Switching

The sidebar shows `local` and `prod` toggle buttons. Switching re-fetches all data via the new Supabase client. Context is provided by `SupabaseContext`; all views consume `useSupabase()` and pass `supabase` in their `useEffect` deps so data re-fetches on change.

Env configuration in `apps/dashboard/.env.local`:
```
VITE_SUPABASE_URL=http://localhost:54321
VITE_SUPABASE_KEY=<local service_role>

# Optional prod (enables prod button in sidebar):
VITE_SUPABASE_PROD_URL=https://your-project.supabase.co
VITE_SUPABASE_PROD_KEY=<prod service_role>
```

## Theming

All colours are CSS custom properties in `styles.css`. Components must reference these via `theme.ts` constants — no raw `rgba()`/hex values in component files.

Pattern:
```ts
import { theme } from '../lib/theme';
// use theme.border.accent, theme.bg.purpleDim, etc.
```

## Implementation Status

- [x] Timeline view (all AI events unified feed) — JIT, hybrid, cycle review, formula suggestion, developer suggestion, motivational
- [x] JIT sessions view
- [x] Workout Summaries view — last 50 completed sessions with RPE, performance vs plan, PRs, completion %
- [x] Motivational messages view — LLM input context (completionPct, topWeightKg, totalSetsCompleted, PRs, RPE, cycle phase) + generated message
- [x] Hybrid comparisons view
- [x] Cycle reviews view
- [x] Formula suggestions view
- [x] Developer suggestions view
- [x] Local/prod environment toggle (SupabaseContext)
- [x] Theme centralisation (theme.ts + CSS vars)
- [x] oxlint target (`nx lint dashboard`)
- [x] TypeScript strict (no errors)
