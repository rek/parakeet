import { parseJsonArray, parseNullableJsonArray } from '@parakeet/db';
import { ActualSetSchema, PlannedSetSchema } from '@parakeet/shared-types';
import type { ActualSet, PlannedSet } from '@parakeet/shared-types';
import type { PrescriptionTrace } from '@parakeet/training-engine';

export function parseActualSetsJson(value: unknown): ActualSet[] {
  return parseJsonArray(value, 'actual_sets', (item) =>
    ActualSetSchema.parse(item)
  );
}

export function parsePlannedSetsJson(value: unknown): PlannedSet[] {
  return (
    parseNullableJsonArray(value, 'planned_sets', (item) =>
      PlannedSetSchema.parse(item)
    ) ?? []
  );
}

export function parseJitInputSnapshot(value: unknown) {
  if (!value || typeof value !== 'object') return null;
  const snap = value as Record<string, unknown>;
  return {
    sorenessRatings: snap.sorenessRatings as Record<string, number> | undefined,
    sleepQuality: snap.sleepQuality as number | undefined,
    energyLevel: snap.energyLevel as number | undefined,
    activeDisruptions: snap.activeDisruptions as
      | Array<{ disruption_type: string; severity: string }>
      | undefined,
  };
}

export function parsePrescriptionTrace(value: unknown): PrescriptionTrace | null {
  if (value && typeof value === 'object' && 'mainLift' in value && 'rest' in value) {
    return value as unknown as PrescriptionTrace;
  }
  return null;
}
