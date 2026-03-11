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
  resetSecondsRemaining: number | null;
}

export interface JitData {
  mainLiftSets: PlannedSet[];
  warmupSets: WarmupSet[];
  auxiliaryWork: AuxiliaryWork[];
  restRecommendations?: RestRecommendations;
  llmRestSuggestion?: LlmRestSuggestion | null;
  /** The lifter's 1RM in kg for the primary lift — used for intra-session adaptation */
  oneRmKg?: number;
}

export const DEFAULT_MAIN_REST_SECONDS = 180;
export const DEFAULT_AUX_REST_SECONDS = 90;
