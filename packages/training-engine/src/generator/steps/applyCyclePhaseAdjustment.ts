import { getCyclePhaseModifier } from '../../adjustments/cycle-phase-adjuster';
import { applyCalibrationAdjustment } from '../../analysis/modifier-effectiveness';
import type { JITInput } from '../jit-session-generator';
import type { PrescriptionTraceBuilder } from '../prescription-trace';
import type { PipelineContext } from './pipeline-context';

export function applyCyclePhaseAdjustment(
  ctx: PipelineContext,
  input: JITInput,
  traceBuilder?: PrescriptionTraceBuilder
) {
  if (input.intensityType === 'deload') return;
  const preCount = ctx.plannedCount;
  const cyclePhaseModifier = getCyclePhaseModifier(input.cyclePhase);

  // Record DEFAULT multiplier in trace BEFORE calibration (feedback loop correctness)
  if (cyclePhaseModifier.intensityMultiplier !== 1.0) {
    traceBuilder?.recordModifier({
      source: 'cycle_phase',
      multiplier: cyclePhaseModifier.intensityMultiplier,
      reason: cyclePhaseModifier.rationale ?? 'Cycle phase adjustment',
    });
  }

  // Apply per-athlete calibration to cycle phase modifier
  if (
    cyclePhaseModifier.intensityMultiplier !== 1.0 &&
    input.modifierCalibrations?.cycle_phase
  ) {
    cyclePhaseModifier.intensityMultiplier = applyCalibrationAdjustment({
      defaultMultiplier: cyclePhaseModifier.intensityMultiplier,
      adjustment: input.modifierCalibrations.cycle_phase,
    });
  }

  if (
    cyclePhaseModifier.volumeModifier !== 0 ||
    cyclePhaseModifier.intensityMultiplier !== 1.0
  ) {
    ctx.plannedCount = Math.max(
      1,
      ctx.plannedCount + cyclePhaseModifier.volumeModifier
    );
    ctx.intensityMultiplier *= cyclePhaseModifier.intensityMultiplier;
    if (cyclePhaseModifier.rationale)
      ctx.rationale.push(cyclePhaseModifier.rationale);
  }

  ctx.cyclePhaseSetsRemoved = preCount - ctx.plannedCount;
  if (ctx.cyclePhaseSetsRemoved > 0) {
    traceBuilder?.recordVolumeChange({
      source: 'cycle_phase',
      setsBefore: preCount,
      setsAfter: ctx.plannedCount,
      reason: cyclePhaseModifier.rationale ?? 'Cycle phase set reduction',
    });
  }
}
