// @spec docs/features/workout-templates/spec-schema.md

export interface WorkoutTemplate {
  id: string;
  name: string;
  description: string | null;
  rounds: number;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkoutTemplateItem {
  id: string;
  template_id: string;
  position: number;
  exercise: string;
  duration_seconds: number | null;
  reps: number | null;
  rest_after_seconds: number;
}

export interface WorkoutTemplateWithItems extends WorkoutTemplate {
  items: WorkoutTemplateItem[];
}

export interface WorkoutTemplateListEntry extends WorkoutTemplate {
  item_count: number;
}

export interface CreateWorkoutTemplateInput {
  name: string;
  description?: string | null;
  rounds: number;
}

export interface UpdateWorkoutTemplateInput {
  name?: string;
  description?: string | null;
  rounds?: number;
}

export interface WorkoutTemplateItemInput {
  position: number;
  exercise: string;
  duration_seconds: number | null;
  reps: number | null;
  rest_after_seconds: number;
}
