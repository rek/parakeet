// @spec docs/features/workout-templates/spec-schema.md
import { getCatalogEntry, slugify } from '@parakeet/training-engine';
import { typedSupabase } from '@platform/supabase';

import type {
  CreateWorkoutTemplateInput,
  UpdateWorkoutTemplateInput,
  WorkoutTemplateItem,
  WorkoutTemplateItemInput,
  WorkoutTemplateListEntry,
  WorkoutTemplateWithItems,
} from '../model/types';

function resolveTemplateExerciseSlug(name: string): string {
  return getCatalogEntry(name)?.slug ?? slugify(name);
}

export async function fetchWorkoutTemplates(): Promise<
  WorkoutTemplateListEntry[]
> {
  const { data, error } = await typedSupabase
    .from('workout_templates')
    .select(
      'id, name, description, rounds, created_by, updated_by, created_at, updated_at, workout_template_items(count)'
    )
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    rounds: row.rounds,
    created_by: row.created_by,
    updated_by: row.updated_by,
    created_at: row.created_at,
    updated_at: row.updated_at,
    item_count: row.workout_template_items[0]?.count ?? 0,
  }));
}

export async function fetchWorkoutTemplateDetail(
  templateId: string
): Promise<WorkoutTemplateWithItems | null> {
  const { data, error } = await typedSupabase
    .from('workout_templates')
    .select(
      'id, name, description, rounds, created_by, updated_by, created_at, updated_at, workout_template_items(id, template_id, position, exercise, exercise_slug, duration_seconds, reps, rest_after_seconds)'
    )
    .eq('id', templateId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const items: WorkoutTemplateItem[] = [...data.workout_template_items].sort(
    (a, b) => a.position - b.position
  );
  return {
    id: data.id,
    name: data.name,
    description: data.description,
    rounds: data.rounds,
    created_by: data.created_by,
    updated_by: data.updated_by,
    created_at: data.created_at,
    updated_at: data.updated_at,
    items,
  };
}

export async function insertWorkoutTemplate(
  input: CreateWorkoutTemplateInput
): Promise<string> {
  const { data, error } = await typedSupabase
    .from('workout_templates')
    .insert({
      name: input.name,
      description: input.description ?? null,
      rounds: input.rounds,
    })
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}

export async function updateWorkoutTemplate(
  templateId: string,
  patch: UpdateWorkoutTemplateInput
): Promise<void> {
  const { error } = await typedSupabase
    .from('workout_templates')
    .update(patch)
    .eq('id', templateId);
  if (error) throw error;
}

export async function deleteWorkoutTemplate(templateId: string): Promise<void> {
  const { error } = await typedSupabase
    .from('workout_templates')
    .delete()
    .eq('id', templateId);
  if (error) throw error;
}

export async function replaceWorkoutTemplateItems(
  templateId: string,
  items: WorkoutTemplateItemInput[]
): Promise<void> {
  const { error: deleteError } = await typedSupabase
    .from('workout_template_items')
    .delete()
    .eq('template_id', templateId);
  if (deleteError) throw deleteError;
  if (items.length === 0) return;
  const { error: insertError } = await typedSupabase
    .from('workout_template_items')
    .insert(
      items.map((item) => ({
        template_id: templateId,
        position: item.position,
        exercise: item.exercise,
        exercise_slug: resolveTemplateExerciseSlug(item.exercise),
        duration_seconds: item.duration_seconds,
        reps: item.reps,
        rest_after_seconds: item.rest_after_seconds,
      }))
    );
  if (insertError) throw insertError;
}
