---
feature: rehab-mode
status: implemented
modules: [rehab-mode]
---

# Rehab Mode

Per-lift long-term capacity cap for lifters training through injury or pain. Pauses adaptive engine behaviour (auto-progression, PR detection, working-1RM updates, volume top-up) and tags pain-limited RPE inputs so they don't pollute calibration.

Origin: [GH#220](https://github.com/rek/parakeet/issues/220) — user rehabbing knee for a full 10-week cycle. RPE inputs are ambiguous (muscular RPE low, pain-limited RPE high) and either honest answer breaks adaptive logic.

## Design

- [design.md](./design.md) — Rehab Mode design

## Specs

| Spec                               | Status | Concern                                                                                                                        |
| ---------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------ |
| [spec-data.md](./spec-data.md)     | done   | `rehab_caps` table, set-log flags, types                                                                                       |
| [spec-engine.md](./spec-engine.md) | done   | JIT cap enforcement (formula + LLM + hybrid), suppression of adaptive steps, downstream filters                                |
| [spec-app.md](./spec-app.md)       | done   | `@modules/rehab-mode` service + queries + hooks; JIT input wiring; server-side set-log stamp via DB trigger; PR-detection gate |
| [spec-ui.md](./spec-ui.md)         | done   | Settings management, Today chip + bottom sheet, RPE pain-limited toggle                                                        |
