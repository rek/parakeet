# Dashboard — AI Telemetry

Internal dev tool for inspecting AI decisions in the Parakeet training app.

## Views

| View | Description |
|------|-------------|
| Timeline | Chronological feed of all AI events |
| JIT Sessions | Per-session adjustments: intensity bar, set delta, rationale, JSON |
| Hybrid Comparisons | Formula vs LLM diff with DIVERGED/CONSENSUS badges |
| Cycle Reviews | Full Sonnet output: assessment, ratings, suggestions |
| Formula Suggestions | AI-proposed formula overrides with active/inactive status |
| Developer Suggestions | Priority-sorted structural feedback |

## Commands

```sh
# Dev server
npx nx serve dashboard

# Type check
npx tsc --noEmit -p apps/dashboard/tsconfig.app.json

# Lint
npx nx lint dashboard
```

## Setup

Copy env vars (local Supabase service_role key):

```sh
npx supabase status -o env
# copy API URL + service_role key into apps/dashboard/.env.local
```

`.env.local` keys:

```
VITE_SUPABASE_URL=http://localhost:54321
VITE_SUPABASE_KEY=<service_role key>

# Optional — enables prod toggle in the sidebar:
VITE_SUPABASE_PROD_URL=https://your-project.supabase.co
VITE_SUPABASE_PROD_KEY=<prod service_role key>
```

## Theming

CSS variables are in `src/styles.css`. TypeScript references are in `src/lib/theme.ts` — use these in inline styles instead of raw `rgba()`/hex literals.
