---
feature: optional-cardio
status: implemented
modules: [jit, session]
---
# Optional Cardio Block

An opt-in cardio finisher the lifter can add at the pre-session check-in. Aimed
at lifters who are also new to the gym and want some conditioning alongside
their strength work (GH#237).

## User flow
1. On the check-in (`session/soreness`) screen, the lifter flips the **Add
   cardio** toggle (default off; the choice is remembered via AsyncStorage).
2. They optionally pick a length: 10 / 15 / 20 min (default 10).
3. On generate, JIT appends one timed cardio entry to the session's auxiliary
   work. It renders as a normal timed aux exercise ("Round 1 · _ min") and is
   skippable / removable like any aux.

## Design decisions
- **No categorization.** The block is synthesized from the existing engine
  cardio pool (`DEFAULT_CARDIO_POOL` / the lifter's configured `allPools.cardio`)
  — there is no cardio "type/tag" on workout-templates. The modality rotates
  against `recentAuxExercises` so the same machine isn't suggested every time.
- **No level targeting.** Cardio is non-adaptive and offered to every lifter;
  the system does not branch on training age (per intent: "adapt to any level").
- **Does not touch volume/recovery.** Cardio is `timed`, which the engine
  already excludes from volume top-up scoring, so MEV/MRV accounting is
  untouched. The block is appended *after* the prescription is finalized, so it
  never perturbs strategy/divergence/trace logic.
- The prescribed minutes ride on the set's `reps` field — the timed `SetRow`
  renders that as the "min" placeholder (no schema change needed).

## Key code
| Concern | Location |
|---------|----------|
| Cardio block builder (pure) | `modules/jit/utils/buildCardioBlock.ts` |
| Append into JIT output | `modules/jit/lib/jit.ts` (`runJITForSession`, `cardioOptions`) |
| Check-in toggle + duration UI | `app/(tabs)/session/soreness.tsx` |

## Scope / follow-ups
- Ad-hoc (no-primary-lift) sessions return early from JIT and do not receive a
  cardio block.
- Modality is auto-picked; the lifter can swap/remove it on the session screen.
  A pre-session modality picker is a possible follow-up.
- Wiring cardio into conditioning load / recovery accounting is intentionally
  out of scope for v1.
