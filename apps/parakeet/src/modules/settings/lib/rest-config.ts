// @spec docs/features/rest-timer/spec-settings.md
import type { IntensityType, Lift } from '@parakeet/shared-types';

import {
  deleteRestConfigs,
  fetchRestConfigs,
  upsertRestConfig,
} from '../data/rest-config.repository';

export interface RestOverride {
  lift?: Lift;
  intensityType?: IntensityType;
  restSeconds: number;
}

export async function getUserRestOverrides(
  userId: string
): Promise<RestOverride[]> {
  const data = await fetchRestConfigs(userId);
  return data.map((row) => ({
    ...(row.lift != null && { lift: row.lift as Lift }),
    ...(row.intensity_type != null && {
      intensityType: row.intensity_type as IntensityType,
    }),
    restSeconds: row.rest_seconds as number,
  }));
}

export async function setRestOverride(
  userId: string,
  restSeconds: number,
  lift?: Lift,
  intensityType?: IntensityType
): Promise<void> {
  await upsertRestConfig(userId, {
    lift: lift ?? null,
    intensity_type: intensityType ?? null,
    rest_seconds: restSeconds,
    updated_at: new Date().toISOString(),
  });
}

export async function resetRestOverrides(userId: string): Promise<void> {
  await deleteRestConfigs(userId);
}
