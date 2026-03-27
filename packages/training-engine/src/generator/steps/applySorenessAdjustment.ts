import { getSorenessModifier } from '../../adjustments/soreness-adjuster';
import { applyCalibrationAdjustment } from '../../analysis/modifier-effectiveness';
import type { JITInput } from '../jit-session-generator';
import type { PrescriptionTraceBuilder } from '../prescription-trace';
import type { PipelineContext } from './pipeline-context';

export function applySorenessAdjustment(
  ctx: PipelineContext,
  input: JITInput,
  traceBuilder?: PrescriptionTraceBuilder
) {
  const preCount = ctx.plannedCount;
  const sorenessModifier = getSorenessModifier(
    ctx.worstSoreness,
    input.biologicalSex
  );

  // Record DEFAULT multiplier in trace BEFORE calibration (feedback loop correctness)
  if (
    !sorenessModifier.recoveryMode &&
    sorenessModifier.intensityMultiplier !== 1.0
  ) {
    traceBuilder?.recordModifier({
      source: 'soreness',
      multiplier: sorenessModifier.intensityMultiplier,
      reason: sorenessModifier.warning ?? 'Soreness intensity adjustment',
    });
  }

  // Apply per-athlete calibration to soreness modifier (skip for recovery mode — soreness 9-10)
  if (
    !sorenessModifier.recoveryMode &&
    sorenessModifier.intensityMultiplier !== 1.0 &&
    input.modifierCalibrations?.soreness
  ) {
    sorenessModifier.intensityMultiplier = applyCalibrationAdjustment({
      defaultMultiplier: sorenessModifier.intensityMultiplier,
      adjustment: input.modifierCalibrations.soreness,
    });
  }

  if (sorenessModifier.recoveryMode) {
    ctx.inRecoveryMode = true;
    ctx.rationale.push('Severe soreness — recovery session');
    traceBuilder?.setRecoveryMode(true);
  } else {
    ctx.plannedCount = Math.max(
      1,
      ctx.plannedCount - sorenessModifier.setReduction
    );
    ctx.intensityMultiplier *= sorenessModifier.intensityMultiplier;
    if (sorenessModifier.warning) ctx.rationale.push(sorenessModifier.warning);
  }

  ctx.sorenessSetsRemoved = ctx.inRecoveryMode
    ? 0
    : preCount - ctx.plannedCount;
  if (ctx.sorenessSetsRemoved > 0) {
    traceBuilder?.recordVolumeChange({
      source: 'soreness',
      setsBefore: preCount,
      setsAfter: ctx.plannedCount,
      reason: sorenessModifier.warning ?? 'Soreness set reduction',
    });
  }
}
