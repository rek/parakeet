// @spec docs/features/jit-pipeline/spec-adaptive-volume.md
import {
  canAutoApply,
  computeCalibrationBias,
  extractModifierSamples,
  reviewCalibrationAdjustment,
  shouldTriggerReview,
} from '@parakeet/training-engine';
import type {
  ModifierSource,
  PrescriptionTrace,
} from '@parakeet/training-engine';
import { captureException } from '@platform/utils/captureException';
import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  fetchRawModifierCalibrations,
  upsertModifierCalibration,
} from '../data/calibration.repository';
import {
  fetchSessionById,
  fetchSessionLogBySessionId,
} from '../../session/data/session.repository';

/**
 * After session completion, extract trace modifiers + actual RPE and update
 * per-athlete modifier calibration. Fire-and-forget from completeSession.
 */
export async function updateModifierCalibrations({
  sessionId,
  userId,
}: {
  sessionId: string;
  userId: string;
}) {
  try {
    const [session, sessionLog] = await Promise.all([
      fetchSessionById(sessionId),
      fetchSessionLogBySessionId(sessionId),
    ]);

    if (!session?.jit_output_trace) return;
    if (!sessionLog?.session_rpe) return;

    const trace = session.jit_output_trace as unknown as PrescriptionTrace;
    if (!trace.mainLift?.weightDerivation?.modifiers?.length) return;

    // Extract RPE target from planned sets (first set's rpe_target)
    const rpeTarget = trace.mainLift.sets[0]?.rpeTarget ?? 8;
    const rpeActual = sessionLog.session_rpe;

    // Extract samples from trace modifiers
    // Only calibrate sources where the JIT pipeline applies calibration adjustments
    const CALIBRATED_SOURCES = new Set<ModifierSource>([
      'readiness',
      'cycle_phase',
      'soreness',
    ]);
    const samples = extractModifierSamples({
      modifiers: trace.mainLift.weightDerivation.modifiers.filter((m) =>
        CALIBRATED_SOURCES.has(m.source)
      ),
      rpeTarget,
      rpeActual,
    });

    if (samples.length === 0) return;

    // Group samples by source and fetch existing calibration data
    const bySource = new Map<ModifierSource, typeof samples>();
    for (const sample of samples) {
      const existing = bySource.get(sample.modifierSource) ?? [];
      existing.push(sample);
      bySource.set(sample.modifierSource, existing);
    }

    const existingCalibrations = await fetchRawModifierCalibrations(userId);

    for (const [source, newSamples] of bySource) {
      const existing = existingCalibrations.find(
        (c) => c.modifier_source === source
      );

      // Incrementally update the running mean bias
      // Running mean = (oldMean * oldCount + newBias * newCount) / (oldCount + newCount)
      const oldCount = existing?.sample_count ?? 0;
      const oldMeanBias = existing?.mean_bias ?? 0;
      const newBias =
        newSamples.reduce((sum, s) => sum + (s.rpeActual - s.rpeTarget), 0) /
        newSamples.length;
      const totalCount = oldCount + newSamples.length;
      const combinedMeanBias =
        (oldMeanBias * oldCount + newBias * newSamples.length) / totalCount;

      // Compute calibration from the combined stats
      // Create synthetic samples array with the combined mean
      const syntheticSamples = Array.from({ length: totalCount }, () => ({
        modifierSource: source,
        multiplier: newSamples[0].multiplier,
        rpeTarget: newSamples[0].rpeTarget,
        rpeActual: newSamples[0].rpeTarget + combinedMeanBias,
      }));

      const calibration = computeCalibrationBias({ samples: syntheticSamples });
      const currentAdjustment = existing?.adjustment ?? 0;

      if (canAutoApply({ calibration })) {
        // Small adjustment with sufficient confidence → auto-apply
        await upsertModifierCalibration({
          userId,
          modifierSource: source,
          adjustment: calibration.suggestedAdjustment,
          confidence: calibration.confidence,
          sampleCount: totalCount,
          meanBias: combinedMeanBias,
        });
      } else if (
        shouldTriggerReview({
          calibration,
          previousAdjustment: currentAdjustment,
        })
      ) {
        // Large adjustment or low confidence → LLM review before applying
        const review = await reviewCalibrationAdjustment({
          calibration,
          currentAdjustment,
        });
        const adjustmentToStore = review.apply
          ? calibration.suggestedAdjustment
          : currentAdjustment;
        await upsertModifierCalibration({
          userId,
          modifierSource: source,
          adjustment: adjustmentToStore,
          confidence: calibration.confidence,
          sampleCount: totalCount,
          meanBias: combinedMeanBias,
        });
        // Queue user prompt for significant changes the LLM wants confirmed
        if (review.askUser) {
          await AsyncStorage.setItem(
            'pending_calibration_prompt',
            JSON.stringify({
              modifierSource: source,
              currentDefault: currentAdjustment,
              proposed: calibration.suggestedAdjustment,
              sampleCount: totalCount,
              meanBias: combinedMeanBias,
              reason: review.reason,
            })
          );
        }
      } else {
        // Not enough data to propose anything — store stats only
        await upsertModifierCalibration({
          userId,
          modifierSource: source,
          adjustment: currentAdjustment,
          confidence: calibration.confidence,
          sampleCount: totalCount,
          meanBias: combinedMeanBias,
        });
      }
    }
  } catch (err) {
    captureException(err);
  }
}
