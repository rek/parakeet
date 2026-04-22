import {
  computeNextUnendingLift,
  generateAuxiliaryAssignments,
  generateProgram,
  nextUnendingSession,
} from './program-generator';
import type { IntensityTypeSignals } from '../cube/scheduler';
import { selectIntensityTypeForUnending } from '../cube/scheduler';

const START_DATE = new Date('2026-01-05'); // Monday

describe('generateProgram — 10-week 3-day', () => {
  const result = generateProgram({
    totalWeeks: 10,
    trainingDaysPerWeek: 3,
    startDate: START_DATE,
  });

  it('produces 30 session scaffolds (10 weeks × 3 days)', () => {
    expect(result.sessions).toHaveLength(30);
  });

  it('all plannedSets are null', () => {
    result.sessions.forEach((s) => expect(s.plannedSets).toBeNull());
  });

  it('all jitGeneratedAt are null', () => {
    result.sessions.forEach((s) => expect(s.jitGeneratedAt).toBeNull());
  });

  it('week 1: squat/heavy, bench/rep, deadlift/explosive', () => {
    const week1 = result.sessions.filter((s) => s.weekNumber === 1);
    expect(week1).toHaveLength(3);
    expect(week1[0]).toMatchObject({
      primaryLift: 'squat',
      intensityType: 'heavy',
      blockNumber: 1,
      isDeload: false,
    });
    expect(week1[1]).toMatchObject({
      primaryLift: 'bench',
      intensityType: 'rep',
      blockNumber: 1,
      isDeload: false,
    });
    expect(week1[2]).toMatchObject({
      primaryLift: 'deadlift',
      intensityType: 'explosive',
      blockNumber: 1,
      isDeload: false,
    });
  });

  it('week 4: deload (every 4th week)', () => {
    const week4 = result.sessions.filter((s) => s.weekNumber === 4);
    expect(week4).toHaveLength(3);
    week4.forEach((s) => {
      expect(s.isDeload).toBe(true);
      expect(s.intensityType).toBe('deload');
      expect(s.blockNumber).toBeNull();
    });
  });

  it('week 5 (first week of block 2): squat/heavy, bench/rep, deadlift/explosive', () => {
    const week5 = result.sessions.filter((s) => s.weekNumber === 5);
    expect(week5[0]).toMatchObject({
      primaryLift: 'squat',
      intensityType: 'heavy',
      blockNumber: 2,
      isDeload: false,
    });
    expect(week5[1]).toMatchObject({
      primaryLift: 'bench',
      intensityType: 'rep',
      blockNumber: 2,
      isDeload: false,
    });
    expect(week5[2]).toMatchObject({
      primaryLift: 'deadlift',
      intensityType: 'explosive',
      blockNumber: 2,
      isDeload: false,
    });
  });

  it('week 10: all 3 sessions are deload', () => {
    const week10 = result.sessions.filter((s) => s.weekNumber === 10);
    expect(week10).toHaveLength(3);
    week10.forEach((s) => {
      expect(s.isDeload).toBe(true);
      expect(s.intensityType).toBe('deload');
      expect(s.blockNumber).toBeNull();
    });
  });

  it('day numbers are assigned 1-3 within each week', () => {
    const week1 = result.sessions.filter((s) => s.weekNumber === 1);
    expect(week1.map((s) => s.dayNumber)).toEqual([1, 2, 3]);
  });

  it('plannedDate advances correctly week over week', () => {
    const day1Dates = result.sessions
      .filter((s) => s.dayNumber === 1)
      .map((s) => s.plannedDate.toISOString().slice(0, 10));
    // Week 1 day 1 = 2026-01-05, Week 2 day 1 = 2026-01-12 (+7)
    expect(day1Dates[0]).toBe('2026-01-05');
    expect(day1Dates[1]).toBe('2026-01-12');
  });
});

