# Feature: Lipedema tracking

**Status**: Implemented

**Date**: 21 Apr 2026

## Overview

Log of limb circumferences, pain, and swelling — the primary way to
tell whether the nutrition protocol is doing anything. One entry per
user per day (upsert). Expected cadence is weekly, but the schema and
UI accept any cadence.

## Problem statement

- **The nutrition module (gh#199) is useless without feedback.** The
  protocol recommends foods + supplements + lifestyle; without a way
  to see whether the user's legs are getting smaller or whether
  morning pain drops, the catalog is read-only advice and can't adapt.
- **The scale lies for lipedema.** Body weight and BMI conflate
  pathological adipose with healthy mass; bioimpedance is unreliable
  on affected limbs (see `tools/data/labs.md`). Tape-measure
  circumferences at standard landmarks are the practical ground
  truth at home.
- **Pain and swelling are subjective but respond fast.** A single
  well-chosen 0–10 score captures a meaningful signal the scale
  doesn't; it's also the first thing that moves on a good keto week.
- **This is the prereq for the unique-to-parakeet angle.** Training
  correlation only has signal if we can overlay symptom trajectories
  on Wilks / density / soreness. No measurements = no correlation.

## User experience

### User flow

1. User toggles **Lipedema Tracking** on in Settings → Features.
2. Drawer shows a new "Lipedema Tracking" entry (body-outline icon).
3. Tap → screen with a date navigator (prev/next/today), a pre-filled
   form for the selected date, and a history list below.
4. Per-limb input shows a delta vs the most recent prior value (▼ 0.5 cm).
5. Enter whatever you measured — blank fields are fine. Save.
6. Editing the selected date again upserts in place (no duplicate rows).
7. Tap any history card to load it into the form for editing; trash
   icon deletes (with confirm). A toast confirms save / delete.

### Visual design notes

- Date navigator at top (chevron prev/next, "Jump to today" pill).
- One card, ten number fields in L/R pairs. Cm with 1 decimal; the
  form hints this. Each side shows the prior value as placeholder and
  a coloured delta tag (▼ green = shrink, ▲ red = growth) when the
  current entry differs from prior.
- Two separate scalar fields for pain and swelling (0–10).
- Notes textarea for qualitative context (slept poorly, travelled,
  heavy lift yesterday, MLD session).
- History list below shows date + per-limb L/R cm for all five
  landmarks + pain/swelling chips + notes preview. Tap to load into
  the form; trash icon to delete (with confirm).
- "Pre-fill from last entry" button appears when the form is blank
  and a prior entry exists.
- Empty state explains that one limb is enough to start a trend.
- No forced-choice fields — all optional. A pain-only or notes-only
  entry is valid.

## User benefits

**See if it's working.** The only signal that matters for a
non-curable condition: is the trajectory improving? Thigh circumference
at a fixed landmark, measured weekly, is the cheapest honest metric.

**Anchor nutrition decisions.** "Did the keto re-entry this week
reduce swelling?" becomes a testable question instead of a feeling.

**Foundation for correlation.** Once two weeks of entries exist,
downstream phase-2 work (intake logging, training correlation) has
real data to overlay on.

## Open questions

- [ ] Photo upload: column exists, UI doesn't. Wire once Supabase Storage flow is proven here (reuse the video-analysis pattern).
- [ ] Trend charts: pure fns (`limbTrend`, `seriesDrift`, `adjacentDelta`, `priorValue`) are in place. The per-limb delta tag uses `priorValue`; a proper sparkline / line chart per limb (L+R overlay) is still TODO once the history list gets crowded.
- [ ] Reminder cadence: once-weekly push notif? Reuse the rest-timer notification plumbing?
- [ ] Clinician-shareable export: CSV? PDF? Defer until asked for it.

## References

- Spec: [spec-data-layer.md](./spec-data-layer.md)
- Schema migrations:
  - `supabase/migrations/20260421110000_create_lipedema_measurements.sql` — table + RLS
  - `supabase/migrations/20260504100000_lipedema_measurements_updated_at_trigger.sql` — `updated_at` trigger
- Module: `apps/parakeet/src/modules/lipedema-tracking/`
- Parent tracker: [gh#204](https://github.com/rek/parakeet/issues/204)
- The nutrition module this measures: [docs/features/nutrition/](../nutrition/)
- Why bioimpedance lean mass isn't trustworthy: [docs/domain/nutrition.md](../../domain/nutrition.md) + `tools/data/labs.md`.
