# Flock

**Status:** Implemented
**Date:** 10 Jun 2026
**Module:** `@modules/flock`

## Overview

A "Flock" screen (reached from the left drawer) that turns Parakeet's single-player training
into a shared experience for a small, trusted group. Open it and see every other lifter in
the instance as a card:
their most recent PR, their Wilks, their current training streak, and a celebratory
highlight from their latest session ("hit a 3-rep squat PR", "trained 4× this week"). It is
a private, read-only motivational layer — a leaderboard among friends and family who all
already know each other.

## Problem

Parakeet is deliberately single-player: every screen is about *your* body, *your* next
session. But the people running this instance are a family that trains together and pushes
each other. Today there is no way to see how anyone else is doing. Motivation that comes
naturally from a shared gym — "oh, Sara just pulled 140?" — is invisible in the app.

- No cross-user visibility of any kind in the core app (gym-partners is pairwise filming only).
- PRs and Wilks gains happen in isolation; nobody sees a friend's win.
- The family is already a closed, fully opted-in group, so the usual social-app privacy
  objections (strangers, discovery, scraping) don't apply — yet we still have no shared surface.

## Solution

A new **Flock** destination — a "Flock" item in the left drawer (alongside the other
feature-flagged entries like Nutrition and Lipedema Tracking) opening a screen that lists
every other lifter in the instance. Each lifter is a
card built from a **sanitized highlights projection** — never their raw training tables.
Cards show celebratory, derived signals only: latest PR per lift, Wilks score and recent
change, training streak, and a one-line "latest highlight." Tapping a card opens that
lifter's PR history (PRs and Wilks over time) — still celebratory-only, no raw logs.

Crucially, this is built on top of the existing privacy wall, not through it. Gym-partners
established that `session_logs` (actual weights, RPE, fails) never leaves a lifter's account.
Flock keeps that wall intact: friends read a **published highlights row** that each lifter's
own device writes after a session — a curated, safe subset — rather than reading anyone's
achievements or session tables directly.

## Scope (v1)

**In:** PR cards, Wilks + delta, streak, one-line latest-session highlight, per-lifter PR
history detail, a master "share my highlights" toggle, read-only.

**Out (deliberately):** health/medical/cycle data (cycle phase, lipedema, bodyweight),
raw set/RPE/fail detail, reactions/kudos/comments, notifications, any friend graph or
discovery. These are noted in Open Questions / Future as explicit later decisions.

## Decisions

| # | Decision | Choice | Rationale |
|---|----------|--------|-----------|
| 1 | Audience model | Instance-wide; everyone is in the flock | Closed family/friends instance. No friend graph, no requests, no discovery needed. Everyone who shares is visible to everyone who shares. |
| 2 | Direction | Read-only feed | Ships fast, minimal surface. Reactions/comments are a deliberate later decision (see Future). |
| 3 | What's shared | Celebratory / derived signals only | PRs, Wilks + delta, streak, one-line highlight. No raw logged weights, RPE, or fails — preserves the gym-partner privacy wall. |
| 4 | Health/medical data | Excluded from v1 | Cycle phase, lipedema tracking, and bodyweight are sensitive even within family. "Opted into the app" ≠ "opted into broadcasting medical data." Revisit as granular opt-in later. |
| 5 | Privacy mechanism | Sanitized highlights projection, not direct table reads | Friends never get RLS read on `achievements` / `session_logs` / health tables. The producing lifter's device publishes a curated `flock_highlights` row. Wall stays intact; the projection *is* the contract. |
| 6 | Share consent | Master "share my highlights" toggle, default OFF, with first-open prompt | Even in a trusted family, broadcasting is explicit. One toggle (not per-friend) keeps it simple. Off until the lifter says yes. |
| 7 | Highlight selection | Derived on-device at session complete | The same place achievements are already detected. Pick the best celebratory signal (new PR > Wilks bump > streak milestone > "trained today") and publish it. |
| 8 | Navigation | Drawer item in `LeftDrawer` | The left drawer (`components/ui/LeftDrawer.tsx`, opened via the header menu button) is where feature-flagged destinations live — Nutrition and Lipedema Tracking are both there, gated by `useFeatureEnabled`. Add a "Flock" `DrawerItem` gated by the `flock` flag, routing to `/(tabs)/flock`. Plenty of room; no tab-bar crowding. |
| 9 | Feature flag | `flock`, default off, Advanced category | Mirrors the gym-partner rollout pattern (first social feature shipped behind a flag). Opt-in until stable. |
| 10 | Relationship to gym-partners | Separate feature/module | Different shape (community vs pairwise) and opposite data posture (broadcast achievements vs hide performance). Shares nothing but the `profiles` table. |
| 11 | Empty / no-share state | Card hidden until a lifter shares | A lifter who hasn't enabled sharing simply doesn't appear. No "ghost" cards, no implying participation. |
| 12 | Data freshness | Highlights refresh on session complete | No realtime needed — this is motivational, not live. Pull-to-refresh + publish-on-complete is enough. |

