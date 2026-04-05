import type { VideoAnalysisResult } from '@parakeet/shared-types';

export interface SnapshotFailure {
  path: string;
  expected: unknown;
  actual: unknown;
  tolerance: string;
}

export interface SnapshotDiff {
  passed: boolean;
  failures: SnapshotFailure[];
}

// --- Tolerance definitions ---

/** Absolute tolerance for angle metrics (degrees) */
const ANGLE_TOL = 5;
/** Absolute tolerance for distance metrics (cm) */
const DISTANCE_TOL = 2;
/** Relative tolerance for velocity/timing metrics (fraction, e.g. 0.1 = 10%) */
const RELATIVE_TOL = 0.1;
/** Absolute tolerance for stability CV (percentage points) */
const STABILITY_TOL = 1;
/** Absolute tolerance for sagittal confidence */
const CONFIDENCE_TOL = 0.05;
/** Relative tolerance for fatigue signature fields */
const FATIGUE_RELATIVE_TOL = 0.15;
/** Absolute floor for fatigue comparison (when values are near zero) */
const FATIGUE_ABS_FLOOR = 1;

const ANGLE_FIELDS = new Set([
  'forwardLeanDeg',
  'kneeAngleDeg',
  'hipAngleAtLockoutDeg',
  'elbowFlareDeg',
  'buttWinkDeg',
]);

const DISTANCE_FIELDS = new Set([
  'maxDepthCm',
  'romCm',
  'barDriftCm',
  'stanceWidthCm',
  'hipShiftCm',
  'barToShinDistanceCm',
]);

const RELATIVE_FIELDS = new Set([
  'meanConcentricVelocityCmS',
  'velocityLossPct',
  'pauseDurationSec',
  'hipHingeCrossoverPct',
  'concentricDurationSec',
  'eccentricDurationSec',
  'tempoRatio',
]);

// --- Helpers ---

function withinAbsolute(
  expected: number,
  actual: number,
  tol: number
): boolean {
  return Math.abs(expected - actual) <= tol;
}

function withinRelative(
  expected: number,
  actual: number,
  fraction: number
): boolean {
  if (expected === 0 && actual === 0) return true;
  const ref = Math.abs(expected) || 1;
  return Math.abs(expected - actual) / ref <= fraction;
}

function withinFatigue(expected: number, actual: number): boolean {
  // Use the larger of relative tolerance or absolute floor
  const absDiff = Math.abs(expected - actual);
  const ref = Math.abs(expected) || 1;
  return absDiff <= FATIGUE_ABS_FLOOR || absDiff / ref <= FATIGUE_RELATIVE_TOL;
}

function checkNumericField(
  path: string,
  expected: number | undefined | null,
  actual: number | undefined | null,
  failures: SnapshotFailure[]
): void {
  // Both missing — fine
  if (expected == null && actual == null) return;
  // One missing, one present
  if (expected == null || actual == null) {
    failures.push({
      path,
      expected,
      actual,
      tolerance: 'presence mismatch',
    });
    return;
  }

  const fieldName = path.split('.').pop() ?? '';

  if (ANGLE_FIELDS.has(fieldName)) {
    if (!withinAbsolute(expected, actual, ANGLE_TOL)) {
      failures.push({
        path,
        expected,
        actual,
        tolerance: `±${ANGLE_TOL}°`,
      });
    }
  } else if (DISTANCE_FIELDS.has(fieldName)) {
    if (!withinAbsolute(expected, actual, DISTANCE_TOL)) {
      failures.push({
        path,
        expected,
        actual,
        tolerance: `±${DISTANCE_TOL}cm`,
      });
    }
  } else if (RELATIVE_FIELDS.has(fieldName)) {
    if (!withinRelative(expected, actual, RELATIVE_TOL)) {
      failures.push({
        path,
        expected,
        actual,
        tolerance: `±${Math.round(RELATIVE_TOL * 100)}%`,
      });
    }
  } else if (fieldName === 'lockoutStabilityCv') {
    if (!withinAbsolute(expected, actual, STABILITY_TOL)) {
      failures.push({
        path,
        expected,
        actual,
        tolerance: `±${STABILITY_TOL}%`,
      });
    }
  } else if (fieldName === 'estimatedRir') {
    // RiR is derived from velocity — use absolute tolerance of 1
    if (!withinAbsolute(expected, actual, 1)) {
      failures.push({ path, expected, actual, tolerance: '±1 RiR' });
    }
  }
}

// --- Main comparison ---

/**
 * Compare two VideoAnalysisResult objects using field-level tolerances.
 *
 * Excludes barPath (per-frame coordinates too brittle) and frame indices
 * (startFrame/endFrame can shift by 1-2 frames without affecting quality).
 */
