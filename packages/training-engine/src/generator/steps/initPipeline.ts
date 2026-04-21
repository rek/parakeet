import {
  getPrimaryMusclesForSession,
  getWorstSoreness,
} from '../../adjustments/soreness-adjuster';
import type { JITInput } from '../jit-session-generator';
import type { PrescriptionTraceBuilder } from '../prescription-trace';
import { calculateSets } from '../set-calculator';
import type { PipelineContext } from './pipeline-context';

export function initPipeline(
  input: JITInput,
  traceBuilder?: PrescriptionTraceBuilder
): PipelineContext {
  const {
    primaryLift,
    intensityType,
    blockNumber,
    oneRmKg,
    formulaConfig,
    sorenessRatings,
    sessionId,
  } = input;

  traceBuilder?.setSessionContext({
    sessionId,
    primaryLift,
    intensityType,
    blockNumber,
    oneRmKg,
  });

  const baseSets = calculateSets(
    primaryLift,
    intensityType,
    blockNumber,
    oneRmKg,
    formulaConfig
  );
  const baseWeight = baseSets[0]?.weight_kg ?? 0;

  if (traceBuilder && baseSets.length > 0) {
    const blockPct = baseWeight / oneRmKg;
    traceBuilder.setBaseWeight({
      oneRmKg,
      blockPct,
      baseWeightKg: baseWeight,
      storedOneRmKg: input.storedOneRmKg,
      workingOneRmKg: input.oneRmSource === 'working' ? oneRmKg : undefined,
      oneRmSource: input.oneRmSource,
    });

    if (intensityType !== 'deload') {
      const cycledBlock = (((blockNumber - 1) % 3) + 1) as 1 | 2 | 3;
      const blockCfg = formulaConfig[`block${cycledBlock}`];
      const ic = blockCfg[intensityType as 'heavy' | 'explosive' | 'rep'];
      traceBuilder.setBaseConfig({
        sets: baseSets.length,
        reps: baseSets[0].reps,
        repsMax: baseSets[0].reps_range?.[1],
        pct: ic.pct,
      });
    }
  }

  const primaryMuscles = getPrimaryMusclesForSession(primaryLift);
  const worstSoreness = getWorstSoreness(primaryMuscles, sorenessRatings);

  return {
    intensityMultiplier: 1.0,
    plannedCount: baseSets.length,
    baseSetsCount: baseSets.length,
    inRecoveryMode: false,
    skippedMainLift: false,
    rationale: [],
    warnings: [],
    baseSets,
    baseWeight,
    primaryMuscles,
    worstSoreness,
    readinessSetsRemoved: 0,
    cyclePhaseSetsRemoved: 0,
    sorenessSetsRemoved: 0,
    disruptionSetsRemoved: 0,
  };
}
