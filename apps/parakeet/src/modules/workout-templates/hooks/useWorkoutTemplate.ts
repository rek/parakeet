// @spec docs/features/workout-templates/spec-schema.md
import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import {
  replaceWorkoutTemplateItems,
  updateWorkoutTemplate,
} from '../data/workout-templates.repository';
import { workoutTemplatesQueries } from '../data/workout-templates.queries';
import type {
  UpdateWorkoutTemplateInput,
  WorkoutTemplateItemInput,
} from '../model/types';

export function useWorkoutTemplate(templateId: string | undefined) {
  return useQuery(workoutTemplatesQueries.detail(templateId));
}

export function useUpdateWorkoutTemplate(templateId: string) {
  const queryClient = useQueryClient();
  const { mutateAsync, isPending } = useMutation({
    mutationFn: (patch: UpdateWorkoutTemplateInput) =>
      updateWorkoutTemplate(templateId, patch),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: workoutTemplatesQueries.all(),
      });
    },
  });
  return { updateTemplate: mutateAsync, isPending };
}

interface ReplaceItemsArgs {
  templateId: string;
  items: WorkoutTemplateItemInput[];
}

export function useReplaceWorkoutTemplateItems() {
  const queryClient = useQueryClient();
  const { mutateAsync, isPending } = useMutation({
    mutationFn: ({ templateId, items }: ReplaceItemsArgs) =>
      replaceWorkoutTemplateItems(templateId, items),
    onSuccess: async (_data, { templateId }) => {
      await queryClient.invalidateQueries({
        queryKey: workoutTemplatesQueries.detail(templateId).queryKey,
      });
      await queryClient.invalidateQueries({
        queryKey: workoutTemplatesQueries.list().queryKey,
      });
    },
  });
  return { replaceItems: mutateAsync, isPending };
}
