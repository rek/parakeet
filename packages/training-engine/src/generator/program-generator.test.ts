import type { IntensityTypeSignals } from '../cube/scheduler';
import { selectIntensityTypeForUnending } from '../cube/scheduler';
import {
  computeNextUnendingLift,
  generateProgram,
  nextUnendingSession,
} from './program-generator';

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

  it('week 4: deload inherits the block it follows (block 1)', () => {
    const week4 = result.sessions.filter((s) => s.weekNumber === 4);
    expect(week4).toHaveLength(3);
    week4.forEach((s) => {
      expect(s.isDeload).toBe(true);
      expect(s.intensityType).toBe('deload');
      expect(s.blockNumber).toBe(1);
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

  it('week 10: all 3 sessions are deload, inheriting block 3', () => {
    const week10 = result.sessions.filter((s) => s.weekNumber === 10);
    expect(week10).toHaveLength(3);
    week10.forEach((s) => {
      expect(s.isDeload).toBe(true);
      expect(s.intensityType).toBe('deload');
      expect(s.blockNumber).toBe(3);
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

describe('nextUnendingSession — history-based lift rotation', () => {
  const base = { sessionCounter: 5, trainingDaysPerWeek: 3 };

  it('after squat → bench', () => {
    const result = nextUnendingSession({ ...base, lastResolvedLift: 'squat' });
    expect(result.primaryLift).toBe('bench');
  });

  it('after bench → deadlift', () => {
    const result = nextUnendingSession({ ...base, lastResolvedLift: 'bench' });
    expect(result.primaryLift).toBe('deadlift');
  });

  it('after deadlift → squat', () => {
    const result = nextUnendingSession({
      ...base,
      lastResolvedLift: 'deadlift',
    });
    expect(result.primaryLift).toBe('squat');
  });

  it('null lastResolvedLift falls back to counter-based', () => {
    // counter=5, 5%3=2, LIFT_ORDER[2]='deadlift'
    const result = nextUnendingSession({ ...base, lastResolvedLift: null });
    expect(result.primaryLift).toBe('deadlift');
  });

  it('undefined lastResolvedLift falls back to counter-based', () => {
    const result = nextUnendingSession({
      sessionCounter: 0,
      trainingDaysPerWeek: 3,
    });
    expect(result.primaryLift).toBe('squat');
  });

  it('intensity type uses history-derived lift, not counter-derived', () => {
    // counter=0 would give squat (counter-based), but lastResolvedLift=squat → bench
    // Week 1 bench intensity from CUBE_ROTATION: 'rep'
    const result = nextUnendingSession({
      sessionCounter: 0,
      trainingDaysPerWeek: 3,
      lastResolvedLift: 'squat',
    });
    expect(result.primaryLift).toBe('bench');
    expect(result.intensityType).toBe('rep'); // week 1 bench = rep
  });

  it('counter still drives weekNumber/blockNumber/isDeload', () => {
    // counter=9, 3 days/week → week 4 (deload)
    const result = nextUnendingSession({
      sessionCounter: 9,
      trainingDaysPerWeek: 3,
      lastResolvedLift: 'bench',
    });
    expect(result.weekNumber).toBe(4);
    expect(result.isDeload).toBe(true);
    expect(result.intensityType).toBe('deload');
    expect(result.primaryLift).toBe('deadlift');
  });
});

describe('computeNextUnendingLift', () => {
  it('after squat → bench', () => {
    expect(
      computeNextUnendingLift({
        sessionCounter: 0,
        trainingDaysPerWeek: 3,
        lastResolvedLift: 'squat',
      })
    ).toBe('bench');
  });
  it('after bench → deadlift', () => {
    expect(
      computeNextUnendingLift({
        sessionCounter: 0,
        trainingDaysPerWeek: 3,
        lastResolvedLift: 'bench',
      })
    ).toBe('deadlift');
  });
  it('after deadlift → squat', () => {
    expect(
      computeNextUnendingLift({
        sessionCounter: 0,
        trainingDaysPerWeek: 3,
        lastResolvedLift: 'deadlift',
      })
    ).toBe('squat');
  });
  it('null falls back to counter', () => {
    // counter=1, daysPerWeek=3 → 1%3=1 → LIFTS[1%3] = bench
    expect(
      computeNextUnendingLift({
        sessionCounter: 1,
        trainingDaysPerWeek: 3,
        lastResolvedLift: null,
      })
    ).toBe('bench');
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
    expect(
      selectIntensityTypeForUnending('squat', 4, {
        ...noSignals,
        primaryMuscleSoreness: 9,
        daysSinceLastSession: 14,
      })
    ).toBe('deload');
  });

  it('soreness >= 7 → rep', () => {
    expect(
      selectIntensityTypeForUnending('squat', 1, {
        ...noSignals,
        primaryMuscleSoreness: 7,
      })
    ).toBe('rep');
    expect(
      selectIntensityTypeForUnending('squat', 1, {
        ...noSignals,
        primaryMuscleSoreness: 6,
      })
    ).not.toBe('rep');
  });

  it('days >= 10 → heavy', () => {
    expect(
      selectIntensityTypeForUnending('bench', 1, {
        ...noSignals,
        daysSinceLastSession: 10,
      })
    ).toBe('heavy');
  });

  it('avg RPE >= 8.5 → explosive', () => {
    expect(
      selectIntensityTypeForUnending('deadlift', 1, {
        ...noSignals,
        recentRpe: [9, 8, 9],
      })
    ).toBe('explosive');
    expect(
      selectIntensityTypeForUnending('deadlift', 1, {
        ...noSignals,
        recentRpe: [8, 8, 8],
      })
    ).not.toBe('explosive');
  });

  it('avoids repeating last intensity type: heavy → explosive', () => {
    expect(
      selectIntensityTypeForUnending('squat', 1, {
        ...noSignals,
        lastIntensityType: 'heavy',
      })
    ).toBe('explosive');
  });

  it('avoids repeating last intensity type: explosive → rep', () => {
    expect(
      selectIntensityTypeForUnending('squat', 1, {
        ...noSignals,
        lastIntensityType: 'explosive',
      })
    ).toBe('rep');
  });

  it('avoids repeating last intensity type: rep → heavy', () => {
    expect(
      selectIntensityTypeForUnending('squat', 1, {
        ...noSignals,
        lastIntensityType: 'rep',
      })
    ).toBe('heavy');
  });

  it('lastIntensityType=deload treated as null — falls to default', () => {
    expect(
      selectIntensityTypeForUnending('squat', 1, {
        ...noSignals,
        lastIntensityType: 'deload',
      })
    ).toBe('heavy');
  });

  it('default with no signals → heavy', () => {
    expect(selectIntensityTypeForUnending('squat', 1, noSignals)).toBe('heavy');
  });

  it('null soreness does not trigger rule 2', () => {
    expect(
      selectIntensityTypeForUnending('squat', 1, {
        ...noSignals,
        primaryMuscleSoreness: null,
      })
    ).toBe('heavy');
  });

  it('empty recentRpe does not trigger rule 4', () => {
    expect(
      selectIntensityTypeForUnending('squat', 1, {
        ...noSignals,
        recentRpe: [],
      })
    ).toBe('heavy');
  });

  it('intensitySignals wired through nextUnendingSession', () => {
    const result = nextUnendingSession({
      sessionCounter: 0,
      trainingDaysPerWeek: 3,
      lastResolvedLift: null,
      intensitySignals: {
        primaryMuscleSoreness: 8,
        daysSinceLastSession: null,
        recentRpe: [],
        lastIntensityType: null,
      },
    });
    expect(result.intensityType).toBe('rep');
  });
});
