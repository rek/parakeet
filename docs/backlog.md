# Backlog

To assign work to an agent, say: **"Read docs/backlog.md and do item N"**

Follow the [AI Workflow](../guide/ai-workflow.md) (orient → design → plan → implement → validate → wrap up).
All items: remove when resolved

At the end: update design doc status → Implemented, update specs to match what was actually built, update `implementation-status.md`, then review and add any learnings to `docs/guide/ai-workflow.md`.

---

## 2 — Body-state review & readiness

At the end of the week, I want to review how my body feels and see if it matches what the system says it should feel, according to muscle group and MRV etc. Enhanced pre-workout readiness (sleep, energy, full-body soreness), end-of-week body review with mismatch detection, and cycle phase JIT integration.

- Design: [body-state-readiness.md](../design/body-state-readiness.md) (Draft)
- Specs:
  - [engine-028-readiness-adjuster.md](../specs/04-engine/engine-028-readiness-adjuster.md)
  - [engine-029-fatigue-predictor.md](../specs/04-engine/engine-029-fatigue-predictor.md)
  - [engine-030-cycle-phase-jit-adjuster.md](../specs/04-engine/engine-030-cycle-phase-jit-adjuster.md)
  - [mobile-035-enhanced-readiness-checkin.md](../specs/09-mobile/mobile-035-enhanced-readiness-checkin.md)
  - [mobile-036-weekly-body-review.md](../specs/09-mobile/mobile-036-weekly-body-review.md)
  - [data-007-weekly-body-reviews.md](../specs/05-data/data-007-weekly-body-reviews.md)
- Status: Design + specs complete. Ready to implement.

## 6

when i abandon an ad-hoc workout, i expect it to be gone from the home screen
