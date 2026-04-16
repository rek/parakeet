import type { PlannedSet as NumberedPlannedSet } from '@parakeet/shared-types';

export interface PlannedSet {
  weight_kg: number;
  reps: number;
  rpe_target?: number;
  set_type?: string;
}

export interface WarmupSet {
  weightKg: number;
  reps: number;
  label?: string;
}

export interface AuxiliaryWork {
  exercise: string;
  sets: PlannedSet[];
  skipped: boolean;
  skipReason?: string;
  exerciseType?: 'weighted' | 'bodyweight' | 'timed';
  isTopUp?: boolean;
  topUpReason?: string;
}

export interface RestRecommendations {
  mainLift: number[];
  auxiliary: number[];
}

export interface LlmRestSuggestion {
  deltaSeconds: number;
  formulaBaseSeconds: number;
}

export interface PostRestState {
  pendingMainSetNumber: number | null;
  pendingAuxExercise: string | null;
  pendingAuxSetNumber: number | null;
  actualRestSeconds: number;
  liftStartedAt: number;
  plannedReps: number;
  plannedWeightKg: number | null;
  nextSetNumber: number | null;
  resetSecondsRemaining: number | null;
}

export interface VolumeReductions {
  totalSetsRemoved: number;
  baseSetsCount: number;
  sources: Array<{
    source: 'soreness' | 'readiness' | 'cycle_phase' | 'disruption';
    setsRemoved: number;
  }>;
  recoveryBlocked: boolean;
}

export interface JitData {
  mainLiftSets: PlannedSet[];
  warmupSets: WarmupSet[];
  auxiliaryWork: AuxiliaryWork[];
  restRecommendations?: RestRecommendations;
  llmRestSuggestion?: LlmRestSuggestion | null;
  /** The lifter's 1RM in kg for the primary lift — used for intra-session adaptation */
  oneRmKg?: number;
  /** Present when JIT reduced volume — enables intra-session recovery offer */
  volumeReductions?: VolumeReductions;
  /** Human-readable reasons for adjustments applied by JIT */
  rationale?: string[];
  /** Intensity scaling factor (e.g. 0.95 = intensity reduced 5%) */
  intensityModifier?: number;
}

// ── Intra-session adaptation types (app-owned mirrors of engine types) ────────
// These use shared-types PlannedSet (with set_number) — matches engine output.

export type AdaptationType =
  | 'none'
  | 'extended_rest'
  | 'weight_reduced'
  | 'sets_capped';

export interface SessionAdaptation {
  sets: NumberedPlannedSet[];
  restBonusSeconds: number;
  adaptationType: AdaptationType;
  rationale: string;
}

export interface AuxSessionAdaptation {
  exercise: string;
  sets: NumberedPlannedSet[];
  adaptationType: 'none' | 'weight_reduced';
  rationale: string;
}

export interface RecoveryOffer {
  setsAvailable: number;
  recoveredSets: NumberedPlannedSet[];
  rationale: string;
}

export interface WeightSuggestionOffer {
  suggestedWeightKg: number;
  deltaKg: number;
  rationale: string;
}

export interface PendingAuxConfirmation {
  exerciseIndex: number;
  exercise: string;
  setNumber: number;
  setsInExercise: number;
  weightGrams: number;
  reps: number;
}

export interface SupersetGroup {
  groupId: string;
  setNumbers: number[];
  currentIndex: number;
  restBetweenSetsSeconds: number;
  restAfterGroupSeconds: number;
}

export const DEFAULT_MAIN_REST_SECONDS = 180;
export const DEFAULT_AUX_REST_SECONDS = 90;
