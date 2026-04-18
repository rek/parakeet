# Spec: Achievements Screen & Session Completion Stars

**Status**: Implemented
**Domain**: parakeet App

## What This Covers

Two surfaces: (1) session completion stars shown immediately after each workout, and (2) the Profile tab showing cycle badges, streaks, WILKS score, and PR history.

## Tasks

### Session Completion Stars

**`apps/parakeet/app/session/complete.tsx`** — extend existing completion screen:

- After `completeSession()` resolves, call `detectSessionPRs()` and render star cards if any PRs were earned
- Star card component: `apps/parakeet/components/achievements/StarCard.tsx`
  - Props: `pr: PR`
  - Displays: `⭐ New [Lift] [PR type] — [value]`
    - `estimated_1rm` → "New Squat Estimated 1RM — 152 kg"
    - `volume` → "New Bench Volume PR — 3,840 kg total"
    - `rep_at_weight` → "New Squat Rep PR — 6 reps @ 140 kg"
  - Animation: slide up with fade-in, staggered 200ms between cards
- If no PRs: no star section (no "no records" message)
- Streak update line below stars: "Week 7 clean ✓" or if streak reset: "Streak reset — missed a session this week" (amber, only shown on reset). Note: the streak requires **every** scheduled session in a week to be completed; disruption-logged skips still break the streak under the strict rule.
- Cycle badge granted line: shown only when `checkCycleCompletion()` returns `qualifiesForBadge: true` for the now-completed cycle

**`apps/parakeet/src/modules/achievements/application/achievement.service.ts`:**
- `getPRHistory(userId: string, lift: Lift): Promise<HistoricalPRs>` — fetches `personal_records` from Supabase
- `getStreakData(userId: string): Promise<StreakResult>` — fetches week history from `sessions` + `disruptions`, calls `computeStreak()`
- `getCycleBadges(userId: string): Promise<CycleBadge[]>` — fetches completed programs where `completion_pct >= 0.80`

---

### Profile Tab — Achievements Section

**`apps/parakeet/app/(tabs)/profile.tsx`** — new tab (or extend existing settings profile):

Layout:
```
┌──────────────────────────────────────┐
│  Cycles Completed      [ 3 badges ]  │
│  Cycle 1 · 10 wk · Squat +10kg      │
│  Cycle 2 · 12 wk · All lifts ↑      │
│  Cycle 3 · 10 wk · Squat +7.5kg     │
├──────────────────────────────────────┤
│  Streak                              │
│  🔥 Current: 7 weeks clean           │
│     Best:    12 weeks                │
├──────────────────────────────────────┤
│  WILKS Score            [284] →      │
│  (tap to open WILKS detail page)     │
├──────────────────────────────────────┤
│  Personal Records                    │
│  Squat    152 kg est. 1RM            │
│           6 reps @ 140 kg            │
│  Bench    105 kg est. 1RM            │
│  Deadlift 195 kg est. 1RM            │
└──────────────────────────────────────┘
```

- Cycle badges: list, each shows cycle number, duration, primary stat. Tapping opens the cycle review for that program.
- Streak card: `currentStreak` (large) + `longestStreak` (small). Streak shown on Today tab as a compact pill: "🔥 7 wk" — tapping navigates to Profile. A "week" counts only when every scheduled session that week was completed; the current in-progress week is frozen (doesn't update the pill) until its Sunday end. Imported CSV history does not contribute.
- WILKS score: computed from `computeWilks2020()` (engine-013), displayed as a rounded integer. Tapping opens WILKS detail page.

**WILKS Detail Page — `apps/parakeet/app/profile/wilks.tsx`:**
- Current WILKS score (large)
- Chart: one point per completed cycle (Recharts or Victory Native line chart)
- Table: lift → estimated 1RM used + last-updated date
- Body weight used in calculation (from current cycle start)
- Reference context: "World-class: 500+. Advanced: 350–450. Intermediate: 250–350."
- Body weight update link → navigates to Settings → Profile to edit

**Today Tab pill — `apps/parakeet/app/(tabs)/today.tsx`:**
- Add a compact `<StreakPill currentStreak={n} />` component in the Today header area
- Only shown when `currentStreak >= 1`

---

### Data Fetching

Use React Query hooks co-located with the screens:

- `useAchievements(userId)` — fetches badges, streak, PRs in parallel; cached 5 min
- `useWilksHistory(userId)` — fetches per-cycle WILKS data points; cached until cycle completes

## Dependencies

- [engine-022-pr-detection.md](./spec-pr-detection.md) — PR detection + streak + cycle completion logic
- [engine-013-wilks-formula.md](./spec-wilks.md) — WILKS score computation
- [mobile-005-session-logging-screen.md](./mobile-005-session-logging-screen.md) — complete.tsx extended
- [mobile-014-cycle-review-screen.md](./mobile-014-cycle-review-screen.md) — cycle badge taps navigate here
