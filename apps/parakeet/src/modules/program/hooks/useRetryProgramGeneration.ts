// @spec docs/features/programs/spec-generation-api.md
import { useAuth } from '@modules/auth';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { regenerateProgram } from '../application/program.service';
import { programQueries } from '../data/program.queries';

// SYNC: Mirrors sessionQueries.all() in @modules/session/data/session.queries.ts.
// Inlined to avoid circular dependency: program -> session -> program.
const SESSION_QUERY_KEY = ['session'] as const;

const VALID_TOTAL_WEEKS = [10, 12, 14] as const;
const VALID_TRAINING_DAYS_PER_WEEK = [3, 4] as const;

type ValidTotalWeeks = (typeof VALID_TOTAL_WEEKS)[number];
type ValidTrainingDaysPerWeek = (typeof VALID_TRAINING_DAYS_PER_WEEK)[number];

/**
 * Retry program generation for a scheduled program that ended up with no
 * sessions (e.g. transient failure during the original create).
 *
 * Note: "retry" here is archive-and-rebuild semantics, not in-place — the
 * existing active program is archived and a fresh row is inserted with the
 * same parameters and `version + 1`. The empty placeholder tile on the
 * Program screen taps into this so the user can recover without redoing
 * onboarding.
 */
export function useRetryProgramGeneration() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { mutate: retryGeneration, isPending } = useMutation({
    mutationFn: async (program: {
      total_weeks: number | null;
      training_days_per_week: number;
      training_days?: number[] | null;
      start_date?: string | null;
    }) => {
      if (!program.total_weeks) {
        throw new Error('Cannot retry generation for non-scheduled program');
      }
      // Narrow the DB number to the engine's accepted enum at the boundary
      // instead of casting blindly. A program row with total_weeks: 9 (or any
      // out-of-spec value introduced by an old migration) should fail loudly
      // here rather than feed a lying type into the engine.
      if (
        !VALID_TOTAL_WEEKS.includes(program.total_weeks as ValidTotalWeeks)
      ) {
        throw new Error(
          `Unsupported total_weeks=${program.total_weeks} for program regeneration`
        );
      }
      if (
        !VALID_TRAINING_DAYS_PER_WEEK.includes(
          program.training_days_per_week as ValidTrainingDaysPerWeek
        )
      ) {
        throw new Error(
          `Unsupported training_days_per_week=${program.training_days_per_week}`
        );
      }
      return regenerateProgram({
        totalWeeks: program.total_weeks as ValidTotalWeeks,
        trainingDaysPerWeek:
          program.training_days_per_week as ValidTrainingDaysPerWeek,
        startDate: program.start_date
          ? new Date(program.start_date)
          : new Date(),
        trainingDays: program.training_days ?? undefined,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: programQueries.active(user?.id).queryKey,
      });
      await queryClient.invalidateQueries({ queryKey: SESSION_QUERY_KEY });
    },
  });

  return { retryGeneration, isPending };
}
