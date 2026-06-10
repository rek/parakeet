// @spec docs/features/workout-templates/spec-schema.md
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { workoutTemplatesQueries } from '../data/workout-templates.queries';
import {
  deleteWorkoutTemplate,
  insertWorkoutTemplate,
} from '../data/workout-templates.repository';
import type { CreateWorkoutTemplateInput } from '../model/types';

export function useWorkoutTemplates() {
  return useQuery(workoutTemplatesQueries.list());
}

export function useCreateWorkoutTemplate() {
  const queryClient = useQueryClient();
  const { mutateAsync, isPending } = useMutation({
    mutationFn: (input: CreateWorkoutTemplateInput) =>
      insertWorkoutTemplate(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: workoutTemplatesQueries.list().queryKey,
      });
    },
  });
  return { createTemplate: mutateAsync, isPending };
}

export function useDeleteWorkoutTemplate() {
  const queryClient = useQueryClient();
  const { mutateAsync, isPending } = useMutation({
    mutationFn: (templateId: string) => deleteWorkoutTemplate(templateId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: workoutTemplatesQueries.all(),
      });
    },
  });
  return { deleteTemplate: mutateAsync, isPending };
}
