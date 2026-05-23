import { JITAdjustmentSchema } from '@parakeet/shared-types';
import type { JITAdjustment } from '@parakeet/shared-types';
import { generateText, Output } from 'ai';

import { abortAfter } from '../ai/abort-timeout';
import { reportEngineError } from '../ai/error-reporter';
import { getJITModel } from '../ai/models';
import { JIT_SYSTEM_PROMPT } from '../ai/prompts';
import { computeAuxWeight } from '../auxiliary/exercise-catalog';
import {
  getPrimaryMusclesForSession,
  getWorstSoreness,
} from '../adjustments/soreness-adjuster';
import { createExerciseTyper } from '../auxiliary/exercise-types';
import {
  effectiveIncrementKg,
  roundToNearest,
} from '../formulas/weight-rounding';
import { createMuscleMapper } from '../volume/muscle-mapper';
import { FormulaJITGenerator } from './formula-jit-generator';
import { enforceHardConstraints } from './jit-constraints';
import {
  buildVolumeTopUp,
  MAX_AUX_EXERCISES,
} from './jit-session-generator';
import type {
  AuxiliaryWork,
  JITInput,
  JITOutput,
} from './jit-session-generator';
import type { JITGeneratorStrategy } from './jit-strategy';
import { calculateSets } from './set-calculator';
import {
  generateWarmupSets,
  resolveEffectiveWarmupProtocol,
} from './warmup-calculator';

// helper: derive formula-based rest for LLM path (engine-021 will override later)
function formulaRestForMain(input: JITInput): number {
  const { formulaConfig, blockNumber, intensityType } = input;
  if (intensityType === 'deload') return formulaConfig.rest_seconds.deload;
  const cycledBlock = ((blockNumber - 1) % 3) + 1;
  const blockKey = `block${cycledBlock}` as 'block1' | 'block2' | 'block3';
  return formulaConfig.rest_seconds[blockKey][
    intensityType as 'heavy' | 'explosive' | 'rep'
  ];
}

export class LLMJITGenerator implements JITGeneratorStrategy {
  readonly name = 'llm' as const;
  readonly description = 'LLM-based holistic generator — requires network';

  async generate(input: JITInput): Promise<JITOutput> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const { output: adj } = await generateText({
          model: getJITModel(),
          output: Output.object({ schema: JITAdjustmentSchema }),
          system: JIT_SYSTEM_PROMPT,
          prompt: JSON.stringify(buildJITContext(input)),
          abortSignal: abortAfter(12000),
        });
        const output = applyAdjustment(adj, input);
        return { ...enforceHardConstraints(output, input), jit_strategy: 'llm' };
      } catch (err) {
        lastError = err;
        reportEngineError(err, {
          source: 'LLMJITGenerator',
          attempt,
          sessionId: input.sessionId,
        });
      }
    }
    reportEngineError(lastError, {
      source: 'LLMJITGenerator',
      phase: 'fallback',
      sessionId: input.sessionId,
    });
    const fallback = await new FormulaJITGenerator().generate(input);
    return { ...fallback, jit_strategy: 'formula_fallback' };
  }
}

function buildJITContext(input: JITInput): object {
  // Omit warmupConfig — always formula-generated; LLM cannot override warmup.
  // userAge is included via `...rest`; the JIT_SYSTEM_PROMPT now references
  // it as a recovery-rate signal (finding #9). Engine consumer remains dead
  // — we are not adding hard-coded age thresholds.
  const { warmupConfig: _warmup, ...rest } = input;

  // Drop rehab-tagged history (GH#220) — pain-ambiguous RPE from capped work
  // would lead the LLM into the same mistake as the formula path would have
  // made without the Step 0/2 early-returns: either lowering weight in
  // response to high "pain RPE" or raising it in response to low "muscle RPE".
  // The LLM has the cap (`activeRehabCap`) and the rationale it generates can
  // mention it, but the polluted history must not be in front of it.
  const cleanRecentLogs = input.recentLogs.filter((l) => !l.containedRehabSets);

  // Provide rest context so the LLM can make an informed rest adjustment
  const formulaRestSeconds = formulaRestForMain(input);
  const lastSetRpe =
    cleanRecentLogs.length > 0
      ? cleanRecentLogs[cleanRecentLogs.length - 1].actual_rpe
      : null;

  return {
    ...rest,
    recentLogs: cleanRecentLogs,
    formulaRestSeconds,
    ...(lastSetRpe !== null ? { lastSetRpe } : {}),
  };
}