describe('generateAuxiliaryAssignments', () => {
  const pool = {
    squat: [
      'pause squat',
      'front squat',
      'goblet squat',
      'box squat',
      'tempo squat',
      'belt squat',
    ],
    bench: [
      'close grip bench',
      'incline bench',
      'dumbbell press',
      'floor press',
      'pin press',
      'board press',
    ],
    deadlift: [
      'rdl',
      'deficit pull',
      'rack pull',
      'sumo pull',
      'snatch grip',
      'block pull',
    ],
  };

  // 9 weeks → ceil(8/3) = 3 blocks → 9 assignments
  const assignments = generateAuxiliaryAssignments(9, pool);

  it('produces 9 assignments for a 9-week program (3 blocks × 3 lifts)', () => {
    expect(assignments).toHaveLength(9);
  });

  it('block 1 squat picks pool positions 0 and 1', () => {
    const a = assignments.find(
      (x) => x.blockNumber === 1 && x.lift === 'squat'
    );
    expect(a?.exercise1).toBe('pause squat');
    expect(a?.exercise2).toBe('front squat');
  });

  it('block 2 squat picks pool positions 2 and 3', () => {
    const a = assignments.find(
      (x) => x.blockNumber === 2 && x.lift === 'squat'
    );
    expect(a?.exercise1).toBe('goblet squat');
    expect(a?.exercise2).toBe('box squat');
  });

  it('block 3 squat picks pool positions 4 and 5', () => {
    const a = assignments.find(
      (x) => x.blockNumber === 3 && x.lift === 'squat'
    );
    expect(a?.exercise1).toBe('tempo squat');
    expect(a?.exercise2).toBe('belt squat');
  });

  it('wraps around when pool is smaller than 6', () => {
    const smallPool = { squat: ['A', 'B', 'C'] };
    const result = generateAuxiliaryAssignments(9, smallPool);
    const b3 = result.find((x) => x.blockNumber === 3 && x.lift === 'squat');
    // blockIndex=2, pos1=(4%3)=1, pos2=(5%3)=2 → B, C
    expect(b3?.exercise1).toBe('B');
    expect(b3?.exercise2).toBe('C');
  });

  it('produces 12 assignments for a 12-week program (4 blocks × 3 lifts)', () => {
    const result = generateAuxiliaryAssignments(12, pool);
    expect(result).toHaveLength(12);
    const blockNums = [...new Set(result.map((r) => r.blockNumber))].sort();
    expect(blockNums).toEqual([1, 2, 3, 4]);
  });

  it('skips lifts with fewer than 2 exercises in pool', () => {
    const result = generateAuxiliaryAssignments(9, { squat: ['only one'] });
    expect(result).toHaveLength(0);
  });
});

describe('nextUnendingSession — history-based lift rotation', () => {
  const base = { sessionCounter: 5, trainingDaysPerWeek: 3 };

  it('after squat → bench', () => {
    const result = nextUnendingSession({ ...base, lastCompletedLift: 'squat' });
    expect(result.primaryLift).toBe('bench');
  });

  it('after bench → deadlift', () => {
    const result = nextUnendingSession({ ...base, lastCompletedLift: 'bench' });
    expect(result.primaryLift).toBe('deadlift');
  });

  it('after deadlift → squat', () => {
    const result = nextUnendingSession({
      ...base,
      lastCompletedLift: 'deadlift',
    });
    expect(result.primaryLift).toBe('squat');
  });

  it('null lastCompletedLift falls back to counter-based', () => {
    // counter=5, 5%3=2, LIFT_ORDER[2]='deadlift'
    const result = nextUnendingSession({ ...base, lastCompletedLift: null });
    expect(result.primaryLift).toBe('deadlift');
  });

  it('undefined lastCompletedLift falls back to counter-based', () => {
    const result = nextUnendingSession({
      sessionCounter: 0,
      trainingDaysPerWeek: 3,
    });
    expect(result.primaryLift).toBe('squat');
  });

  it('intensity type uses history-derived lift, not counter-derived', () => {
    // counter=0 would give squat (counter-based), but lastCompletedLift=squat → bench
    // Week 1 bench intensity from CUBE_ROTATION: 'rep'
    const result = nextUnendingSession({
      sessionCounter: 0,
      trainingDaysPerWeek: 3,
      lastCompletedLift: 'squat',
    });
    expect(result.primaryLift).toBe('bench');
    expect(result.intensityType).toBe('rep'); // week 1 bench = rep
  });

  it('counter still drives weekNumber/blockNumber/isDeload', () => {
    // counter=9, 3 days/week → week 4 (deload)
    const result = nextUnendingSession({
      sessionCounter: 9,
      trainingDaysPerWeek: 3,
      lastCompletedLift: 'bench',
    });
    expect(result.weekNumber).toBe(4);
    expect(result.isDeload).toBe(true);
    expect(result.intensityType).toBe('deload');
    expect(result.primaryLift).toBe('deadlift');
  });
});

