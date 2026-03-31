# Video Analysis: Future Directions

**Status:** Research
**Date:** 31 Mar 2026

arXiv literature review (2022–2026) + biomechanical metric catalog. Research opportunities organized by how they could improve Parakeet's video form analysis and gym partner filming systems.

## 0. Additional Metrics from Existing Landmarks

We already extract 33 MediaPipe landmarks per frame. Many high-value metrics can be computed from landmark relationships we don't currently use — pure math, zero new dependencies.

### Easy (pure math on existing landmarks, 5-30 lines each)

| Metric | Lift | View | Lines | Description |
|--------|------|------|-------|-------------|
| **Fatigue signatures** | All | Side | ~30 | Cross-rep trends: forward lean drift, bar drift increase, ROM compression, descent speed change, lockout degradation. Feeds coaching + JIT. |
| **Stance width** | All | Front | ~5 | `\|leftAnkle.x - rightAnkle.x\| × CM_PER_UNIT`. Coaching: too wide/narrow affects hip drive. |
| **Knee tracking over toes** | Squat | Front/Side | ~10 | `knee.x - ankle.x` per side at bottom. Mobility indicator. |
| **Hip shift / lateral lean** | Squat/DL | Front | ~10 | `leftHip.y - rightHip.y`. Strength imbalance indicator. |
| **Bar path symmetry (full rep)** | Bench | Front | ~10 | `\|leftWrist.y - rightWrist.y\|` across entire rep, not just lockout. |
| **Lockout stability** | All | Side | ~10 | Hip angle variance in last 10% of rep frames. Wobbly = weak lockout. |
| **Descent speed consistency** | Squat | Side | ~10 | CV of eccentric durations across reps. Fatigue = loss of eccentric control. |
| **Pause quality (sink detection)** | Bench | Side | ~15 | Differentiate "settled pause" (stable wrist Y) from "sinking" (Y still increasing). |

### Medium (new landmark relationships, 15-25 lines each)

| Metric | Lift | View | Lines | Description |
|--------|------|------|-------|-------------|
| **Butt wink (PPT)** | Squat | Side | ~20 | Hip angle rate-of-change at bottom. Sharp negative delta (>10° in <200ms) = posterior pelvic tilt. Most asked-about squat fault. |
| **Elbow flare angle** | Bench | Side/Front | ~15 | Shoulder-elbow vs shoulder-hip angle at bottom. Ideal: 45-75°. Most asked-about bench fault. |
| **Hip hinge timing** | Deadlift | Side | ~25 | Knee vs hip angular velocity ratio across the pull. Early frames knee-dominant, late hip-dominant. "Hips shooting up" = crossover too early. |
| **Knee cave timing** | Squat | Front | ~15 | Track valgus at 25/50/75% of concentric. Cave only during concentric = strength deficit vs mobility issue. |
| **Bar-to-shin distance** | Deadlift | Side | ~15 | Wrist avg X vs knee X during first third of pull. Bar drifting from shins increases moment arm. |
| **Touch point position** | Bench | Side | ~15 | Bottom bar Y relative to shoulder/hip. Positions touch point on torso (nipple line, sternum, etc). |
| **Arch height / stability** | Bench | Side | ~10 | Shoulder Y vs hip Y in bench position. Arch collapsing under fatigue is common failure. |

### Hard (needs model training or multi-view)

| Metric | Lift | Description |
|--------|------|-------------|
| Thoracic vs lumbar rounding | DL | No spine landmarks between shoulders/hips. Would need back contour segmentation model. |
| True 3D valgus angle | Squat | MediaPipe Z unreliable. Needs dual-phone 3D (see §1). |
| Muscle activation estimation | All | Needs sEMG or trained kinematic→activation model. |

### Implementation priority (next batch)

1. **Fatigue signatures** — aggregates metrics we already compute. Highest coaching value.
2. **Butt wink** — most requested squat fault. Pure hip angle rate-of-change.
3. **Elbow flare** — most requested bench fault. Shoulder-elbow angle.
4. **Hip hinge timing** — most important deadlift cue. Angular velocity ratio.
5. **Stance width** — trivial, useful context for all coaching.

