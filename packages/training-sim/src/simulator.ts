import { Lift, TrainingDisruption } from '@parakeet/shared-types';
import {
  adaptRemainingPlan,
  applyTrainingAgeMultiplier,
  classifyVolumeStatus,
  CompletedSetLog,
  DEFAULT_AUXILIARY_POOLS,
  DEFAULT_MRV_MEV_CONFIG_FEMALE,
  DEFAULT_MRV_MEV_CONFIG_MALE,
  generateAuxiliaryAssignments,
  generateJITSession,
  generateProgram,
  getDefaultFormulaConfig,
  getMusclesForLift,
  getWeekInBlock,
  IntraSessionContext,
  JITInput,
  MrvMevConfig,
  MuscleGroup,
  RecentSessionSummary,
  SessionScaffold,
} from '@parakeet/training-engine';

import { ADHERENT_MODEL } from './personas/performance-models';
import {
  CyclePhase,
  DisruptionEvent,
  LifeScript,
  PerformanceModelConfig,
  Persona,
  SimulatedSession,
  SimulationLog,
  SorenessLevel,
} from './types';

// ---------------------------------------------------------------------------
// Cycle phase calculation (simplified — mirrors engine logic)
// ---------------------------------------------------------------------------

function getCyclePhaseForDay(
  dayInCycle: number,
  cycleLength: number
): CyclePhase {
  const menstrualEnd = 5;
  const follicularEnd = Math.floor(cycleLength * 0.5) - 1;
  const ovulatoryEnd = follicularEnd + 3;
  const lutealEnd = cycleLength - 5;

  if (dayInCycle < menstrualEnd) return 'menstrual';
  if (dayInCycle < follicularEnd) return 'follicular';
  if (dayInCycle < ovulatoryEnd) return 'ovulatory';
  if (dayInCycle < lutealEnd) return 'luteal';
  return 'late_luteal';
}

// ---------------------------------------------------------------------------
// Simulator
// ---------------------------------------------------------------------------

export interface SimulatorOptions {
  persona: Persona;
  script: LifeScript;
  performanceModel?: PerformanceModelConfig;
  totalWeeks?: number;
  cycleLength?: number;
}

