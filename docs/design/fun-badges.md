# Feature: Fun Badges

**Status**: Implemented (all badge categories wired with data fetchers; only Power Couple deferred)

**Date**: 12-Mar-2026

## Overview

Expand the achievement system with 43 new badges that are funny, surprising, and occasionally wild. These go beyond standard PR/streak tracking to reward quirky training patterns, unlikely feats, and situations every lifter recognises but no app acknowledges.

## Problem Statement

The current achievement system (PRs, streaks, cycle badges, Wilks) is earnest and useful — but predictable. Lifters share gym stories about the weird stuff: the day they accidentally loaded the wrong weight and hit a PR, the workout they almost skipped but ended up crushing. Fun badges turn those moments into collectibles.

**Pain points:**
- Achievements feel like a spreadsheet — all metrics, no personality
- No recognition for the absurd situations that make training memorable
- Nothing to laugh about or screenshot to a training partner

**Desired outcome:** Users occasionally get surprised by a badge that makes them laugh, screenshot it, or say "how did it know?"

## Badge Catalog

### Consistency & Dedication

| # | Badge | Trigger | Why it's funny |
|---|-------|---------|----------------|
| 1 | **Dawn Patrol** | Complete 5 sessions before 6:00 AM | For the psychopaths who train before sunrise |
| 2 | **Night Owl** | Complete 5 sessions after 9:00 PM | The gym is empty and the vibes are unhinged |
| 3 | **Iron Monk** | Complete 30 consecutive sessions where every planned set is logged with at least the minimum prescribed reps | Inhuman discipline |
| 4 | **Sunday Scaries Cure** | Complete a session on 10 different Sundays | Nothing fixes existential dread like deadlifts |
| 5 | **365** | Log at least one session in 52 consecutive weeks | A full year. Respect. |
| 6 | **Perfect Week** | Complete all planned sessions and rest days in a 7-day period — no misses, no extras | The schedule said 3 days. You did exactly 3 days. Control freak energy. |
| 7 | **Leg Day Loyalist** | Complete 20 consecutive planned sessions that include squat or deadlift as primary lift | You never skip leg day. Literally never. |

### Performance & Milestones

| # | Badge | Trigger | Why it's funny |
|---|-------|---------|----------------|
| 8 | **Gravity, Meet Your Match** | Any primary lift estimated 1RM exceeds user's bodyweight | Welcome to the party |
| 9 | **Sir Isaac's Worst Nightmare** | Any primary lift estimated 1RM exceeds 2x bodyweight | Now you're just showing off |
| 10 | **The Tonne** | Total session volume (all sets x reps x weight) exceeds 10,000 kg in a single session | You moved a lorry today |
| 11 | **Round Number Enjoyer** | Hit a PR that lands exactly on a round number (100, 140, 200 kg etc.) | The plates aligned — literally |
| 12 | **Triple Threat** | Earn all three PR types (1RM, Volume, Rep-at-Weight) in a single session | Chaos session. Everything clicked. |
| 13 | **Technically a PR** | Set a new estimated 1RM PR by the smallest possible increment (0.5–1.25 kg) | A PR is a PR. Don't let anyone tell you otherwise. |
| 14 | **The Centurion** | Complete 100+ reps of a single primary lift in one session | Breathing squats called. They want their sanity back. |

### Funny & Situational

| # | Badge | Trigger | Why it's funny |
|---|-------|---------|----------------|
| 15 | **Comeback Kid** | Set a PR within 2 sessions of returning from a disruption lasting 7+ days | You weren't supposed to be stronger after that |
| 16 | **Didn't Want To Be Here** | Log a session with sleep quality "poor" AND energy level "low" — then complete 100% of planned sets | Showed up anyway. Legend. |
| 17 | **Volume Goblin** | Earn 5 Volume PRs before earning a single 1RM PR | You don't care about maxes. You just want MORE. |
| 18 | **One More Rep** | Log actual reps exceeding planned reps on 3+ sets in a single session | The plan said stop. You didn't listen. |
| 19 | **Plate Math PhD** | Complete a session using 5+ distinct weight values across all sets | Your bar changes looked like a university lecture |
| 20 | **Sandbagger** | Hit a new Rep-at-Weight PR on the final set of an exercise | Saving the best for last. Or just sandbagging. |
| 21 | **Bad Day Survivor** | Complete 50%+ of planned volume while a Major disruption is active | Everything was wrong and you still showed up. |
| 22 | **The Grinder** | RPE 9.5+ on 3 or more sets in a single session | Nothing moved fast today but everything moved. |
| 23 | **Tactical Retreat** | Return from a deload week and set a PR in the very next session | Proof that deloads work. You're welcome. |

### Lift Identity & Favoritism

| # | Badge | Trigger | Why it's funny |
|---|-------|---------|----------------|
| 24 | **Bench Bro** | Bench estimated 1RM exceeds squat estimated 1RM | We all know one. Now you are one. |
| 25 | **The Specialist** | One lift's estimated 1RM is 40%+ higher than your weakest lift's 1RM | You found your calling. The other lifts found your weakness. |
| 26 | **Equal Opportunity Lifter** | All three primary lift estimated 1RMs within 15% of each other | Perfectly balanced, as all things should be. |

### Rest Timer & Pacing

| # | Badge | Trigger | Why it's funny |
|---|-------|---------|----------------|
| 27 | **Impatient** | Start 10+ sets before the rest timer expires in a single session | The timer is a suggestion and you disagree |
| 28 | **Zen Master** | Wait for the full rest timer to expire on every single set across 5 consecutive sessions | Patience is a virtue. You have too much of it. |
| 29 | **Social Hour** | Average rest between sets exceeds 5 minutes across a full session | Were you lifting or catching up with friends? |

