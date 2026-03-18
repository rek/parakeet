import {
  computeCalibrationBias,
  extractModifierSamples,
  canAutoApply,
} from '@parakeet/training-engine';
import type { ModifierSource, PrescriptionTrace } from '@parakeet/training-engine';
import { typedSupabase } from '@platform/supabase';
import { captureException } from '@platform/utils/captureException';

import { upsertModifierCalibration } from '../data/calibration.repository';

/**
 * After session completion, extract trace modifiers + actual RPE and update
 * per-athlete modifier calibration. Fire-and-forget from completeSession.
 */
export async function updateModifierCalibrations({ sessionId, userId }: {
  sessionId: string;
  userId: string;
}) {
  try {
    // Fetch session trace + session log RPE
    const { data: session } = await typedSupabase
      .from('sessions')
      .select('jit_output_trace')
      .eq('id', sessionId)
      .maybeSingle();

    if (!session?.jit_output_trace) return;

    const { data: log } = await typedSupabase
      .from('session_logs')
      .select('session_rpe')
      .eq('session_id', sessionId)
      .maybeSingle();

    if (!log?.session_rpe) return;

    const trace = session.jit_output_trace as unknown as PrescriptionTrace;
    if (!trace.mainLift?.weightDerivation?.modifiers?.length) return;

    // Extract RPE target from planned sets (first set's rpe_target)
    const rpeTarget = trace.mainLift.sets[0]?.rpeTarget ?? 8;
    const rpeActual = log.session_rpe;

    // Extract samples from trace modifiers
    // Only calibrate sources where the JIT pipeline applies calibration adjustments
    const CALIBRATED_SOURCES = new Set<ModifierSource>(['readiness', 'cycle_phase', 'soreness']);
    const samples = extractModifierSamples({
      modifiers: trace.mainLift.weightDerivation.modifiers.filter(
        (m) => CALIBRATED_SOURCES.has(m.source)
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

    // Fetch existing samples from previous sessions for this user
    const { data: existingCalibrations } = await typedSupabase
      .from('modifier_calibrations')
      .select('modifier_source, sample_count, mean_bias, adjustment')
      .eq('user_id', userId);

    for (const [source, newSamples] of bySource) {
      const existing = (existingCalibrations ?? []).find(
        (c) => c.modifier_source === source
      );

      // Incrementally update the running mean bias
      // Running mean = (oldMean * oldCount + newBias * newCount) / (oldCount + newCount)
      const oldCount = existing?.sample_count ?? 0;
      const oldMeanBias = existing?.mean_bias ?? 0;
      const newBias = newSamples.reduce((sum, s) => sum + (s.rpeActual - s.rpeTarget), 0) / newSamples.length;
      const totalCount = oldCount + newSamples.length;
      const combinedMeanBias = (oldMeanBias * oldCount + newBias * newSamples.length) / totalCount;

      // Compute calibration from the combined stats
      // Create synthetic samples array with the combined mean
      const syntheticSamples = Array.from({ length: totalCount }, () => ({
        modifierSource: source,
        multiplier: newSamples[0].multiplier,
        rpeTarget: newSamples[0].rpeTarget,
        rpeActual: newSamples[0].rpeTarget + combinedMeanBias,
      }));

      const calibration = computeCalibrationBias({ samples: syntheticSamples });

      // Only persist if we can auto-apply (medium+ confidence, small adjustment)
      // Large adjustments will be handled by Phase C (LLM review gate)
      if (canAutoApply({ calibration })) {
        await upsertModifierCalibration({
          userId,
          modifierSource: source,
          adjustment: calibration.suggestedAdjustment,
          confidence: calibration.confidence,
          sampleCount: totalCount,
          meanBias: combinedMeanBias,
        });
      } else {
        // Still store the stats even if not auto-applying the adjustment
        await upsertModifierCalibration({
          userId,
          modifierSource: source,
          adjustment: existing?.adjustment ?? 0,
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
