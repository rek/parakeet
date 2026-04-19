---
feature: video-analysis
status: done
modules: [video-analysis]
---
# Video Analysis

AI-powered form analysis with set-level video linking and calibration.

## Design
- [design-form-analysis.md](./design-form-analysis.md) — Form analysis pipeline design
- [design-set-linking.md](./design-set-linking.md) — Set-level video linking design
- [design-future.md](./design-future.md) — Future video feature roadmap
- [design-local-only-storage.md](./design-local-only-storage.md) — Drop raw-video uploads; cloud keeps only analysis results (Phase 0 shipped; later phases pending)
- [design-playback-overlay.md](./design-playback-overlay.md) — Bar path + skeleton overlays during playback (Phase 1 shipped, Phase 2 skeleton in progress)

## Specs
| Spec | Status | Concern |
|------|--------|---------|
| [spec-pipeline.md](./spec-pipeline.md) | done | End-to-end pipeline (mobile + dashboard extractors, adjacent concepts) |
| [spec-reanalyze.md](./spec-reanalyze.md) | done | Re-run analysis against existing local `.mp4` (backlog #20) |
| [spec-set-linking.md](./spec-set-linking.md) | done | Linking videos to sets |
| [spec-metrics.md](./spec-metrics.md) | done | Form metrics extraction |
| [spec-calibration.md](./spec-calibration.md) | done | Camera calibration |
| [spec-post-rest-recording.md](./spec-post-rest-recording.md) | done | Auto-record after rest (mobile-051) |
| [spec-view-angle.md](./spec-view-angle.md) | done | View angle rework (mobile-052) |
| [spec-ai-proxy.md](./spec-ai-proxy.md) | done | OpenAI Edge Function proxy (GH#161) |
| [spec-playback-overlay.md](./spec-playback-overlay.md) | partial | Phase 1 bar path shipped; Phase 2 skeleton pending |