## User Flows

### Turning on sharing (one-time consent)

1. Lifter opens the Flock screen (drawer → Flock) for the first time.
2. Sees an explainer: "Share your PRs and highlights with the flock?" + what is/isn't shared
   (PRs, Wilks, streaks — *not* weights, RPE, or any health data).
3. Toggles "Share my highlights" on. From now on their card appears for everyone.
4. Can turn it off anytime in Settings → Flock; their card disappears immediately.

### Browsing the flock

1. Open Flock (drawer → Flock) → list of lifter cards (only those who share), sorted by most recent highlight.
2. Each card: name/avatar, latest highlight line, latest PR, Wilks (+delta), streak.
3. Tap a card → that lifter's PR history (PRs per lift over time, Wilks trend). Celebratory-only.
4. Pull to refresh.

### Publishing a highlight (automatic, invisible)

1. Lifter completes a session.
2. On-device, the best celebratory signal is derived (reusing achievement detection).
3. If sharing is on, a sanitized `flock_highlights` row is published.
4. Other lifters see the update next time they open or refresh the Flock screen.

## Visual Design Notes

### Flock screen — lifter list

```
FLOCK

┌─────────────────────────────────────────┐
│ 🦜 Sara                          2h ago │
│ Squat PR — 142.5kg × 3                   │
│ Wilks 318  ▲ +4      🔥 12-wk streak     │
├─────────────────────────────────────────┤
│ 🦜 Mateo                         1d ago │
│ Trained today                            │
│ Wilks 287  ▬          🔥 5-wk streak     │
├─────────────────────────────────────────┤
│ 🦜 Priya                         3d ago │
│ Deadlift PR — 160kg × 1                  │
│ Wilks 341  ▲ +7      🔥 9-wk streak      │
└─────────────────────────────────────────┘
```

- One card per sharing lifter; non-sharers are absent (not greyed).
- Highlight line is the single best celebratory signal for that lifter.
- Tap → PR history detail.

### Card detail (on tap)

- Lifter name + avatar.
- PR history: best e1RM per lift over time (squat/bench/deadlift), Wilks trend.
- No raw sets, no RPE, no fails, no health data.

## User Benefits

**Shared motivation**: A friend's PR shows up in your app. The "everyone's pushing each
other" energy of a real gym, made visible.

**Zero new data entry**: Highlights are derived from data the app already captures
(achievements, Wilks). Nothing extra to log.

**Privacy-respecting by construction**: Friends only ever see a sanitized projection —
celebratory signals, never raw performance, never health/medical data. Sharing is off until
you turn it on, and off the moment you turn it back off.

**Doesn't compromise the mission**: It's a closed, opt-in motivational layer for a known
group — not a social network. No discovery, no public profiles, no follower graph.

## Open Questions

- [ ] **Default share state** — decision #6 sets default OFF for safety. For a tight family
  instance, is an opt-*out* default acceptable instead? Needs the user's call.
- [ ] **Highlight ranking** — exact priority when a session triggers multiple signals (PR vs
  Wilks bump vs streak). Spec'd as PR > Wilks > streak > trained-today; confirm.
- [ ] **Avatars** — do profiles have an avatar today, or is this name + bird glyph only in v1?

## Future (explicitly out of v1)

- **Kudos/reactions** — lightweight emoji on a friend's PR (adds a writes table + notification surface).
- **Granular health sharing** — per-metric, default-off opt-in for bodyweight/other non-medical metrics.
- **Notifications** — "Sara hit a squat PR" push. Out for v1 (no notification surface).

## References

- Related feature: [social/](../social/index.md) — gym-partners; established the
  `session_logs` privacy wall this feature deliberately preserves.
- Data sources: `@modules/achievements` (PRs, streaks, Wilks badges), `@modules/wilks`
  (Wilks score), `@modules/profile` (display name/avatar).
- Spec: [spec-data-foundation.md](./spec-data-foundation.md) — highlights projection, RLS, opt-in.
- Intent guardrail: [intent.md](../../intent.md) — "Not a social app." Flock is scoped as a
  closed opt-in motivational layer to stay on the right side of this.
