import type {
  ActualSet,
  IntensityType,
  Lift,
  Program,
  Session,
} from '@parakeet/shared-types';
import type { DbRow } from '@platform/supabase';

export type SessionStatus = Session['status'];

export type SessionRow = DbRow<'sessions'>;
export type ProgramRow = DbRow<'programs'>;

export interface ProgramSessionView {
  id: string;
  week_number: number;
  day_number: number;
  primary_lift: Lift;
  intensity_type: IntensityType;
  block_number: number | null;
  is_deload: boolean;
  planned_date: string;
  status: SessionStatus;
  jit_generated_at: string | null;
  completed_at: string | null;
}

export interface CompletedSessionListItem {
  id: string;
  primary_lift: Lift;
  intensity_type: IntensityType;
  planned_date: string | null;
  completed_at: string | null;
  status: SessionStatus;
  week_number: number;
  block_number: number | null;
  cycle_phase: string | null;
  rpe: number | null;
}

export interface SessionCompletionContext {
  primaryLift: Lift | null;
  programId: string | null;
  programMode: string | null;
}

export interface CompleteSessionSetInput extends ActualSet {
  is_completed: boolean;
}

export interface CompleteSessionInput {
  actualSets: CompleteSessionSetInput[];
  auxiliarySets?: CompleteSessionSetInput[];
  sessionRpe?: number;
  startedAt?: Date;
  completedAt?: Date;
}

export interface ProgramListItem
  extends Pick<
    Program,
    | 'id'
    | 'status'
    | 'program_mode'
    | 'total_weeks'
    | 'unending_session_counter'
    | 'training_days_per_week'
    | 'start_date'
    | 'created_at'
  > {
  version: number | null;
}