export function runSimulation(options: SimulatorOptions): SimulationLog {
  const {
    persona,
    script,
    performanceModel = ADHERENT_MODEL,
    cycleLength = 28,
  } = options;

  const totalDays = script.events.length;
  const totalWeeks = options.totalWeeks ?? Math.ceil(totalDays / 7);

  // Current 1RM state (mutable during simulation)
  const currentMaxes: Record<Lift, number> = {
    squat: persona.squatMaxKg,
    bench: persona.benchMaxKg,
    deadlift: persona.deadliftMaxKg,
  };

  const formulaConfig = getDefaultFormulaConfig(persona.biologicalSex);

  const baseMrvMev =
    persona.biologicalSex === 'female'
      ? DEFAULT_MRV_MEV_CONFIG_FEMALE
      : DEFAULT_MRV_MEV_CONFIG_MALE;
  // Apply training-age multiplier before persona overrides (overrides take precedence)
  const scaledMrvMev = applyTrainingAgeMultiplier({
    config: baseMrvMev,
    trainingAge: persona.trainingAge,
  });
  const mrvMevConfig: MrvMevConfig = { ...scaledMrvMev };
  if (persona.mrvMevOverrides) {
    for (const [muscle, overrides] of Object.entries(persona.mrvMevOverrides)) {
      if (overrides) {
        mrvMevConfig[muscle as MuscleGroup] = {
          ...mrvMevConfig[muscle as MuscleGroup],
          ...overrides,
        };
      }
    }
  }

  // Generate program structure
  const program = generateProgram({
    totalWeeks,
    trainingDaysPerWeek: 3,
    startDate: new Date('2026-01-05'), // a Monday
  });

  // Generate auxiliary assignments
  const auxAssignments = generateAuxiliaryAssignments(
    'sim-program',
    totalWeeks,
    DEFAULT_AUXILIARY_POOLS
  );

  // Build a flat aux pool for volume top-up
  const allAuxPool = [
    ...DEFAULT_AUXILIARY_POOLS.squat,
    ...DEFAULT_AUXILIARY_POOLS.bench,
    ...DEFAULT_AUXILIARY_POOLS.deadlift,
  ];

  // Tracking state
  const sessions: SimulatedSession[] = [];
  const recentLogs: RecentSessionSummary[] = [];
  const activeDisruptions: Array<{
    disruption: DisruptionEvent;
    startDay: number;
    asTrainingDisruption: TrainingDisruption;
  }> = [];
  const disruptionLog: SimulationLog['disruptions'] = [];
  const oneRmProgression: SimulationLog['oneRmProgression'] = [];
  let skippedDays = 0;
  let sessionIndex = 0; // which scaffold session we're on
  let periodStartDay: number | null =
    persona.biologicalSex === 'female' ? 0 : null;
  let weeklyVolume: Partial<Record<MuscleGroup, number>> = {};
  let currentWeek = 0;

  // Helper: reset weekly volume when scaffold week changes
  function maybeResetWeek(scaffoldWeek: number) {
    if (scaffoldWeek !== currentWeek) {
      currentWeek = scaffoldWeek;
      weeklyVolume = {};
      oneRmProgression.push({
        weekNumber: scaffoldWeek,
        maxes: { ...currentMaxes },
      });
    }
  }

  for (let day = 0; day < totalDays; day++) {
    const event = script.events[day];

    // Expire disruptions
    for (let i = activeDisruptions.length - 1; i >= 0; i--) {
      const d = activeDisruptions[i];
      if (day >= d.startDay + d.disruption.durationDays) {
        const logEntry = disruptionLog.find(
          (l) => l.day === d.startDay && l.disruption === d.disruption
        );
        if (logEntry) logEntry.resolvedDay = day;
        activeDisruptions.splice(i, 1);
      }
    }

    // Handle event types
    if (event.type === 'rest') continue;

    if (event.type === 'period-start') {
      periodStartDay = day;
      continue;
    }

    if (event.type === 'disrupt') {
      const td = toTrainingDisruption(event.disruption, day);
      activeDisruptions.push({
        disruption: event.disruption,
        startDay: day,
        asTrainingDisruption: td,
      });
      disruptionLog.push({
        day,
        disruption: event.disruption,
        resolvedDay: day + event.disruption.durationDays,
      });
      continue;
    }

    if (event.type === 'skip') {
      skippedDays++;
      if (sessionIndex < program.sessions.length) {
        const scaffold = program.sessions[sessionIndex];
        maybeResetWeek(scaffold.weekNumber);
        sessions.push(makeSkippedSession(day, scaffold, event.reason));
        sessionIndex++;
      }
      continue;
    }

    // type === 'train'
    if (sessionIndex >= program.sessions.length) continue;

    const scaffold = program.sessions[sessionIndex];
    sessionIndex++;

    // Reset weekly volume when scaffold week changes (not calendar week)
    maybeResetWeek(scaffold.weekNumber);

    // Determine cycle phase for female athletes
    let cyclePhase: CyclePhase | undefined;
    if (persona.biologicalSex === 'female' && periodStartDay !== null) {
      const dayInCycle = (day - periodStartDay) % cycleLength;
      cyclePhase = getCyclePhaseForDay(dayInCycle, cycleLength);
    }

    // Build soreness ratings
    const sorenessRatings: Partial<Record<MuscleGroup, SorenessLevel>> =
      event.soreness?.ratings ?? {};

    // Look up aux assignments for this block+lift
    const blockNum = scaffold.blockNumber ?? 1;
    const auxForSession = auxAssignments.find(
      (a: { blockNumber: number; lift: string }) =>
        a.blockNumber === blockNum && a.lift === scaffold.primaryLift
    );
    const activeAux: [string, string] = auxForSession
      ? [auxForSession.exercise1, auxForSession.exercise2]
      : ['Leg Press', 'Barbell Front Squat'];

    // Calculate session position within the week
    const sessionsThisWeek = program.sessions.filter(
      (s: SessionScaffold) => s.weekNumber === scaffold.weekNumber
    );
    const sessionPosInWeek = sessionsThisWeek.indexOf(scaffold) + 1;

    // Build JIT input
    const jitInput: JITInput = {
      sessionId: `sim-${day}`,
      weekNumber: scaffold.weekNumber,
      blockNumber: blockNum,
      primaryLift: scaffold.primaryLift,
      intensityType: scaffold.intensityType,
      oneRmKg: currentMaxes[scaffold.primaryLift],
      formulaConfig,
      sorenessRatings,
      weeklyVolumeToDate: { ...weeklyVolume },
      mrvMevConfig,
      activeAuxiliaries: activeAux,
      recentLogs: recentLogs.slice(-4),
      activeDisruptions: activeDisruptions.map((d) => d.asTrainingDisruption),
      warmupConfig: {
        type: 'preset',
        name:
          persona.biologicalSex === 'female' ? 'standard_female' : 'standard',
      },
      biologicalSex: persona.biologicalSex,
      userAge: persona.ageYears,
      barWeightKg: persona.barWeightKg ?? 20,
      auxiliaryPool: allAuxPool,
      allOneRmKg: { ...currentMaxes },
      sleepQuality: event.sleep,
      energyLevel: event.energy,
      cyclePhase,
      sessionIndex: sessionPosInWeek,
      totalSessionsThisWeek: sessionsThisWeek.length,
    };

    // Run JIT
    const jitOutput = generateJITSession(jitInput);

    // Simulate set-level failures and intra-session adaptations
    const setFailureRate = performanceModel.setFailureRate ?? 0;
    const failureRepReduction = performanceModel.failureRepReduction ?? 1;
    const adaptationsApplied: SimulatedSession['adaptationsApplied'] = [];
    let completedAllSets = true;

    if (setFailureRate > 0 && jitOutput.mainLiftSets.length > 0) {
      let consecutiveFailures = 0;
      let activeSets = [...jitOutput.mainLiftSets];

      for (let setIndex = 0; setIndex < activeSets.length; setIndex++) {
        // Use a deterministic failure check based on day + set index to avoid
        // random variance between runs while still distributing failures naturally
        const failureSeed =
          (day * 31 + setIndex * 7 + scaffold.weekNumber * 13) % 100;
        const setFailed = failureSeed < setFailureRate * 100;

        if (setFailed) {
          consecutiveFailures++;
          completedAllSets = false;

          // Build context for remaining sets (the sets after this one)
          const remainingSets = activeSets.slice(setIndex + 1);
          if (remainingSets.length > 0) {
            const ctx: IntraSessionContext = {
              completedSets: activeSets.slice(0, setIndex + 1).map((s) => ({
                planned_reps: s.reps,
                actual_reps: s.reps - failureRepReduction,
                weight_kg: s.weight_kg,
              })),
              remainingSets,
              consecutiveFailures,
              primaryLift: scaffold.primaryLift,
              oneRmKg: currentMaxes[scaffold.primaryLift],
              biologicalSex: persona.biologicalSex,
            };

            const adapted = adaptRemainingPlan(ctx);

            if (adapted.adaptationType !== 'none') {
              adaptationsApplied.push({
                afterSet: setIndex,
                adaptationType: adapted.adaptationType,
                rationale: adapted.rationale,
              });
              // Replace remaining sets in activeSets with the adapted plan
              activeSets = [
                ...activeSets.slice(0, setIndex + 1),
                ...adapted.sets,
              ];
            }
          }
        } else {
          consecutiveFailures = 0;
        }
      }
    }

    // Simulate athlete performance response
    const weekInBlock = getWeekInBlock(scaffold.weekNumber);
    const targetRpe = jitOutput.mainLiftSets[0]?.rpe_target ?? 7;
    const simulatedRpe = simulateRpe(targetRpe, weekInBlock, performanceModel);

    // Update weekly volume tracking
    const completedSetLogs = buildCompletedSetLogs(
      scaffold.primaryLift,
      jitOutput
    );
    for (const log of completedSetLogs) {
      const muscles = getMusclesForLift(log.lift, log.exercise);
      for (const { muscle, contribution } of muscles) {
        weeklyVolume[muscle] =
          (weeklyVolume[muscle] ?? 0) + log.completedSets * contribution;
      }
    }

    const volumeStatus = classifyVolumeStatus(
      weeklyVolume as Record<MuscleGroup, number>,
      mrvMevConfig
    );

    // Record simulated RPE for next session's adjustment
    recentLogs.push({ actual_rpe: simulatedRpe, target_rpe: targetRpe });

    sessions.push({
      day,
      weekNumber: scaffold.weekNumber,
      dayNumber: scaffold.dayNumber,
      primaryLift: scaffold.primaryLift,
      intensityType: scaffold.intensityType,
      blockNumber: scaffold.blockNumber,
      isDeload: scaffold.isDeload,
      jitOutput,
      mainLiftSets: jitOutput.mainLiftSets,
      warmupSets: jitOutput.warmupSets,
      auxiliaryWork: jitOutput.auxiliaryWork,
      simulatedRpe,
      completedAllSets,
      sorenessRatings,
      sleepQuality: event.sleep,
      energyLevel: event.energy,
      cyclePhase,
      weeklyVolumeSnapshot: { ...weeklyVolume },
      volumeStatusSnapshot: volumeStatus as Partial<
        Record<MuscleGroup, import('@parakeet/training-engine').VolumeStatus>
      >,
      adaptationsApplied:
        adaptationsApplied.length > 0 ? adaptationsApplied : undefined,
      skipped: false,
    });

    // Apply 1RM gains at end of each 3-week block (not deload)
    if (weekInBlock === 3 && scaffold.dayNumber === 3) {
      for (const lift of ['squat', 'bench', 'deadlift'] as Lift[]) {
        currentMaxes[lift] *= 1 + performanceModel.oneRmGainPerCycle;
        currentMaxes[lift] = Math.round(currentMaxes[lift] * 10) / 10;
      }
    }
  }

  return {
    persona,
    script,
    totalDays,
    totalWeeks,
    sessions,
    skippedDays,
    disruptions: disruptionLog,
    oneRmProgression,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function simulateRpe(
  targetRpe: number,
  weekInBlock: number,
  model: PerformanceModelConfig
): number {
  const fatigue = (weekInBlock - 1) * model.rpeFatiguePerWeek;
  const rpe = targetRpe + model.rpeDeviation + fatigue;
  return Math.max(5, Math.min(10, Math.round(rpe * 10) / 10));
}

function makeSkippedSession(
  day: number,
  scaffold: SessionScaffold,
  reason?: string
): SimulatedSession {
  return {
    day,
    weekNumber: scaffold.weekNumber,
    dayNumber: scaffold.dayNumber,
    primaryLift: scaffold.primaryLift,
    intensityType: scaffold.intensityType,
    blockNumber: scaffold.blockNumber,
    isDeload: scaffold.isDeload,
    jitOutput: {
      sessionId: `sim-${day}-skipped`,
      generatedAt: new Date(),
      mainLiftSets: [],
      warmupSets: [],
      auxiliaryWork: [],
      volumeModifier: 0,
      intensityModifier: 0,
      rationale: ['Session skipped'],
      warnings: [],
      skippedMainLift: true,
      restRecommendations: { mainLift: [], auxiliary: [] },
    },
    mainLiftSets: [],
    warmupSets: [],
    auxiliaryWork: [],
    simulatedRpe: 0,
    completedAllSets: false,
    sorenessRatings: {},
    weeklyVolumeSnapshot: {},
    volumeStatusSnapshot: {},
    skipped: true,
    skipReason: reason,
  };
}

function buildCompletedSetLogs(
  primaryLift: Lift,
  jitOutput: {
    mainLiftSets: Array<{ rpe_target?: number }>;
    auxiliaryWork: Array<{
      exercise: string;
      sets: unknown[];
      skipped: boolean;
    }>;
  }
): CompletedSetLog[] {
  const logs: CompletedSetLog[] = [];

  if (jitOutput.mainLiftSets.length > 0) {
    logs.push({
      lift: primaryLift,
      completedSets: jitOutput.mainLiftSets.length,
    });
  }

  for (const aux of jitOutput.auxiliaryWork) {
    if (aux.skipped) continue;
    logs.push({
      lift: primaryLift,
      completedSets: aux.sets.length,
      exercise: aux.exercise,
    });
  }

  return logs;
}

function toTrainingDisruption(
  event: DisruptionEvent,
  day: number
): TrainingDisruption {
  const now = new Date('2026-01-05');
  now.setDate(now.getDate() + day);
  const endDate = new Date(now);
  endDate.setDate(endDate.getDate() + event.durationDays);

  return {
    id: `sim-disruption-${day}`,
    user_id: 'sim-user',
    program_id: 'sim-program',
    session_ids_affected: null,
    reported_at: now.toISOString(),
    disruption_type: event.type,
    severity: event.severity,
    affected_date_start: now.toISOString().split('T')[0],
    affected_date_end: endDate.toISOString().split('T')[0],
    affected_lifts: event.affectedLifts ?? null,
    description: event.description ?? null,
    adjustment_applied: null,
    resolved_at: null,
    status: 'active',
  };
}
