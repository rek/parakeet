React/Vite developer telemetry dashboard for Parakeet.

## Key Rules

- **Theme**: all colours via `src/lib/theme.ts` constants or CSS vars from `src/styles.css`. No raw `rgba()`/hex in components.
- **Interactive elements**: `<button className="btn-reset">`, not `<div onClick>` (oxlint a11y).
- **Supabase**: all components use `useSupabase()` hook from `SupabaseContext`. Add `supabase` to `useEffect` deps.
- **Prod toggle**: set `VITE_SUPABASE_PROD_URL` + `VITE_SUPABASE_PROD_KEY` in `.env.local` to enable.
- **Timeline**: when adding a new page backed by its own table, also update `Logs.tsx` (Timeline) — add to `Promise.all`, `typeConfig`, `Stats`, `StatCard`.

## Validation

```bash
npx tsc --noEmit -p apps/dashboard/tsconfig.app.json
npx nx lint dashboard
```