Research sources:
- [Real-Time Biomechanical Posture Analysis (IJACSA 2025)](https://thesai.org/Downloads/Volume16No9/Paper_52)
- [ALEX-GYM-1 Dataset (2025)](https://www.scitepress.org/Papers/2025/136694/136694.pdf)
- [Exercise Quantification from Markerless 3D (Heliyon 2024)](https://www.sciencedirect.com/science/article/pii/S2405844024036272)
- [Automated Deadlift Assessment via Deep Learning (MDPI 2025)](https://www.mdpi.com/2673-2688/6/7/148)
- [Posterior Pelvic Tilt During Squat (MDPI 2025)](https://www.mdpi.com/2076-3417/15/23/12526)

## 1. Dual-Phone 3D Pose Reconstruction

**Opportunity**: Lifter + partner each hold a phone at different angles. Combine side + front views into true 3D pose — far more accurate than either 2D view alone. The gym partner feature creates a natural two-camera setup.

| Paper | Key idea | Applicability |
|---|---|---|
| **Two Views Are Better than One** (2311.12421) | Consistency loss between two synchronized camera views. **No camera calibration needed** — just synchronized phones. SOTA semi-supervised 3D pose. | Directly applicable. Two gym phones, no tripod, no calibration. |
| **SelfPose3d** (2404.02041, CVPR 2024) | Self-supervised multi-view 3D pose — needs only an off-the-shelf 2D detector + multi-view images. Zero ground truth required. | Could bootstrap 3D from MediaPipe 2D detections on both phones. |
| **Multi-view 3D HPE Survey** (2407.03817) | Comprehensive survey covering markerless methods, occlusion handling, random camera perspectives. | Reference for choosing the right fusion approach. |
| **AthletePose3D** (2503.07499) | Sports-specific 3D pose dataset. Fine-tuning reduces error from 214mm to 65mm (69%). Joint angles correlate strongly but velocity estimation is limited. | Fine-tuning target for powerlifting-specific 3D pose. |

**Bottom line**: 2311.12421 is the standout — two unsynchronized smartphones, no intrinsics, learns consistency. This is exactly the gym partner setup. Transforms partner filming from "convenience" into a capability unlock that single-phone users can't get.

## 2. Smarter Form Assessment

**Opportunity**: Move beyond fixed thresholds to learned representations that understand what "good form" looks like for each lifter.

| Paper | Key idea | Applicability |
|---|---|---|
| **Domain Knowledge-Informed Self-Supervised Reps** (2202.14019) | Pose contrastive learning + motion disentangling for exercise form. Trained on BackSquat, BarbellRow, OverheadPress. Beats off-the-shelf pose estimators for subtle form errors. | Same lifts, same problem. Could replace or augment current fixed-threshold fault detection. |
| **FLEX Dataset** (2506.03198) | 7,500+ multiview recordings of 20 weight-loaded exercises with synchronized RGB, 3D pose, sEMG, and physiology. Expert annotations in a Fitness Knowledge Graph. | Training data goldmine for fine-tuning on loaded barbell movements. |
| **Explainable Action Form Assessment (EFA)** (2512.15153) | Chain-of-Thought form assessment — quality scores WITH natural language reasoning from action identification to correction proposals. | Could enhance LLM coaching prompt with structured CoT reasoning. |
| **AI Kinematic Profiling for Resistance Training** (2510.20012) | Compares 5 deep-learning pose models on 303 recordings of 8 upper-body exercises. Per-rep ROM and duration metrics. | Benchmarking reference for comparing our MediaPipe pipeline. |
| **Learnable Physics for Exercise Form** (2310.07221, ACM RecSys '23) | MediaPipe + learnable physics simulator. Detects deviations from prototypical learned motion. Peak-prominence for rep counting. | Same tech stack. Physics simulator could improve bar path analysis. |

**Bottom line**: 2202.14019 (self-supervised form reps) and 2512.15153 (CoT form assessment) are the most actionable. The first improves detection, the second improves explanation.

## 3. VLM-Based Coaching (Next-Gen)

**Opportunity**: Send video frames directly to a vision-language model instead of extracting metrics first. The model sees what happened and explains it.

| Paper | Key idea | Applicability |
|---|---|---|
| **FormCoach** (2508.07501) | VLM-based interactive form coach. 1,700 expert-annotated video pairs across 22 exercises. Automated rubric-based evaluation pipeline. | Could replace current 2-phase pipeline (CV metrics -> LLM coaching) with direct VLM analysis. Benchmark dataset for validation. |
| **What to Say and When (QEVD)** (2407.08101) | Benchmark for real-time situated coaching via VLMs. Reveals current VLM limitations for this task. | Reality check + evaluation framework for coaching quality. |

**Bottom line**: As VLMs improve, sending video frames directly to gpt-5-vision could replace the entire MediaPipe -> metrics -> LLM prompt pipeline with a single model call. FormCoach's 1,700-pair dataset could validate our current coaching output quality.

## 4. Rep-to-Rep Fatigue Detection & Bar Velocity

**Opportunity**: Detect form degradation within a set (rep 1 vs rep 5) and across sets. Estimate bar velocity from video to derive velocity loss % and estimated RiR — cross-validating self-reported RPE with an objective second signal.

| Paper | Key idea | Applicability |
|---|---|---|
| **Edge-Deployed RiR Estimation** (2512.11854) | Real-time Reps-in-Reserve estimation from wrist IMU. ResNet rep segmentation (F1=0.83) + LSTM near-failure classification (F1=0.82). Runs at 23.5ms on iPhone 16. | RiR from video bar velocity is the equivalent approach without hardware. Cross-validates self-reported RPE. |
| **CV Fatigue Monitoring** (Albert & Arnrich, Biomed. Signal Process. 2024) | Pose estimation from 2 cameras → skeleton features → ML models predict generated power AND RPE. External load (power) + internal load (RPE) quantified simultaneously from video alone. | Directly applicable: our MediaPipe landmarks are the same input. Their power estimation approach = our bar velocity estimation. The RPE prediction model could cross-validate lifter self-reports. |
| **Smartphone Barbell Velocity Validation** (PLOS ONE 2024, 10.1371/journal.pone.0313919) | Validated 3 smartphone apps (Metric VBT, Qwik VBT, MyLift) against linear transducer for mean concentric velocity (MCV) in squat/bench/deadlift. Apps are valid and reliable. | Proves that smartphone video CAN estimate bar velocity accurately. Our wrist landmark tracking gives us the same signal — we can compute MCV from wrist Y displacement / time between frames. |
| **Velocity Loss for Fatigue** (Sanchez-Medina 2024, pubmed/38684188) | Back squat at 40%/80% 1RM: mean propulsive velocity (MPV) provides optimal sensitivity to monitor fatigue. Velocity loss % predicts proximity to failure. | The velocity-loss-to-RiR mapping is well-established in VBT research. We compute bar velocity → track velocity loss across reps → estimate RiR. Known mappings: ~20% velocity loss ≈ 2-3 RiR, ~30% ≈ 1 RiR, ~40% ≈ failure. |
| **PoseRAC Rep Counting** (2308.08632) | Joint angles + pose landmarks for rep counting. MAE 0.211. Handles viewpoint changes and sub-actions. | Could improve peak-prominence rep detection for partial/paused reps. |
| **BiLSTM Exercise Classification** (2411.11548) | BlazePose landmarks + invariant features (joint angles) + 30-frame temporal context. >99% accuracy. | Invariant feature approach (angles not coordinates) improves robustness across camera distances. |

### Implementation strategy for bar velocity → RiR

We already have per-rep bar path data (`barPath[].y` over frames). Computing velocity is straightforward:

```
For each rep:
  1. Find concentric phase: bottom frame → lockout frame (Y decreasing in MediaPipe coords)
  2. Compute mean concentric velocity: Δy / Δframes × fps × CM_PER_UNIT → cm/s
  3. Track velocity across reps: [v1, v2, v3, v4, v5]
  4. Velocity loss % = (v1 - vN) / v1 × 100
  5. Estimate RiR from velocity loss using established VBT mappings
```

This would be a new strategy slot: `RepGrader` → add `estimatedRir` field to rep analysis. The JIT pipeline could use it as a secondary RPE signal.

**Bottom line**: Bar velocity from video is a solved problem (validated against hardware). Computing it from our existing wrist landmark data requires ~20 lines of pure math. The velocity-loss-to-RiR mapping is well-established in sports science. This gives the JIT pipeline an objective fatigue signal that doesn't rely on self-reported RPE.

## 5. Competition Judging Improvements

**Opportunity**: Our `gradeRep()` uses fixed IPF thresholds. Research suggests more nuanced approaches.

| Paper | Key idea | Applicability |
|---|---|---|
| **Barbell Squat Coaching System** (2503.23731) | 4 key characteristics: joint angles, dorsiflexion, knee-to-hip ratio, barbell stability. SHAP for feature importance. Validated by professional coach. | SHAP analysis tells us which features matter most. Their 4-feature approach could supplement current fault detection. |
| **Diminishing Returns Scoring** (2503.13040) | Logistic scoring system for powerlifting replacing IPF GL. Shows increasing returns below certain bodyweight thresholds. | Could improve `computeWilks` with a more accurate scoring function. |

## 6. Improved Rep Detection & Form Quality Assessment

**Opportunity**: Replace hand-tuned peak detection with learned models. Move from fixed thresholds to data-driven quality scoring that accounts for individual variation.

| Paper | Key idea | Applicability |
|---|---|---|
| **PoseRAC v2 (Joint-Based)** (2308.08632v2, 2024) | Integrates joint angles with body pose landmarks. MAE 0.211, OBO 0.599 on RepCount dataset. Handles viewpoint changes, over-counting, under-counting. 10x faster inference than TransRAC. Only needs 20 min training on GPU. | **Direct replacement for our `detectReps`** peak-prominence approach. Joint angles are viewpoint-invariant — solves our 45-degree camera angle problem where hip Y signal is compressed. Could be a `v2_poserac` strategy slot. |
| **TransRAC** (2204.01018, CVPR 2022) | Multi-scale temporal correlation with Transformers for repetitive action counting. Foundational work that PoseRAC builds on. | Baseline reference for understanding the temporal encoding approach. |
| **HP-MCoRe Action Quality Assessment** (2501.03674, Jan 2025) | Hierarchical pose decomposition: torso → inner limbs → outer limbs. Procedure segmentation network separates sub-actions. Multi-stage contrastive regression. SOTA on FineDiving. Code: github.com/Lumos0507/HP-MCoRe | **Our `gradeRep` replacement.** The 3-level pose decomposition maps perfectly to powerlifting: L1=torso (lean/rotation), L2=thighs/upper arms (depth/lockout), L3=shins/forearms (knee tracking/wrist path). Could train on our captured video data. |
| **AQA Survey** (2502.02817, Feb 2025) | Comprehensive decade survey of action quality assessment methods. Covers skeleton-based, video-based, multi-modal. Taxonomy of approaches. | Decision guide for choosing the right AQA architecture for powerlifting. |
| **Fitness Action Counting** (ACM AIPR 2024) | Pose estimation + deep learning for exercise counting on smartphones. Practical implementation focus. | Reference for mobile-deployable rep counting. |
| **PosePilot** (2505.19186) | Edge-deployable: LSTM + BiLSTM with multi-head attention for error detection. Resource-constrained devices. | Architecture reference for on-device form assessment beyond threshold checks. |
| **LiFT** (2506.06480) | Lightweight Fitness Transformer. 1,900+ exercises, 433MB RAM. 85.3% rep counting accuracy from smartphone video. | Could replace peak-prominence for harder-to-count exercises. |
| **M-Health Real-Time Exercise Assessment** (2512.10437) | Levenshtein distance for sequence matching in exercise assessment. | Rep-to-rep form consistency scoring — each rep compared to a "template" rep. |
| **AI Kinematic Profiling** (2510.20012, Oct 2025) | 5 pose models compared on 280+ resistance training recordings. Per-rep ROM, tempo, concentric/eccentric phase durations extracted. | Validates our approach of extracting per-rep kinematics. Their tempo metric (concentric + eccentric phase timing) is something we don't compute yet — easy to add from existing landmark data. |

### Strategy implementation plan

**v2_poserac (rep detection):**
- Input: joint angles computed from our existing PoseFrame landmarks (not raw coordinates)
- Viewpoint-invariant: angles don't change with camera distance or position
- Train on our captured frame data (we now have real signal data from device testing)
- 20 min training on GPU → export to ONNX → run on-device or as edge function
- Slot: `RepDetector` in `analysis-strategy.ts`

**v2_hpmcore (quality assessment):**
- Input: same PoseFrame landmarks, decomposed into 3 hierarchical levels
- Contrastive regression: learns what "good form" looks like from examples
- Could train on the lifter's own historical videos (personalized baseline)
- Slot: `RepGrader` in `analysis-strategy.ts`

**v2_tempo (new metric):**
- Extract concentric/eccentric phase durations per rep from bar path Y signal
- Tempo ratio (ecc:con) is a fatigue indicator — fatigued reps have longer concentrics
- Pure math on existing data — no new model needed, ~15 lines of code
- Slot: new field in `RepAnalysis` in shared-types

## Priority Ranking (Updated)

Reranked after real device testing exposed the limitations of our current pipeline (OOM, 4fps, lite model, peak-prominence rep detection). Items marked with ★ are low-effort wins using existing data.

| Priority | Improvement | Key paper(s) | Effort | Impact | Strategy slot |
|---|---|---|---|---|---|
| **★1** | Bar velocity → RiR estimation | Albert 2024, VBT research | **Very low** — pure math on existing bar path data | **High** — objective fatigue signal for JIT pipeline | `RepAnalysis.estimatedRir` |
| **★2** | Tempo extraction (ecc/con phases) | 2510.20012 | **Very low** — ~15 lines on bar path Y | **Medium** — fatigue indicator, coaching context | `RepAnalysis.tempoRatio` |
| **3** | Joint-angle rep detection (PoseRAC) | 2308.08632v2 | Low–Medium (train small model) | **High** — viewpoint-invariant, solves 45° angle problem | `RepDetector` |
| **4** | Dual-phone 3D reconstruction | 2311.12421 | High | High — partner filming capability unlock | New pipeline |
| **5** | Hierarchical quality assessment | 2501.03674 | Medium (train on our data) | Medium — learned "good form" per lifter | `RepGrader` |
| **6** | VLM direct coaching | 2508.07501 | Medium | High — simpler pipeline, richer feedback | Replaces full pipeline |
| **7** | Learned form representations | 2202.14019 | Medium | Medium — personalized baselines | `FaultDetector` |
| **8** | CoT explainable assessment | 2512.15153 | Low | Medium — better coaching explanations | LLM prompt enhancement |

**Next steps**: Implement ★1 and ★2 immediately — they're pure math on existing data with zero new dependencies. Then evaluate PoseRAC (#3) as a `v2_poserac` strategy using captured frame data for training.

## References

All papers at `https://arxiv.org/abs/{id}`:
2202.14019, 2204.01018, 2308.08632, 2310.07221, 2311.12421, 2312.11340, 2404.02041, 2406.06703, 2406.15649, 2407.03817, 2407.08101, 2408.12796, 2411.06725, 2411.11548, 2501.02771, 2501.03674, 2502.02817, 2502.13760, 2503.07499, 2503.13040, 2503.22363, 2503.23731, 2504.08175, 2505.19186, 2506.03198, 2506.06480, 2506.11774, 2508.07501, 2509.02511, 2510.20012, 2512.06783, 2512.10437, 2512.11854, 2512.15153

Additional non-arXiv references:
- Albert & Arnrich (2024), "A computer vision approach to continuously monitor fatigue during resistance training", Biomed. Signal Process. Control, Vol. 89
- PLOS ONE (2024), "Concurrent validity of novel smartphone-based apps monitoring barbell velocity in powerlifting exercises", 10.1371/journal.pone.0313919
- Sanchez-Medina et al. (2024), "Monitoring Bar Velocity to Quantify Fatigue in Resistance Training", pubmed/38684188
