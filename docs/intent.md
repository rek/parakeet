# System Intent

## What Parakeet Is

A powerlifting training system. Not a social app, not a marketplace. Maximum fidelity.

## Core Goal

Accept many different data points about the human body over time, and produce a plan for optimizing a goal. Currently that goal is **pure powerlifting strength** (squat, bench, deadlift). The architecture supports future goal types (e.g. Hyrox).

**Strength, not bodybuilding.** Every training science decision — volume thresholds, RPE scaling, rest periods, exercise selection — must be evaluated through a strength/powerlifting lens. Most published volume research is hypertrophy-focused; where hypertrophy and strength evidence diverge (rest periods, proximity to failure, rep ranges), favor strength-specific findings. Muscle size is a welcome side effect, not the optimization target.

The system must find touch points to synchronize with the real-world state of the human user. The more accurately it knows how the body feels right now, the better the next session will be.

## Design Philosophy

### 1. Synchronize with the real human

Training apps fail when they lose touch with how the lifter actually feels. Parakeet gates every workout on current body state. Touch points that capture reality:

- **Pre-session check-in** — muscle-specific soreness ratings, sleep quality, energy level — fed into JIT volume/intensity modifiers. Granularity matters: finer scales enable finer adaptation.
- **Session RPE logging** — actual difficulty vs prescribed, drives both intra-session volume recovery and cross-session volume calibration
- **Post-session capacity assessment** — "could you have done more?" — direct signal for volume calibration
- **Disruption reporting** — injury, illness, travel, fatigue, menstrual symptoms — modulates upcoming sessions
- **Cycle phase tracking** — optional period start logging estimates current menstrual phase for context

More signals = better sessions. Every data point makes the next workout more accurate. The system should actively seek new synchronization opportunities — if there's a way to capture body state that we're not using yet, we should add it.

Recovery-aware scheduling: when the system knows which muscles are sore and which are recovered, it should route training toward what is least fatigued. The goal is never to train through unnecessary soreness when a better option exists.

### 2. Sex-aware by default

Male and female athletes recover at different rates, handle different percentages of max load, and respond differently to training volume. Menstrual cycle phase affects training capacity. All calculations account for biological sex — MEV/MRV defaults, soreness modifiers, performance thresholds, warmup presets, auxiliary volume. This is a priority, not an afterthought.

### 3. Leverage improving LLMs

External LLMs improve over time. The system routes complex multi-variable reasoning (JIT adjustments, cycle reviews, motivational messages) through LLM calls so that model upgrades deliver free intelligence improvements with zero code changes. Formula-based fallbacks ensure offline functionality.

### 4. JIT over pre-generated

Training weights are never pre-calculated. The JIT generator runs at workout time using ~43 current-state inputs (soreness, disruptions, cycle phase, recent performance, volume history). The app never shows stale plans — every session reflects how the lifter feels right now.

### 5. Adaptive, not prescriptive

Volume is not fixed by the program template. A program says "2 heavy sets" as a starting point, but the system adjusts that number — both up and down — based on how the individual lifter responds. If RPE is consistently low, soreness is minimal, and the lifter reports capacity after sessions, the system prescribes more work. If fatigue accumulates, it prescribes less.

The adaptation loop: check-in → JIT prescription → workout → RPE and capacity evaluation → next-session adjustment. Adaptations are always one step behind — the system observes session N and adjusts session N+1. It never reacts to a single data point; it requires consistent signal across 2-3 sessions before changing volume. This prevents chasing noise from one bad night's sleep or one unexpectedly easy set.

Over time, the system learns each lifter's effective volume range and prescribes within it. A beginner who thrives on 2 sets gets 2 sets. An advanced lifter who needs 5 gets 5. The same lifter under stress gets fewer. The system responds to the human, not the template.

### 6. Engine is pure domain logic

The training engine package (`packages/training-engine/`) has no React, no Supabase, no side effects. It is testable, portable, and could power a different frontend. All state persistence flows through the app layer.

## Constraints

- **No backend API server** — Supabase SDK called directly from the app
- **KG only** — all weights in kilograms; database stores integer grams (140kg = 140000g)
- **Offline-capable** — formula JIT works without network; LLM features degrade gracefully with timeouts and fallbacks
- **Mobile-only** — Expo/React Native; no web app (dashboard is a separate developer tool)

## Documentation Structure

- `design/` — product-level feature docs organized by **feature** (what and why)
- `specs/` — implementation task docs organized by **layer** (how), numbered by dependency order (01-infra → 10-ai)
- One design doc may map to specs across multiple layer folders. This is intentional.