export function compareSnapshot(
  expected: VideoAnalysisResult,
  actual: VideoAnalysisResult
): SnapshotDiff {
  const failures: SnapshotFailure[] = [];

  // Rep count — exact match
  if (expected.reps.length !== actual.reps.length) {
    failures.push({
      path: 'reps.length',
      expected: expected.reps.length,
      actual: actual.reps.length,
      tolerance: 'exact',
    });
    // Can't compare per-rep if counts differ
    return { passed: false, failures };
  }

  // Sagittal confidence
  if (
    !withinAbsolute(
      expected.sagittalConfidence,
      actual.sagittalConfidence,
      CONFIDENCE_TOL
    )
  ) {
    failures.push({
      path: 'sagittalConfidence',
      expected: expected.sagittalConfidence,
      actual: actual.sagittalConfidence,
      tolerance: `±${CONFIDENCE_TOL}`,
    });
  }

  // Per-rep comparison
  for (let i = 0; i < expected.reps.length; i++) {
    const prefix = `reps[${i}]`;
    const eRep = expected.reps[i];
    const aRep = actual.reps[i];

    // Numeric metrics
    const numericFields = [
      'maxDepthCm',
      'forwardLeanDeg',
      'barDriftCm',
      'romCm',
      'kneeAngleDeg',
      'hipAngleAtLockoutDeg',
      'meanConcentricVelocityCmS',
      'velocityLossPct',
      'estimatedRir',
      'concentricDurationSec',
      'eccentricDurationSec',
      'tempoRatio',
      'buttWinkDeg',
      'stanceWidthCm',
      'hipShiftCm',
      'elbowFlareDeg',
      'pauseDurationSec',
      'hipHingeCrossoverPct',
      'barToShinDistanceCm',
      'lockoutStabilityCv',
    ] as const;

    for (const field of numericFields) {
      checkNumericField(
        `${prefix}.${field}`,
        eRep[field] as number | undefined,
        aRep[field] as number | undefined,
        failures
      );
    }

    // Fault types — exact set match (order doesn't matter)
    const eFaultTypes = new Set(eRep.faults.map((f) => f.type));
    const aFaultTypes = new Set(aRep.faults.map((f) => f.type));
    const missingFaults = [...eFaultTypes].filter((t) => !aFaultTypes.has(t));
    const extraFaults = [...aFaultTypes].filter((t) => !eFaultTypes.has(t));
    if (missingFaults.length > 0 || extraFaults.length > 0) {
      failures.push({
        path: `${prefix}.faults`,
        expected: [...eFaultTypes].sort(),
        actual: [...aFaultTypes].sort(),
        tolerance: 'exact set match',
      });
    }

    // Verdict — exact match (with presence check)
    if (eRep.verdict && !aRep.verdict) {
      failures.push({
        path: `${prefix}.verdict`,
        expected: 'present',
        actual: 'missing',
        tolerance: 'presence mismatch',
      });
    } else if (!eRep.verdict && aRep.verdict) {
      failures.push({
        path: `${prefix}.verdict`,
        expected: 'missing',
        actual: 'present',
        tolerance: 'presence mismatch',
      });
    } else if (eRep.verdict && aRep.verdict) {
      if (eRep.verdict.verdict !== aRep.verdict.verdict) {
        failures.push({
          path: `${prefix}.verdict.verdict`,
          expected: eRep.verdict.verdict,
          actual: aRep.verdict.verdict,
          tolerance: 'exact',
        });
      }
    }

    // Hip shift direction — exact match
    if (eRep.hipShiftDirection !== aRep.hipShiftDirection) {
      if (eRep.hipShiftDirection != null || aRep.hipShiftDirection != null) {
        failures.push({
          path: `${prefix}.hipShiftDirection`,
          expected: eRep.hipShiftDirection,
          actual: aRep.hipShiftDirection,
          tolerance: 'exact',
        });
      }
    }

    // isSinking — exact match
    if (eRep.isSinking !== aRep.isSinking) {
      if (eRep.isSinking != null || aRep.isSinking != null) {
        failures.push({
          path: `${prefix}.isSinking`,
          expected: eRep.isSinking,
          actual: aRep.isSinking,
          tolerance: 'exact',
        });
      }
    }
  }

  // Fatigue signatures (with presence check)
  if (expected.fatigueSignatures && !actual.fatigueSignatures) {
    failures.push({
      path: 'fatigueSignatures',
      expected: 'present',
      actual: 'missing',
      tolerance: 'presence mismatch',
    });
  } else if (!expected.fatigueSignatures && actual.fatigueSignatures) {
    failures.push({
      path: 'fatigueSignatures',
      expected: 'missing',
      actual: 'present',
      tolerance: 'presence mismatch',
    });
  } else if (expected.fatigueSignatures && actual.fatigueSignatures) {
    const eFat = expected.fatigueSignatures;
    const aFat = actual.fatigueSignatures;

    const fatigueNumericFields = [
      'forwardLeanDriftDeg',
      'barDriftIncreaseCm',
      'romCompressionCm',
      'descentSpeedChange',
      'lockoutDegradationDeg',
    ] as const;

    for (const field of fatigueNumericFields) {
      const eVal = eFat[field];
      const aVal = aFat[field];
      if (eVal == null && aVal == null) continue;
      if (eVal == null || aVal == null) {
        failures.push({
          path: `fatigueSignatures.${field}`,
          expected: eVal,
          actual: aVal,
          tolerance: 'presence mismatch',
        });
        continue;
      }
      if (!withinFatigue(eVal, aVal)) {
        failures.push({
          path: `fatigueSignatures.${field}`,
          expected: eVal,
          actual: aVal,
          tolerance: `±${Math.round(FATIGUE_RELATIVE_TOL * 100)}% or ±${FATIGUE_ABS_FLOOR}`,
        });
      }
    }

    // Velocity loss trend — exact match
    if (eFat.velocityLossTrend !== aFat.velocityLossTrend) {
      failures.push({
        path: 'fatigueSignatures.velocityLossTrend',
        expected: eFat.velocityLossTrend,
        actual: aFat.velocityLossTrend,
        tolerance: 'exact',
      });
    }
  }

  return { passed: failures.length === 0, failures };
}
