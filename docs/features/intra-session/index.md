---
feature: intra-session
status: implemented
modules: [session]
---
# Intra-Session Autoregulation

RPE scaling and weight autoregulation during a live session.

## Design
- [design.md](./design.md) — Intra-session autoregulation design

## Specs
| Spec | Status | Concern |
|------|--------|---------|
| [spec-rpe-scaler.md](./spec-rpe-scaler.md) | done | RPE-based set scaling |
| [spec-weight-autoregulation.md](./spec-weight-autoregulation.md) | done | Weight autoregulation logic |
| [spec-weight-display-refresh.md](./spec-weight-display-refresh.md) | done | Bug: accepted weight bump not reflected in display |