### RPE & Effort Patterns

| # | Badge | Trigger | Why it's funny |
|---|-------|---------|----------------|
| 30 | **RPE Whisperer** | Log RPE within 0.5 of the prescribed RPE on every set in a session (min 8 sets) | You know your body like a mechanic knows an engine |
| 31 | **Sandbag Detected** | Log RPE 6 or below on every set of a session | Either you're sandbagging or this was a deload. We're watching. |
| 32 | **Send It** | Log RPE 10 on any set that wasn't the last set of the day | You went there. And you still had sets left. Brave or reckless — we'll never tell. |

### Program & Cycle Loyalty

| # | Badge | Trigger | Why it's funny |
|---|-------|---------|----------------|
| 33 | **Old Faithful** | Run the same program formula for 3+ consecutive cycles | If it ain't broke, don't fix it |
| 34 | **Shiny Object Syndrome** | Change program formula 3+ times within a single cycle | The best program is the one you actually finish. Just saying. |
| 35 | **Deload Denier** | Complete 3 consecutive cycles without a single deload week | Rest is for the weak. (Please deload.) |

### Volume & Rep Range

| # | Badge | Trigger | Why it's funny |
|---|-------|---------|----------------|
| 36 | **Rep Machine** | Complete 50+ total reps of a single primary lift in one session | You turned a strength session into cardio |
| 37 | **Singles Club** | Complete a session where every primary lift set is a single (1 rep) | Heavy. Quiet. Terrifying. |
| 38 | **Jack of All Lifts** | Use 10+ unique auxiliary exercises within a single training cycle | You're trying everything. Commitment issues or open-mindedness — you decide. |

### Session Milestones

| # | Badge | Trigger | Why it's funny |
|---|-------|---------|----------------|
| 39 | **First Blood** | Complete your very first session ever | Everybody starts somewhere. Welcome. |
| 40 | **Parakeet OG** | Complete your very first cycle | Everyone starts somewhere. This badge never goes away. |
| 41 | **Century Club** | Complete 100 total sessions | Triple digits. You're not a beginner anymore. |
| 42 | **500 Club** | Complete 500 total sessions | At this point the gym owes you rent. |

### Wild & Rare

| # | Badge | Trigger | Why it's funny |
|---|-------|---------|----------------|
| 43 | **Ghost Protocol** | Complete a session in under 30 minutes (first set to last set) | In and out. Nobody saw you. |
| 44 | **Marathon Lifter** | A session lasts longer than 2 hours (first set to last set) | You live here now |
| 45 | **The Streak Breaker** | Break a streak of 8+ weeks, then rebuild it back to 8+ weeks | Proof that falling off the wagon isn't the end |

### Couples (deferred — requires partner linking)

| # | Badge | Trigger | Why it's funny |
|---|-------|---------|----------------|
| 46 | **Power Couple** | Both users complete a session on the same calendar day | Couples that lift together, stay together |

## User Experience

### Discovery

Badges appear as a surprise toast/card on the session completion screen when earned — same flow as PR star cards but with a distinct visual (coloured badge icon instead of a star). Users don't see the full catalog upfront; discovering what badges exist is part of the fun.

### Badge Collection

The Achievements screen (`profile/achievements.tsx`) gets a new "Badges" section showing earned badges with their name, icon, and date earned. Unearned badges are hidden (no greyed-out grid — that kills the surprise).

### Badge Rarity

Some badges are common (First Blood, Parakeet OG), some are rare (Triple Threat, The Streak Breaker). No explicit rarity label — let users figure it out from how hard they are to earn.

## Data Dependencies

**Session timestamps required (4 badges):** Dawn Patrol, Night Owl, Ghost Protocol, Marathon Lifter all need session start/end times. Confirm whether `session_logs` already tracks these before committing to implementation. If not, a schema change is needed first.

**Rest timer data required (3 badges):** Impatient, Zen Master, Social Hour need per-set rest duration or timer-expiry events. Check if `actual_rest_seconds` on session logs is sufficient.

**Bodyweight required (2 badges):** Gravity Meet Your Match and Sir Isaac's Worst Nightmare need current bodyweight from the user's profile.

**Partner linking required (1 badge, deferred):** Power Couple needs a way to identify linked accounts. Deferred until a partner-linking feature is built.

**All other badges** can be derived from existing session_logs, personal_records, disruptions, soreness check-in data, and program metadata.

## Open Questions

- [ ] Should badges be stored in a new `badges` table or computed from existing data like streaks/PRs?
- [ ] Should there be a shareable badge card (image export) in a future phase?
- [ ] Do `session_logs` already have start/end timestamps, or does the schema need extending?

## Future: Trace-Based Badges

The [prescription trace](./prescription-trace-integration.md) system enables a new category of badges based on the JIT decision chain:

- **"Clean Sheet"**: 10 consecutive sessions with zero modifiers active (the formula predicted perfectly — or you got very lucky)
- **"Resilient"**: 5+ sessions with active modifiers (soreness/readiness/disruption) where RPE still hit target (adjusted and still crushed it)
- **"Recovery Wisdom"**: Deload week traces show reduced intensity, next week RPE normalizes (deload discipline pays off)
- **"Adaptive"**: Completed sessions through 3+ different modifier types in one cycle (the system adapted, and so did you)

These require `jit_output_trace` data from the sessions table.

## References

- Related Design Docs: [achievements.md](./achievements.md), [prescription-trace-integration.md](./prescription-trace-integration.md)
- Existing specs: [engine-022-pr-detection.md](../specs/04-engine/engine-022-pr-detection.md), [mobile-019-achievements-screen.md](../specs/09-mobile/mobile-019-achievements-screen.md)
