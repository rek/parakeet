import { getReadinessModifier } from '../../adjustments/readiness-adjuster';
import { applyCalibrationAdjustment } from '../../analysis/modifier-effectiveness';
import type { JITInput } from '../jit-session-generator';
import type { PrescriptionTraceBuilder } from '../prescription-trace';
import type { PipelineContext } from './pipeline-context';

export function applyReadinessAdjustment(
  ctx: PipelineContext,
  input: JITInput,
  traceBuilder?: PrescriptionTraceBuilder
) {
  const preCount = ctx.plannedCount;
  const readinessModifier = getReadinessModifier(
    input.sleepQuality,
    input.energyLevel
  );

  // Record DEFAULT multiplier in trace BEFORE calibration (feedback loop correctness)
  if (readinessModifier.intensityMultiplier !== 1.0) {
    traceBuilder?.recordModifier({
      source: 'readiness',
      multiplier: readinessModifier.intensityMultiplier,
      reason: readinessModifier.rationale ?? 'Readiness adjustment',
    });
  }

  // Apply per-athlete calibration to readiness modifier
  if (
    readinessModifier.intensityMultiplier !== 1.0 &&
    input.modifierCalibrations?.readiness
  ) {
    readinessModifier.intensityMultiplier = applyCalibrationAdjustment({
      defaultMultiplier: readinessModifier.intensityMultiplier,
      adjustment: input.modifierCalibrations.readiness,
    });
  }

  if (
    readinessModifier.setReduction > 0 ||
    readinessModifier.intensityMultiplier !== 1.0
  ) {
    ctx.plannedCount = Math.max(
      1,
      ctx.plannedCount - readinessModifier.setReduction
    );
    ctx.intensityMultiplier *= readinessModifier.intensityMultiplier;
    if (readinessModifier.rationale)
      ctx.rationale.push(readinessModifier.rationale);
  }

  ctx.readinessSetsRemoved = preCount - ctx.plannedCount;
  if (ctx.readinessSetsRemoved > 0) {
    traceBuilder?.recordVolumeChange({
      source: 'readiness',
      setsBefore: preCount,
      setsAfter: ctx.plannedCount,
      reason: readinessModifier.rationale ?? 'Readiness set reduction',
    });
  }
}
