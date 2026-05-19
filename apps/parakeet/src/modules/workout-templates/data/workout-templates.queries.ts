// @spec docs/features/workout-templates/spec-schema.md
import { queryOptions, skipToken } from '@tanstack/react-query';

import {
  fetchWorkoutTemplateDetail,
  fetchWorkoutTemplates,
} from './workout-templates.repository';

export const workoutTemplatesQueries = {
  all: () => ['workout-templates'] as const,

  list: () =>
    queryOptions({
      queryKey: [...workoutTemplatesQueries.all(), 'list'] as const,
      queryFn: fetchWorkoutTemplates,
    }),

  detail: (templateId: string | undefined) =>
    queryOptions({
      queryKey: [
        ...workoutTemplatesQueries.all(),
        'detail',
        templateId,
      ] as const,
      queryFn: templateId
        ? () => fetchWorkoutTemplateDetail(templateId)
        : skipToken,
    }),
};
