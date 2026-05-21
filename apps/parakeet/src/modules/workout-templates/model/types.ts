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
  /** Display name as entered by the template creator. Snapshot — catalog
   *  renames flow through `exercise_slug` lookup at render time. */
  exercise: string;
  /** Stable catalog identifier. Always populated; for non-catalog (user-typed)
   *  exercises this is `slugify(exercise)`. */
  exercise_slug: string;
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
  /** Optional in the editor input shape — slug is derived server-side at insert
   *  time. When present (e.g. items loaded from an existing template), it lets
   *  the row resolve display via catalog. */
  exercise_slug?: string;
  duration_seconds: number | null;
  reps: number | null;
  rest_after_seconds: number;
}