describe('computeNextUnendingLift', () => {
  it('after squat → bench', () => {
    expect(computeNextUnendingLift({ sessionCounter: 0, trainingDaysPerWeek: 3, lastCompletedLift: 'squat' })).toBe('bench');
  });
  it('after bench → deadlift', () => {
    expect(computeNextUnendingLift({ sessionCounter: 0, trainingDaysPerWeek: 3, lastCompletedLift: 'bench' })).toBe('deadlift');
  });
  it('after deadlift → squat', () => {
    expect(computeNextUnendingLift({ sessionCounter: 0, trainingDaysPerWeek: 3, lastCompletedLift: 'deadlift' })).toBe('squat');
  });
  it('null falls back to counter', () => {
    // counter=1, daysPerWeek=3 → 1%3=1 → LIFTS[1%3] = bench
    expect(computeNextUnendingLift({ sessionCounter: 1, trainingDaysPerWeek: 3, lastCompletedLift: null })).toBe('bench');
  });
});

describe('selectIntensityTypeForUnending', () => {
  const noSignals: IntensityTypeSignals = {
    primaryMuscleSoreness: null,
    daysSinceLastSession: null,
    recentRpe: [],
    lastIntensityType: null,
  };

  it('deload week overrides all other signals', () => {
    expect(selectIntensityTypeForUnending('squat', 4, { ...noSignals, primaryMuscleSoreness: 9, daysSinceLastSession: 14 })).toBe('deload');
  });

  it('soreness >= 7 → rep', () => {
    expect(selectIntensityTypeForUnending('squat', 1, { ...noSignals, primaryMuscleSoreness: 7 })).toBe('rep');
    expect(selectIntensityTypeForUnending('squat', 1, { ...noSignals, primaryMuscleSoreness: 6 })).not.toBe('rep');
  });

  it('days >= 10 → heavy', () => {
    expect(selectIntensityTypeForUnending('bench', 1, { ...noSignals, daysSinceLastSession: 10 })).toBe('heavy');
  });

  it('avg RPE >= 8.5 → explosive', () => {
    expect(selectIntensityTypeForUnending('deadlift', 1, { ...noSignals, recentRpe: [9, 8, 9] })).toBe('explosive');
    expect(selectIntensityTypeForUnending('deadlift', 1, { ...noSignals, recentRpe: [8, 8, 8] })).not.toBe('explosive');
  });

  it('avoids repeating last intensity type: heavy → explosive', () => {
    expect(selectIntensityTypeForUnending('squat', 1, { ...noSignals, lastIntensityType: 'heavy' })).toBe('explosive');
  });

  it('avoids repeating last intensity type: explosive → rep', () => {
    expect(selectIntensityTypeForUnending('squat', 1, { ...noSignals, lastIntensityType: 'explosive' })).toBe('rep');
  });

  it('avoids repeating last intensity type: rep → heavy', () => {
    expect(selectIntensityTypeForUnending('squat', 1, { ...noSignals, lastIntensityType: 'rep' })).toBe('heavy');
  });

  it('lastIntensityType=deload treated as null — falls to default', () => {
    expect(selectIntensityTypeForUnending('squat', 1, { ...noSignals, lastIntensityType: 'deload' })).toBe('heavy');
  });

  it('default with no signals → heavy', () => {
    expect(selectIntensityTypeForUnending('squat', 1, noSignals)).toBe('heavy');
  });

  it('null soreness does not trigger rule 2', () => {
    expect(selectIntensityTypeForUnending('squat', 1, { ...noSignals, primaryMuscleSoreness: null })).toBe('heavy');
  });

  it('empty recentRpe does not trigger rule 4', () => {
    expect(selectIntensityTypeForUnending('squat', 1, { ...noSignals, recentRpe: [] })).toBe('heavy');
  });

  it('intensitySignals wired through nextUnendingSession', () => {
    const result = nextUnendingSession({
      sessionCounter: 0,
      trainingDaysPerWeek: 3,
      lastCompletedLift: null,
      intensitySignals: { primaryMuscleSoreness: 8, daysSinceLastSession: null, recentRpe: [], lastIntensityType: null },
    });
    expect(result.intensityType).toBe('rep');
  });
});
