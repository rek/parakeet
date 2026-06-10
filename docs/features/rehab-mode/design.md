# Feature: Rehab Mode

**Status**: Draft

**Date**: 21 May 2026

**Origin**: [GH#220](https://github.com/rek/parakeet/issues/220)

## Overview

A per-lift toggle that puts a lift into a long-term capped state for the duration of a rehab or injury block. Caps weight, pauses every adaptive engine mechanism that would push past the cap or infer a false 1RM, and adds a `pain-limited` toggle to the RPE picker so pain-limited sets are stored but excluded from auto-progression, PR detection, working-1RM updates, and volume top-up.

## Problem Statement

The existing system handles transient injuries via the `disruption` module (a short-term % weight reduction with a Mark Resolved flow). That model breaks for multi-week rehab:

- A 10-week knee rehab can't be repeatedly re-applied as a disruption — disruptions stack one-shot reductions on top of the user's normal 1RM, not as a structural ceiling.
- Users currently hack around this by manually lowering their stored 1RM. That preserves their weight ceiling but lies to every other part of the engine (PR detection, working-1RM, calibration).
- RPE inputs become ambiguous. A user training a knee-rehab squat reports either:
  - **Muscular RPE (low)** — engine pushes weight back up past the rehab cap and inflates working-1RM.
  - **Pain-limited RPE (high)** — engine treats the lifter as maxed-out and won't progress when the knee heals.
- Neither interpretation matches reality. The lifter ends up distrusting the prescription.

**Desired outcome:** A first-class way to say "this lift is in rehab — respect this ceiling, ignore RPE for progression, and don't confuse my injury sets with PRs." When rehab ends, normal training resumes from the user's preserved real 1RM, and the rehab sets do not pollute future calibration.

## User Experience

### User Flows

**Flow A — Enabling Rehab Mode:**

1. From Settings → Training → Rehab Mode (or from the affected lift's page), user taps "Enable Rehab Mode for Squat".
2. Form:
   - Cap weight (kg) — required, defaults to 50% of current 1RM
   - Note (optional, free text — e.g. "right knee, sub-quad pain on descent")
   - End date (optional — leave open if unknown)
3. Submit. From this moment forward, the engine treats the lift as capped.
4. A `🩹 Squat — Rehab Mode` chip appears in the Today screen chip row. Tapping it opens the cap modal for editing.

**Flow B — Logging a set in Rehab Mode:**

1. User starts a squat session as normal. Soreness check-in is unchanged.
2. JIT generates the workout. Working weight is `min(formulaWeight, capKg)`. If the formula would have prescribed more than the cap, a small footnote appears: "Capped by Rehab Mode."
3. During the workout, the RPE picker shows the standard 6–10 scale **plus** a small `🩹 pain-limited` toggle. The toggle defaults to off (= muscular RPE, as today). Tapping it tags the set's RPE as pain-limited.
4. Pain-limited sets are stored in the set log with the tag. The engine excludes pain-limited RPE values from:
   - Step 2 RPE auto-progression
   - Volume add-back / recovery offers
   - Working-1RM estimation
   - PR detection (estimated-1RM, volume PRs, rep-at-weight PRs)
   - Long-term performance adjuster suggestions
5. All sets logged while a rehab cap is active are also stored with a `during_rehab` marker so cross-session analytics (modifier effectiveness, RPE trend, capacity calibration) can exclude them.

**Flow C — Editing or Disabling Rehab Mode:**

1. Tap the chip on the Today screen → bottom sheet modal.
2. Shows: cap weight, note, end date.
3. User can change the cap (e.g. raise from 60 kg to 70 kg as recovery progresses), update the note, set an end date, or tap "End Rehab Mode" to disable immediately.
4. On disable: the cap row is marked `ended_at = now()`. Sets logged during the period stay tagged; new sets log with `during_rehab: false`.
5. Next JIT generation runs without the cap — normal auto-progression resumes from the user's preserved real 1RM.

**Alternative Flows:**

- **Concurrent disruption + rehab cap**: Both apply. The cap is the ceiling; a disruption (e.g. "knee extra sore today") can further reduce weight below the cap. The disruption resolve flow is unchanged.
- **Cap exceeds formula weight**: No-op. The cap is a ceiling, not a floor. If `formulaWeight ≤ capKg`, the cap never bites.
- **Soreness severe (≥9) on capped lift**: Recovery mode wins (40% × 3×5) — overrides everything as today. The 40% is computed against the _capped_ working weight, not the user's stored 1RM.
- **Re-enabling after end**: Each enable/disable is a new `rehab_caps` row. History is preserved for analytics and so the user can review past rehab blocks.

### Visual Design Notes

- **Today chip**: Same chip style as disruption chips. Bandage icon (`🩹`), severity-neutral border color (slate-blue), label `{Lift} — Rehab Mode`. Tapping opens the cap modal.
- **Cap modal**: Reuses the disruption bottom-sheet pattern. Editable cap (numeric input with kg suffix), note (multiline), end date (date picker with "None" toggle), destructive "End Rehab Mode" button at bottom.
- **RPE picker pain-limited toggle**: Small pill below the 6–10 row, labeled `🩹 Pain-limited`. Greyed out / hidden entirely when no rehab cap is active for the current lift. Default off.
- **Session footnote when capped**: Subtle line under the working weight ("Capped by Rehab Mode") so the lifter is reminded why the weight isn't where the formula would put it.
- **Settings page**: Under Training Settings, a "Rehab Mode" row showing active caps. Tap → list of lifts with toggles to enable/edit per lift.

## User Benefits

**Honest engine state during rehab**: The engine knows it's seeing capped, pain-limited work and doesn't try to "help" by raising weights or awarding PRs the lifter doesn't want.

**Preserved real 1RM**: Stored 1RM isn't lowered, so resuming after rehab requires no manual restoration — the user picks up where they left off.

**Clean calibration history**: Sets logged during rehab are flagged. The performance adjuster, modifier-effectiveness analyzer, and adaptive-volume calibrator skip them, so the user's "normal" volume math isn't polluted by 10 weeks of injury work.

**Trustworthy RPE input**: The lifter no longer has to choose between two wrong RPE answers. They report the muscular RPE (which is meaningful for history) and optionally tag it as pain-limited.

## What We Chose NOT To Do

- **No automatic ramp**: Per Takpapp's feedback (GH#220), a v1 with manual cap edits is enough. Auto-ramp (e.g. cap rises 2.5% / week) is a follow-up enhancement.
- **No global cap**: Per-lift only. Most rehab cases (knee, shoulder) affect one lift family, not all three.
- **No engine-side cap derivation from injury type**: User sets the kg. The engine doesn't second-guess. This keeps the feature predictable and avoids a separate "rehab protocol" data model.
- **No automatic disabling on end date**: The end date is informational — the cap stays active until the user explicitly ends it. Auto-disable on date passage could surprise a still-recovering user with a sudden weight jump.
- **No retroactive untagging**: Once a set is logged with `during_rehab: true`, it stays that way. Even if the user later decides "actually that was a clean set," they can't reclassify it. Avoids confusion in history.

## Open Questions

- [ ] Should the `pain-limited` toggle remember the last setting within a session (e.g. if every previous set was pain-limited, default the next one to on)? Probably yes — saves taps for the common case.
- [ ] Should we surface "you have N rehab sets in the last 12 weeks" anywhere in the cycle review, or is that out of scope?
- [ ] Aux exercises: when a primary lift is in rehab mode, should the rehab cap also affect aux exercises that share muscles (e.g. paused squat during squat rehab)? Initial decision: no — aux propagation already follows main-lift volume ratio (GH#217), so reducing main sets already reduces aux. The cap doesn't need to propagate further. Revisit if it turns out aux gets too aggressive.

## Future Enhancements

- **Auto-ramp protocol**: Cap rises by a configurable % per week (e.g. RTS-style return-to-training).
- **Rehab cycle review**: Dedicated end-of-rehab review summarising sets logged, average pain-limited rate, suggested return-to-normal-training week.
- **Per-aux opt-out**: Let the user mark specific aux exercises as also-capped or excluded (e.g. "no Bulgarian split squats during knee rehab").
- **Engine-side suggested cap**: When a user reports a major injury disruption that persists past N weeks, suggest converting it into a Rehab Mode cap.

## Domain References

- [domain/adjustments.md](../../domain/adjustments.md) — soreness, readiness, disruption modifiers (rehab cap stacks under all of these as a hard ceiling)
- [domain/session-prescription.md](../../domain/session-prescription.md) — JIT pipeline order (cap applied in Step 8 weight assembly, suppression flags consumed by Steps 0/2)
- [domain/performance-analysis.md](../../domain/performance-analysis.md) — working-1RM and PR detection (pain-limited and `during_rehab` sets are excluded)
- [domain/athlete-signals.md](../../domain/athlete-signals.md) — RPE signal (pain-limited tag is a new dimension)

## References

- Related design docs:
  - [features/disruptions/design.md](../disruptions/design.md) — sibling feature for transient issues
  - [features/jit-pipeline/design-adaptive-volume.md](../jit-pipeline/design-adaptive-volume.md) — adaptive volume must respect cap + pain-limited tag
- Specs: see this dir's `spec-*.md` files
- External: GH#220
