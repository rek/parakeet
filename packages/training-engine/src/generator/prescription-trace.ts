// Types and builder for tracing every decision in the JIT session generator pipeline.
// Callers record state at each pipeline step; build() assembles the final snapshot.

export interface WeightDerivation {
  oneRmKg: number;
  blockPct: number;
  baseWeightKg: number;
  modifiers: Array<{
    source: 'rpe_history' | 'readiness' | 'cycle_phase' | 'soreness' | 'disruption';
    multiplier: number;
    reason: string;
  }>;
  finalMultiplier: number;
  finalWeightKg: number;
}

export interface SetTrace {
  setNumber: number;
  weightKg: number;
  reps: number;
  rpeTarget: number;
  repSource: string;
}

export interface VolumeTrace {
  source: 'rpe_history' | 'readiness' | 'cycle_phase' | 'soreness' | 'disruption' | 'mrv_cap';
  setsBefore: number;
  setsAfter: number;
  reason: string;
}

export interface AuxWeightTrace {
  oneRmKg: number;
  catalogPct: number;
  scalingMethod: 'linear' | 'sqrt';
  rawWeightKg: number;
  sorenessMultiplier: number;
  finalWeightKg: number;
}

export interface AuxExerciseTrace {
  exercise: string;
  selectionReason: string;
  weightTrace: AuxWeightTrace | null;
  reps: number;
  repSource: string;
  sets: number;
  skipped: boolean;
  skipReason?: string;
}

export interface WarmupTrace {
  workingWeightKg: number;
  protocolName: string;
  steps: Array<{
    pct: number;
    weightKg: number;
    reps: number;
  }>;
}

export interface RestTrace {
  mainLift: {
    formulaBaseSeconds: number;
    userOverrideSeconds: number | null;
    llmDeltaSeconds: number | null;
    finalSeconds: number;
  };
  auxiliarySeconds: number;
}

export interface PrescriptionTrace {
  sessionId: string;
  strategy: 'formula' | 'llm' | 'hybrid' | 'formula_fallback';
  primaryLift: string;
  intensityType: string;
  blockNumber: number;
  oneRmKg: number;
  rationale: string[];
  warnings: string[];
  mainLift: {
    weightDerivation: WeightDerivation | null;
    volumeChanges: VolumeTrace[];
    sets: SetTrace[];
    isRecoveryMode: boolean;
    isSkipped: boolean;
  };
  auxiliaries: AuxExerciseTrace[];
  warmup: WarmupTrace | null;
  rest: RestTrace;
}

export class PrescriptionTraceBuilder {
  private sessionId = '';
  private strategy: PrescriptionTrace['strategy'] = 'formula';
  private primaryLift = '';
  private intensityType = '';
  private blockNumber = 0;
  private oneRmKg = 0;

  private _weightOneRmKg = 0;
  private _blockPct = 0;
  private _baseWeightKg = 0;
  private _modifiers: WeightDerivation['modifiers'] = [];
  private _finalWeightKg = 0;

  private _volumeChanges: VolumeTrace[] = [];
  private _sets: SetTrace[] = [];
  private _isRecoveryMode = false;
  private _isSkipped = false;
  private _auxiliaries: AuxExerciseTrace[] = [];
  private _warmup: WarmupTrace | null = null;
  private _rest: RestTrace = {
    mainLift: { formulaBaseSeconds: 0, userOverrideSeconds: null, llmDeltaSeconds: null, finalSeconds: 0 },
    auxiliarySeconds: 0,
  };

  setSessionContext({ sessionId, primaryLift, intensityType, blockNumber, oneRmKg }: {
    sessionId: string;
    primaryLift: string;
    intensityType: string;
    blockNumber: number;
    oneRmKg: number;
  }) {
    this.sessionId = sessionId;
    this.primaryLift = primaryLift;
    this.intensityType = intensityType;
    this.blockNumber = blockNumber;
    this.oneRmKg = oneRmKg;
    return this;
  }

  setBaseWeight({ oneRmKg, blockPct, baseWeightKg }: {
    oneRmKg: number;
    blockPct: number;
    baseWeightKg: number;
  }) {
    this._weightOneRmKg = oneRmKg;
    this._blockPct = blockPct;
    this._baseWeightKg = baseWeightKg;
    return this;
  }

  recordModifier({ source, multiplier, reason }: WeightDerivation['modifiers'][number]) {
    this._modifiers.push({ source, multiplier, reason });
    return this;
  }

  recordVolumeChange({ source, setsBefore, setsAfter, reason }: VolumeTrace) {
    this._volumeChanges.push({ source, setsBefore, setsAfter, reason });
    return this;
  }

  setFinalWeight(weightKg: number) {
    this._finalWeightKg = weightKg;
    return this;
  }

  recordSets(sets: SetTrace[]) {
    this._sets = sets;
    return this;
  }

  setRecoveryMode(isRecovery: boolean) {
    this._isRecoveryMode = isRecovery;
    return this;
  }

  setSkipped(isSkipped: boolean) {
    this._isSkipped = isSkipped;
    return this;
  }

  recordAuxiliary(trace: AuxExerciseTrace) {
    this._auxiliaries.push(trace);
    return this;
  }

  recordWarmup(trace: WarmupTrace) {
    this._warmup = trace;
    return this;
  }

  recordRest(trace: RestTrace) {
    this._rest = trace;
    return this;
  }

  build({ rationale, warnings }: { rationale: string[]; warnings: string[] }): PrescriptionTrace {
    const hasWeightData = this._weightOneRmKg > 0 || this._blockPct > 0;

    const weightDerivation: WeightDerivation | null = hasWeightData
      ? {
          oneRmKg: this._weightOneRmKg,
          blockPct: this._blockPct,
          baseWeightKg: this._baseWeightKg,
          modifiers: this._modifiers,
          finalMultiplier: this._modifiers.reduce((acc, m) => acc * m.multiplier, 1),
          finalWeightKg: this._finalWeightKg,
        }
      : null;

    return {
      sessionId: this.sessionId,
      strategy: this.strategy,
      primaryLift: this.primaryLift,
      intensityType: this.intensityType,
      blockNumber: this.blockNumber,
      oneRmKg: this.oneRmKg,
      rationale,
      warnings,
      mainLift: {
        weightDerivation,
        volumeChanges: this._volumeChanges,
        sets: this._sets,
        isRecoveryMode: this._isRecoveryMode,
        isSkipped: this._isSkipped,
      },
      auxiliaries: this._auxiliaries,
      warmup: this._warmup,
      rest: this._rest,
    };
  }
}
