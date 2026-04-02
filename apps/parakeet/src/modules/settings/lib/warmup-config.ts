import type { Lift } from '@parakeet/shared-types';
import {
  estimateWorkingWeight,
  generateWarmupSets,
  getPresetSteps,
} from '@parakeet/training-engine';
import type {
  WarmupPresetName,
  WarmupProtocol,
  WarmupStep,
} from '@parakeet/training-engine';

import {
  deleteWarmupConfig,
  fetchAllWarmupConfigs,
  fetchWarmupConfig,
  upsertWarmupConfig,
} from '../data/warmup-config.repository';

// Re-export warmup types and functions so screens import from @modules/settings
// instead of directly from @parakeet/training-engine.
export { estimateWorkingWeight, generateWarmupSets, getPresetSteps };
export type { WarmupPresetName, WarmupProtocol, WarmupStep };

function parseCustomSteps(
  value: unknown
): Extract<WarmupProtocol, { type: 'custom' }>['steps'] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((step): step is { pct: number; reps: number } => {
      if (!step || typeof step !== 'object') return false;
      const s = step as { pct?: unknown; reps?: unknown };
      return (
        typeof s.pct === 'number' &&
        Number.isFinite(s.pct) &&
        typeof s.reps === 'number' &&
        Number.isFinite(s.reps)
      );
    })
    .map((step) => ({ pct: step.pct, reps: step.reps }));
}

export async function getWarmupConfig(
  userId: string,
  lift: Lift,
  biologicalSex?: 'female' | 'male'
): Promise<{ protocol: WarmupProtocol; explicit: boolean }> {
  const data = await fetchWarmupConfig(userId, lift);

  const defaultPreset: WarmupPresetName =
    biologicalSex === 'female' ? 'standard_female' : 'standard';
  if (!data)
    return {
      protocol: { type: 'preset', name: defaultPreset },
      explicit: false,
    };
  if (data.protocol === 'custom')
    return {
      protocol: { type: 'custom', steps: parseCustomSteps(data.custom_steps) },
      explicit: true,
    };
  return {
    protocol: { type: 'preset', name: data.protocol as WarmupPresetName },
    explicit: true,
  };
}

export async function getAllWarmupConfigs(
  userId: string,
  biologicalSex?: 'female' | 'male'
): Promise<Record<Lift, WarmupProtocol>> {
  const rows = await fetchAllWarmupConfigs(userId);

  const defaultPreset: WarmupPresetName =
    biologicalSex === 'female' ? 'standard_female' : 'standard';
  const defaults: Record<Lift, WarmupProtocol> = {
    squat: { type: 'preset', name: defaultPreset },
    bench: { type: 'preset', name: defaultPreset },
    deadlift: { type: 'preset', name: defaultPreset },
  };
  for (const row of rows) {
    defaults[row.lift as Lift] =
      row.protocol === 'custom'
        ? { type: 'custom', steps: parseCustomSteps(row.custom_steps) }
        : { type: 'preset', name: row.protocol as WarmupPresetName };
  }
  return defaults;
}

export async function updateWarmupConfig(
  userId: string,
  lift: Lift,
  protocol: WarmupProtocol
): Promise<void> {
  await upsertWarmupConfig(userId, lift, {
    protocol: protocol.type === 'custom' ? 'custom' : protocol.name,
    custom_steps: protocol.type === 'custom' ? protocol.steps : null,
    updated_at: new Date().toISOString(),
  });
}

export async function resetWarmupConfig(
  userId: string,
  lift: Lift
): Promise<void> {
  await deleteWarmupConfig(userId, lift);
}
