# Features

Always consider the docs/designs first, to find where each feature request fits into the overall architecture of the app.

Read `docs/README.md` and other relevant docs to get a good picture of our system before starting to plan a feature.

## 1 ✅ DONE

~~our plain react dashboard app: `apps/dashboard` needs to be able to view local supabase and also prod data~~

**Implemented:** local/prod toggle in sidebar. Add `VITE_SUPABASE_PROD_URL` + `VITE_SUPABASE_PROD_KEY` to `.env.local` to enable prod button. All views re-fetch on env switch.

## 6

need to be able to make 'unending' programs, ones that are constantly dynamically generated JIT, so when in this mode, the next weeks workout will not be in the 'program' card, even this weeks whole plan will not be there.
only the next single workout. and once that is completed, then it will generate a plan for the next workout entirely based upon how your previous one (and other historical things) went

## 7

for unending programs, we need an option to 'finish' them, which perhaps is just the same as 'abandon' and we should rename that to 'end program'?

## 8

bar weight needs to be settable from settings page
need to be careful to then factor this into every calculation everywhere it is to be found, since the whole app currently uses a hardcoded 20kg bar
