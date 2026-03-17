# System Intent

## What Parakeet Is

A powerlifting training system. Not a social app, not a marketplace. Maximum fidelity.

## Core Goal

Accept many different data points about the human body over time, and produce a plan for optimizing a goal. Currently that goal is pure powerlifting strength (squat, bench, deadlift). The architecture supports future goal types (e.g. Hyrox).

The system must find touch points to synchronize with the real-world state of the human user. The more accurately it knows how the body feels right now, the better the next session will be.

## Design Philosophy

### 1. Synchronize with the real human

Training apps fail when they lose touch with how the lifter actually feels. Parakeet gates every workout on current body state. Touch points that capture reality:

- **Pre-session soreness check-in** — muscle-specific 1–5 ratings, fed into JIT volume/intensity modifiers
- **Session RPE logging** — actual difficulty vs prescribed, drives performance adjustment suggestions
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

### 5. Engine is pure domain logic

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