export function applyAdjustment(
  adj: JITAdjustment,
  input: JITInput
): JITOutput {
  const increment = effectiveIncrementKg(input);
  const baseSets = calculateSets(
    input.primaryLift,
    input.intensityType,
    input.blockNumber,
    input.oneRmKg,
    input.formulaConfig,
    input.weightIncrementKg
  );
  const baseWeight = baseSets[0]?.weight_kg ?? 0;

  let mainLiftSets = baseSets;
  let skippedMainLift = adj.skipMainLift;

  if (!skippedMainLift) {
    const targetCount = Math.max(0, baseSets.length + adj.setModifier);
    const finalWeight = roundToNearest(
      baseWeight * adj.intensityModifier,
      increment
    );
    mainLiftSets = baseSets.slice(0, targetCount).map((s, i) => ({
      ...s,
      set_number: i + 1,
      weight_kg: finalWeight,
    }));
    if (mainLiftSets.length === 0) {
      skippedMainLift = true;
    }
  } else {
    mainLiftSets = [];
  }

  // GH#217: propagate main-lift modifiers to aux proportionally so the LLM
  // cannot leave aux at baseline while it slashes the main lift. Deload and
  // equipment_unavailable disruptions bypass (matching formula path).
  const isDeload = input.intensityType === 'deload';
  const hasEquipmentDisruption =
    input.activeDisruptions?.some(
      (d) => d.disruption_type === 'equipment_unavailable'
    ) ?? false;
  const propagatePenalties = !isDeload && !hasEquipmentDisruption;
  const volumeRatio = propagatePenalties
    ? Math.min(
        1,
        Math.max(
          0,
          baseSets.length > 0 ? mainLiftSets.length / baseSets.length : 1
        )
      )
    : 1;
  const intensityRatio = propagatePenalties
    ? Math.min(1, Math.max(0, adj.intensityModifier))
    : 1;

  // Apply aux overrides
  const overrideByExercise = new Map(
    adj.auxOverrides.map((o) => [o.exercise, o.action])
  );
  const exerciseTyper = createExerciseTyper(input.customExerciseTypeMap);
  // Finding #17: the LLM strategy ignores soreness signal for aux. Apply the
  // engine's worst-soreness rule (≥9 → skip aux entirely) so a lifter with
  // severe DOMS doesn't get LLM-prescribed aux through the back door. We
  // don't override the LLM's exercise choice or set count beyond this rule.
  const primaryMusclesForSession = getPrimaryMusclesForSession(input.primaryLift);
  const worstSoreness = getWorstSoreness(
    primaryMusclesForSession,
    input.sorenessRatings
  );
  const auxiliaryWork: AuxiliaryWork[] = input.activeAuxiliaries.map(
    (exercise) => {
      const exerciseType = exerciseTyper(exercise);
      const override: 'skip' | 'reduce' | 'normal' | undefined =
        overrideByExercise.get(exercise);
      if (override === 'skip' || (propagatePenalties && skippedMainLift)) {
        return {
          exercise,
          exerciseType,
          sets: [],
          skipped: true,
          skipReason:
            propagatePenalties && skippedMainLift
              ? 'Main lift skipped — auxiliary suppressed'
              : 'LLM: skip override',
        };
      }

      // Soreness ≥ 9 (severe): skip aux entirely — matches processAuxExercise.
      if (worstSoreness >= 9) {
        return {
          exercise,
          exerciseType,
          sets: [],
          skipped: true,
          skipReason: 'Severe soreness — auxiliary exercise skipped',
        };
      }

      // Timed exercises: single set, weight 0, reps 0 — UI renders as time input
      if (exerciseType === 'timed') {
        return {
          exercise,
          exerciseType,
          sets: [{ set_number: 1, weight_kg: 0, reps: 0, rpe_target: 7.0 }],
          skipped: false,
        };
      }

      const baseAuxWeight = roundToNearest(
        computeAuxWeight({
          exercise,
          oneRmKg: input.oneRmKg,
          lift: input.primaryLift,
          biologicalSex: input.biologicalSex,
        }),
        increment
      );
      const llmAdjustedWeight =
        override === 'reduce'
          ? roundToNearest(baseAuxWeight * 0.9, increment)
          : baseAuxWeight;
      const proportionalWeightCeiling = roundToNearest(
        baseAuxWeight * intensityRatio,
        increment
      );
      const auxWeight = Math.min(llmAdjustedWeight, proportionalWeightCeiling);

      const llmAdjustedSets = override === 'reduce' ? 2 : 3;
      const proportionalSetCeiling = Math.max(1, Math.round(3 * volumeRatio));
      const setCount = Math.min(llmAdjustedSets, proportionalSetCeiling);
      return {
        exercise,
        exerciseType,
        sets: Array.from({ length: setCount }, (_, i) => ({
          set_number: i + 1,
          weight_kg: auxWeight,
          reps: 10,
          rpe_target: 7.5,
        })),
        skipped: false,
      };
    }
  );

  // Volume top-up (engine-027 / gh#203): the LLM adjusts the configured aux
  // pair but cannot add new exercises. Volume top-up is a hard rule — when a
  // muscle is below MEV, append an exercise; when core is below MEV, one slot
  // is always reserved for it (core has zero compound contribution). Mirror
  // the formula path's Step 6b so the LLM strategy honors the same guarantee.
  if (input.auxiliaryPool && input.auxiliaryPool.length > 0) {
    const muscleMapper = createMuscleMapper(input.customMuscleMap);
    const topUps = buildVolumeTopUp(
      input.auxiliaryPool,
      input.primaryLift,
      input.oneRmKg,
      mainLiftSets.length,
      input.weeklyVolumeToDate,
      input.mrvMevConfig,
      input.activeAuxiliaries,
      muscleMapper,
      input.biologicalSex,
      input.sessionIndex,
      input.totalSessionsThisWeek,
      input.allOneRmKg,
      input.upcomingLifts,
      input.sorenessRatings,
      input.sleepQuality,
      input.energyLevel,
      input.activeDisruptions,
      input.weightIncrementKg,
      input.recentAuxExercises,
      exerciseTyper
    );
    for (const tu of topUps) {
      const activeCount = auxiliaryWork.filter((a) => !a.skipped).length;
      if (activeCount >= MAX_AUX_EXERCISES) break;
      auxiliaryWork.push(tu);
    }
  }

  const warmupSets =
    mainLiftSets.length > 0 && !skippedMainLift
      ? generateWarmupSets(
          mainLiftSets[0].weight_kg,
          resolveEffectiveWarmupProtocol({
            workingWeightKg: mainLiftSets[0].weight_kg,
            warmupConfig: input.warmupConfig,
            warmupConfigExplicit: input.warmupConfigExplicit,
            primaryLift: input.primaryLift,
            sorenessRatings: input.sorenessRatings,
            biologicalSex: input.biologicalSex,
          }),
          input.barWeightKg,
          input.weightIncrementKg
        )
      : [];

  const volumeModifier =
    baseSets.length > 0 ? mainLiftSets.length / baseSets.length : 1.0;
  const intensityModifier = skippedMainLift ? 0 : adj.intensityModifier;

  // Apply rest adjustment from LLM if provided (engine-021)
  // Schema is nullable (not optional) for OpenAI strict-JSON-schema compat:
  // model emits `restAdjustments: null` (or `mainLift: null`) when there's
  // nothing to adjust. Treat null and missing the same way.
  //
  // Finding #18: choose option A (advisory-only). The per-set
  // restRecommendations.mainLift now stays at the formula default; the LLM's
  // delta lives only on `llmRestSuggestion` for the chip to opt-in apply.
  // This prevents the LLM silently rewriting per-set rest behind the user's
  // back when they never tapped the chip's accept button.
  const formulaBase = formulaRestForMain(input);
  const rawDelta = adj.restAdjustments?.mainLift ?? 0;
  const clampedDelta = Math.max(-60, Math.min(60, rawDelta));

  if (clampedDelta !== rawDelta) {
    console.warn(
      `[LLMJITGenerator] restAdjustments.mainLift ${rawDelta}s exceeded allowed range [-60, 60] — clamped to ${clampedDelta}s`
    );
  }

  // TODO: wire chip accept to update restRecommendations
  // (the chip's accept handler should set restRecommendations.mainLift to
  // formulaBase + clampedDelta when the user taps "Use AI suggestion").
  const restRecommendations = {
    mainLift: mainLiftSets.map(() => formulaBase),
    auxiliary: auxiliaryWork.map(
      () => input.formulaConfig.rest_seconds.auxiliary
    ),
  };

  // Only populate llmRestSuggestion when the LLM actually returned a non-null
  // restAdjustments AND a non-null mainLift inside it.
  const llmRestSuggestion =
    adj.restAdjustments != null && adj.restAdjustments.mainLift != null
      ? { deltaSeconds: clampedDelta, formulaBaseSeconds: formulaBase }
      : undefined;

  return {
    sessionId: input.sessionId,
    generatedAt: new Date(),
    mainLiftSets,
    warmupSets,
    auxiliaryWork,
    volumeModifier,
    intensityModifier,
    rationale: adj.rationale,
    warnings: [],
    skippedMainLift,
    restRecommendations,
    ...(llmRestSuggestion !== undefined ? { llmRestSuggestion } : {}),
  };
}
