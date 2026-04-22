import { getExerciseSubtitle } from './exercise-lookup';

describe('getExerciseSubtitle', () => {
  it('returns subtitle for a Title Case catalog name', () => {
    expect(getExerciseSubtitle('Rack Pull')).toBe('Above the knee');
  });

  it('returns subtitle for a snake_case name', () => {
    expect(getExerciseSubtitle('rack_pull')).toBe('Above the knee');
  });

  it('returns subtitle for Rack Pull Below Knee', () => {
    expect(getExerciseSubtitle('Rack Pull Below Knee')).toBe('Below the knee');
  });

  it('returns undefined for an exercise with no subtitle', () => {
    expect(getExerciseSubtitle('Romanian Deadlift')).toBeUndefined();
  });

  it('returns undefined for an unknown exercise', () => {
    expect(getExerciseSubtitle('Mystery Move')).toBeUndefined();
  });
});
