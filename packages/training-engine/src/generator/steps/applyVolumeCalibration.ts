import type { PrescriptionTraceBuilder } from '../prescription-trace';
import type { JITInput } from '../jit-session-generator';
import type { PipelineContext } from './pipeline-context';

/**
 * Step 0: Adaptive volume calibration.
 *
 * Adjusts ctx.plannedCount up or down (-2 to +3) based on accumulated
 * evidence: RPE trends, soreness state, readiness signals, post-session
 * capacity assessment, weekly mismatch direction, modifier calibration
 * learning, and progressive volume within the training block.
 *
 * This is the only pipeline step that can INCREASE volume.
 * All subsequent steps (2-7) can only reduce or leave unchanged.
 */
export function applyVolumeCalibration(
  ctx: PipelineContext,
  input: JITInput,
  traceBuilder?: PrescriptionTraceBuilder
) {
  // Skip calibration if already in recovery mode or main lift skipped
  if (ctx.inRecoveryMode || ctx.skippedMainLift) return;

  let modifier = 0;
  const reasons: string[] = [];

  // --- Signal 1: RPE trend from recent sessions ---
  const rpeLogs = input.recentLogs.filter(
    (l) => l.actual_rpe != null && l.target_rpe != null
  );
  let avgRpeGap = 0;
  if (rpeLogs.length >= 2) {
    const totalGap = rpeLogs.reduce(
      (sum, l) => sum + (l.target_rpe - (l.actual_rpe ?? l.target_rpe)),
      0
    );
    avgRpeGap = totalGap / rpeLogs.length;
  }

  // --- Signal 2: Readiness (sleep + energy) ---
  const sleep = input.sleepQuality ?? 3;
  const energy = input.energyLevel ?? 3;
  const readinessHigh = sleep >= 4 && energy >= 4;
  const readinessLow = sleep <= 2 || energy <= 2;

  // --- Signal 3: Soreness (worst across primary muscles) ---
  const sorenessLow = ctx.worstSoreness <= 4; // 1-4 on 10-scale = fresh/mild
  const sorenessHigh = ctx.worstSoreness >= 7; // 7+ on 10-scale = high/severe

  // --- Signal 4: Capacity history (post-session assessments) ---
  const capacityHistory = input.capacityHistory ?? [];
  const avgCapacity =
    capacityHistory.length >= 2
      ? capacityHistory.reduce((sum, v) => sum + v, 0) / capacityHistory.length
      : 0;

  // --- Signal 5: Weekly mismatch direction ---
  const recoveringWell = input.weeklyMismatchDirection === 'recovering_well';

  // --- Signal 6: Modifier calibration learning (Phase 3) ---
  // If the system has learned that its modifiers are too aggressive for this
  // athlete (negative RPE bias = too easy after reductions), compensate by
  // adding volume. Sum of calibration adjustments acts as a bias correction.
  let calibrationBoost = 0;
  if (input.modifierCalibrations) {
    const cals = input.modifierCalibrations;
    // Positive adjustment = modifier was too aggressive (made it too easy)
    // → lifter can handle more volume
    const totalAdjustment = Object.values(cals).reduce(
      (sum, v) => sum + (v ?? 0),
      0
    );
    // Each +0.05 adjustment roughly corresponds to +1 set capacity
    if (totalAdjustment >= 0.08) {
      calibrationBoost = 1;
      reasons.push(`Modifier calibration: system over-reduced for this athlete — +1 set`);
    }
  }

  // --- Signal 7: Progressive volume within block ---
  // If we're in week 2-3 of a block and RPE has been consistently low,
  // progressively increase. Deload weeks (blockNumber cycling) reset.
  let progressiveBoost = 0;
  const weekInBlock = input.weekNumber > 0 ? ((input.weekNumber - 1) % 3) + 1 : 1;
  const isDeload = input.intensityType === 'deload';

  if (!isDeload && weekInBlock >= 2 && avgRpeGap >= 0.5 && !sorenessHigh) {
    progressiveBoost = weekInBlock >= 3 ? 2 : 1;
    reasons.push(`Week ${weekInBlock} of block, RPE trend favorable — +${progressiveBoost} progressive`);
  }

  // --- Compute total modifier ---

  // Strong positive signal: RPE consistently easy + body is fresh + readiness high
  if (avgRpeGap >= 1.5 && sorenessLow && readinessHigh) {
    modifier += 2;
    reasons.push(`RPE ${avgRpeGap.toFixed(1)} below target, fresh and ready — +2 sets`);
  }
  // Moderate positive: RPE easy, no negative signals
  else if (avgRpeGap >= 1.0 && !sorenessHigh && !readinessLow) {
    modifier += 1;
    reasons.push(`RPE ${avgRpeGap.toFixed(1)} below target — +1 set`);
  }

  // Capacity trend: lifter consistently reports having more in them
  if (avgCapacity >= 3.0) {
    modifier += 1;
    reasons.push(`Capacity assessment avg ${avgCapacity.toFixed(1)} (had more in me) — +1 set`);
  }

  // Weekly mismatch: recovering faster than predicted
  if (recoveringWell) {
    modifier += 1;
    reasons.push('Weekly review: recovering well — +1 set');
  }

  // Add calibration and progressive boosts
  modifier += calibrationBoost;
  modifier += progressiveBoost;

  // Negative signal: RPE consistently above target
  if (avgRpeGap <= -1.0) {
    modifier -= 1;
    reasons.push(`RPE ${Math.abs(avgRpeGap).toFixed(1)} above target — -1 set`);
  }

  // Clamp to [-2, +3]
  modifier = Math.max(-2, Math.min(3, modifier));

  // Don't go below 1 set
  const newCount = Math.max(1, ctx.plannedCount + modifier);

  // MRV guard: don't calibrate above remaining MRV capacity for primary muscles
  if (modifier > 0 && input.mrvMevConfig && input.weeklyVolumeToDate) {
    for (const muscle of ctx.primaryMuscles) {
      const remaining =
        (input.mrvMevConfig[muscle]?.mrv ?? 30) -
        (input.weeklyVolumeToDate[muscle] ?? 0);
      if (newCount > remaining && remaining > 0) {
        const capped = Math.max(ctx.plannedCount, remaining);
        if (capped < newCount) {
          modifier = capped - ctx.plannedCount;
          reasons.push(`MRV cap: ${muscle} — clamped to ${capped} sets`);
        }
      }
    }
  }

  if (modifier === 0) return;

  const finalCount = Math.max(1, ctx.plannedCount + modifier);
  ctx.plannedCount = finalCount;

  // If we increased sets, extend baseSets by duplicating the last planned set
  if (modifier > 0 && ctx.baseSets.length < finalCount) {
    const template = ctx.baseSets[ctx.baseSets.length - 1];
    while (ctx.baseSets.length < finalCount) {
      ctx.baseSets.push({
        ...template,
        set_number: ctx.baseSets.length + 1,
      });
    }
  }

  // If we decreased sets, truncate baseSets
  if (modifier < 0 && ctx.baseSets.length > finalCount) {
    ctx.baseSets = ctx.baseSets.slice(0, finalCount);
  }

  const direction = modifier > 0 ? 'increase' : 'decrease';
  ctx.rationale.push(
    `Volume calibration: ${direction} by ${Math.abs(modifier)} set(s)`
  );

  traceBuilder?.recordVolumeChange({
    source: 'volume_calibration',
    setsBefore: ctx.baseSetsCount,
    setsAfter: finalCount,
    reason: reasons.join('; '),
  });
}
