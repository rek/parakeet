export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      ai_rate_limits: {
        Row: {
          created_at: string
          id: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: never
          user_id: string
        }
        Update: {
          created_at?: string
          id?: never
          user_id?: string
        }
        Relationships: []
      }
      auxiliary_assignments: {
        Row: {
          block_number: number
          created_at: string
          exercise_1: string
          exercise_1_locked: boolean
          exercise_2: string
          exercise_2_locked: boolean
          id: string
          lift: string
          program_id: string
          user_id: string
        }
        Insert: {
          block_number: number
          created_at?: string
          exercise_1: string
          exercise_1_locked?: boolean
          exercise_2: string
          exercise_2_locked?: boolean
          id?: string
          lift: string
          program_id: string
          user_id: string
        }
        Update: {
          block_number?: number
          created_at?: string
          exercise_1?: string
          exercise_1_locked?: boolean
          exercise_2?: string
          exercise_2_locked?: boolean
          id?: string
          lift?: string
          program_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "auxiliary_assignments_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      auxiliary_exercises: {
        Row: {
          exercise_name: string
          id: string
          is_active: boolean
          lift: string
          pool_position: number
          primary_muscles: string[]
          user_id: string
        }
        Insert: {
          exercise_name: string
          id?: string
          is_active?: boolean
          lift: string
          pool_position: number
          primary_muscles: string[]
          user_id: string
        }
        Update: {
          exercise_name?: string
          id?: string
          is_active?: boolean
          lift?: string
          pool_position?: number
          primary_muscles?: string[]
          user_id?: string
        }
        Relationships: []
      }
      bodyweight_entries: {
        Row: {
          created_at: string
          id: string
          recorded_date: string
          user_id: string
          weight_kg: number
        }
        Insert: {
          created_at?: string
          id?: string
          recorded_date: string
          user_id: string
          weight_kg: number
        }
        Update: {
          created_at?: string
          id?: string
          recorded_date?: string
          user_id?: string
          weight_kg?: number
        }
        Relationships: [
          {
            foreignKeyName: "bodyweight_entries_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      challenge_reviews: {
        Row: {
          concerns: Json
          created_at: string
          id: string
          score: number
          session_id: string
          suggested_overrides: Json | null
          user_id: string
          verdict: string
        }
        Insert: {
          concerns?: Json
          created_at?: string
          id?: string
          score: number
          session_id: string
          suggested_overrides?: Json | null
          user_id: string
          verdict: string
        }
        Update: {
          concerns?: Json
          created_at?: string
          id?: string
          score?: number
          session_id?: string
          suggested_overrides?: Json | null
          user_id?: string
          verdict?: string
        }
        Relationships: [
          {
            foreignKeyName: "challenge_reviews_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "challenge_reviews_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cycle_reviews: {
        Row: {
          compiled_report: Json
          generated_at: string
          id: string
          llm_response: Json
          program_id: string
          user_id: string
        }
        Insert: {
          compiled_report: Json
          generated_at?: string
          id?: string
          llm_response: Json
          program_id: string
          user_id: string
        }
        Update: {
          compiled_report?: Json
          generated_at?: string
          id?: string
          llm_response?: Json
          program_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cycle_reviews_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      cycle_tracking: {
        Row: {
          cycle_length_days: number
          id: string
          is_enabled: boolean
          last_period_start: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          cycle_length_days?: number
          id?: string
          is_enabled?: boolean
          last_period_start?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          cycle_length_days?: number
          id?: string
          is_enabled?: boolean
          last_period_start?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      decision_replay_logs: {
        Row: {
          created_at: string
          id: string
          insights: Json
          prescription_score: number
          rpe_accuracy: number
          session_id: string
          user_id: string
          volume_appropriateness: string
        }
        Insert: {
          created_at?: string
          id?: string
          insights?: Json
          prescription_score: number
          rpe_accuracy: number
          session_id: string
          user_id: string
          volume_appropriateness: string
        }
        Update: {
          created_at?: string
          id?: string
          insights?: Json
          prescription_score?: number
          rpe_accuracy?: number
          session_id?: string
          user_id?: string
          volume_appropriateness?: string
        }
        Relationships: [
          {
            foreignKeyName: "decision_replay_logs_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "decision_replay_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      developer_suggestions: {
        Row: {
          created_at: string
          description: string
          developer_note: string
          id: string
          is_reviewed: boolean
          priority: string
          program_id: string | null
          rationale: string
          reviewed_at: string | null
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description: string
          developer_note: string
          id?: string
          is_reviewed?: boolean
          priority?: string
          program_id?: string | null
          rationale: string
          reviewed_at?: string | null
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string
          developer_note?: string
          id?: string
          is_reviewed?: boolean
          priority?: string
          program_id?: string | null
          rationale?: string
          reviewed_at?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "developer_suggestions_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      diet_foods: {
        Row: {
          canonical_name: string
          category: string
          created_at: string
          display_name: string
          id: string
        }
        Insert: {
          canonical_name: string
          category: string
          created_at?: string
          display_name: string
          id?: string
        }
        Update: {
          canonical_name?: string
          category?: string
          created_at?: string
          display_name?: string
          id?: string
        }
        Relationships: []
      }
      diet_lifestyle: {
        Row: {
          category: string
          description: string | null
          frequency: string
          id: string
          name: string
          protocol_id: string
          rationale: string | null
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          category: string
          description?: string | null
          frequency: string
          id?: string
          name: string
          protocol_id: string
          rationale?: string | null
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          category?: string
          description?: string | null
          frequency?: string
          id?: string
          name?: string
          protocol_id?: string
          rationale?: string | null
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "diet_lifestyle_protocol_id_fkey"
            columns: ["protocol_id"]
            isOneToOne: false
            referencedRelation: "diet_protocols"
            referencedColumns: ["id"]
          },
        ]
      }
      diet_protocol_foods: {
        Row: {
          food_id: string
          notes: string | null
          protocol_id: string
          status: string
          updated_at: string
        }
        Insert: {
          food_id: string
          notes?: string | null
          protocol_id: string
          status: string
          updated_at?: string
        }
        Update: {
          food_id?: string
          notes?: string | null
          protocol_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "diet_protocol_foods_food_id_fkey"
            columns: ["food_id"]
            isOneToOne: false
            referencedRelation: "diet_foods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diet_protocol_foods_protocol_id_fkey"
            columns: ["protocol_id"]
            isOneToOne: false
            referencedRelation: "diet_protocols"
            referencedColumns: ["id"]
          },
        ]
      }
      diet_protocols: {
        Row: {
          created_at: string
          description_md: string | null
          id: string
          name: string
          slug: string
        }
        Insert: {
          created_at?: string
          description_md?: string | null
          id?: string
          name: string
          slug: string
        }
        Update: {
          created_at?: string
          description_md?: string | null
          id?: string
          name?: string
          slug?: string
        }
        Relationships: []
      }
      diet_supplements: {
        Row: {
          dose: string | null
          evidence_grade: string | null
          food_equivalent: string | null
          id: string
          name: string
          nepal_sourcing: string | null
          notes: string | null
          protocol_id: string
          rationale: string | null
          slug: string
          sort_order: number
          tier: string
          updated_at: string
        }
        Insert: {
          dose?: string | null
          evidence_grade?: string | null
          food_equivalent?: string | null
          id?: string
          name: string
          nepal_sourcing?: string | null
          notes?: string | null
          protocol_id: string
          rationale?: string | null
          slug: string
          sort_order?: number
          tier: string
          updated_at?: string
        }
        Update: {
          dose?: string | null
          evidence_grade?: string | null
          food_equivalent?: string | null
          id?: string
          name?: string
          nepal_sourcing?: string | null
          notes?: string | null
          protocol_id?: string
          rationale?: string | null
          slug?: string
          sort_order?: number
          tier?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "diet_supplements_protocol_id_fkey"
            columns: ["protocol_id"]
            isOneToOne: false
            referencedRelation: "diet_protocols"
            referencedColumns: ["id"]
          },
        ]
      }
      disruptions: {
        Row: {
          adjustment_applied: Json | null
          affected_date_end: string | null
          affected_date_start: string
          affected_lifts: string[] | null
          description: string | null
          disruption_type: string
          id: string
          program_id: string | null
          reported_at: string
          resolved_at: string | null
          session_ids_affected: string[] | null
          severity: string
          status: string
          user_id: string
        }
        Insert: {
          adjustment_applied?: Json | null
          affected_date_end?: string | null
          affected_date_start: string
          affected_lifts?: string[] | null
          description?: string | null
          disruption_type: string
          id?: string
          program_id?: string | null
          reported_at?: string
          resolved_at?: string | null
          session_ids_affected?: string[] | null
          severity: string
          status?: string
          user_id: string
        }
        Update: {
          adjustment_applied?: Json | null
          affected_date_end?: string | null
          affected_date_start?: string
          affected_lifts?: string[] | null
          description?: string | null
          disruption_type?: string
          id?: string
          program_id?: string | null
          reported_at?: string
          resolved_at?: string | null
          session_ids_affected?: string[] | null
          severity?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "disruptions_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      formula_configs: {
        Row: {
          ai_rationale: string | null
          created_at: string
          id: string
          is_active: boolean
          overrides: Json
          source: string
          user_id: string
          version: number
        }
        Insert: {
          ai_rationale?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          overrides?: Json
          source: string
          user_id: string
          version?: number
        }
        Update: {
          ai_rationale?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          overrides?: Json
          source?: string
          user_id?: string
          version?: number
        }
        Relationships: []
      }
      gym_partner_invites: {
        Row: {
          claimed_by: string | null
          created_at: string
          id: string
          inviter_id: string
          token: string
        }
        Insert: {
          claimed_by?: string | null
          created_at?: string
          id?: string
          inviter_id: string
          token?: string
        }
        Update: {
          claimed_by?: string | null
          created_at?: string
          id?: string
          inviter_id?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "gym_partner_invites_claimed_by_fkey"
            columns: ["claimed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gym_partner_invites_inviter_id_fkey"
            columns: ["inviter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      gym_partners: {
        Row: {
          created_at: string
          id: string
          requester_id: string
          responder_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          requester_id: string
          responder_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          requester_id?: string
          responder_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gym_partners_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gym_partners_responder_id_fkey"
            columns: ["responder_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      jit_comparison_logs: {
        Row: {
          created_at: string
          divergence: Json
          formula_output: Json
          id: string
          jit_input: Json
          llm_output: Json
          session_id: string | null
          strategy_used: string
          user_id: string
        }
        Insert: {
          created_at?: string
          divergence: Json
          formula_output: Json
          id?: string
          jit_input: Json
          llm_output: Json
          session_id?: string | null
          strategy_used: string
          user_id: string
        }
        Update: {
          created_at?: string
          divergence?: Json
          formula_output?: Json
          id?: string
          jit_input?: Json
          llm_output?: Json
          session_id?: string | null
          strategy_used?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "jit_comparison_logs_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jit_comparison_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lifter_maxes: {
        Row: {
          bench_1rm_grams: number
          bench_input_grams: number | null
          bench_input_reps: number | null
          deadlift_1rm_grams: number
          deadlift_input_grams: number | null
          deadlift_input_reps: number | null
          id: string
          recorded_at: string
          source: string
          squat_1rm_grams: number
          squat_input_grams: number | null
          squat_input_reps: number | null
          user_id: string
        }
        Insert: {
          bench_1rm_grams: number
          bench_input_grams?: number | null
          bench_input_reps?: number | null
          deadlift_1rm_grams: number
          deadlift_input_grams?: number | null
          deadlift_input_reps?: number | null
          id?: string
          recorded_at?: string
          source: string
          squat_1rm_grams: number
          squat_input_grams?: number | null
          squat_input_reps?: number | null
          user_id: string
        }
        Update: {
          bench_1rm_grams?: number
          bench_input_grams?: number | null
          bench_input_reps?: number | null
          deadlift_1rm_grams?: number
          deadlift_input_grams?: number | null
          deadlift_input_reps?: number | null
          id?: string
          recorded_at?: string
          source?: string
          squat_1rm_grams?: number
          squat_input_grams?: number | null
          squat_input_reps?: number | null
          user_id?: string
        }
        Relationships: []
      }
      modifier_calibrations: {
        Row: {
          adjustment: number
          calibrated_at: string | null
          confidence: string
          created_at: string | null
          id: string
          mean_bias: number | null
          modifier_source: string
          sample_count: number
          updated_at: string | null
          user_id: string
        }
        Insert: {
          adjustment?: number
          calibrated_at?: string | null
          confidence?: string
          created_at?: string | null
          id?: string
          mean_bias?: number | null
          modifier_source: string
          sample_count?: number
          updated_at?: string | null
          user_id: string
        }
        Update: {
          adjustment?: number
          calibrated_at?: string | null
          confidence?: string
          created_at?: string | null
          id?: string
          mean_bias?: number | null
          modifier_source?: string
          sample_count?: number
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      motivational_message_logs: {
        Row: {
          context: Json
          created_at: string
          id: string
          message: string
          session_ids: string[]
          user_id: string
        }
        Insert: {
          context: Json
          created_at?: string
          id?: string
          message: string
          session_ids: string[]
          user_id: string
        }
        Update: {
          context?: Json
          created_at?: string
          id?: string
          message?: string
          session_ids?: string[]
          user_id?: string
        }
        Relationships: []
      }
      muscle_volume_config: {
        Row: {
          id: string
          mev_sets_per_week: number
          mrv_sets_per_week: number
          muscle_group: string
          updated_at: string
          user_id: string
        }
        Insert: {
          id?: string
          mev_sets_per_week: number
          mrv_sets_per_week: number
          muscle_group: string
          updated_at?: string
          user_id: string
        }
        Update: {
          id?: string
          mev_sets_per_week?: number
          mrv_sets_per_week?: number
          muscle_group?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      performance_metrics: {
        Row: {
          actual_intensity_pct: number | null
          actual_volume_grams: number | null
          avg_rpe_actual: number | null
          block_number: number | null
          completion_pct: number | null
          estimated_1rm_grams: number | null
          id: string
          intensity_type: string
          lift: string
          max_rpe_actual: number | null
          planned_intensity_pct: number | null
          planned_volume_grams: number | null
          recorded_at: string
          session_log_id: string
          sets_per_muscle: Json | null
          user_id: string
          week_number: number | null
        }
        Insert: {
          actual_intensity_pct?: number | null
          actual_volume_grams?: number | null
          avg_rpe_actual?: number | null
          block_number?: number | null
          completion_pct?: number | null
          estimated_1rm_grams?: number | null
          id?: string
          intensity_type: string
          lift: string
          max_rpe_actual?: number | null
          planned_intensity_pct?: number | null
          planned_volume_grams?: number | null
          recorded_at: string
          session_log_id: string
          sets_per_muscle?: Json | null
          user_id: string
          week_number?: number | null
        }
        Update: {
          actual_intensity_pct?: number | null
          actual_volume_grams?: number | null
          avg_rpe_actual?: number | null
          block_number?: number | null
          completion_pct?: number | null
          estimated_1rm_grams?: number | null
          id?: string
          intensity_type?: string
          lift?: string
          max_rpe_actual?: number | null
          planned_intensity_pct?: number | null
          planned_volume_grams?: number | null
          recorded_at?: string
          session_log_id?: string
          sets_per_muscle?: Json | null
          user_id?: string
          week_number?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "performance_metrics_session_log_id_fkey"
            columns: ["session_log_id"]
            isOneToOne: false
            referencedRelation: "session_logs"
            referencedColumns: ["id"]
          },
        ]
      }
      period_starts: {
        Row: {
          created_at: string
          id: string
          start_date: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          start_date: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          start_date?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "period_starts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      personal_records: {
        Row: {
          achieved_at: string
          id: string
          lift: string
          pr_type: string
          session_id: string | null
          user_id: string
          value: number
          weight_kg: number | null
        }
        Insert: {
          achieved_at?: string
          id?: string
          lift: string
          pr_type: string
          session_id?: string | null
          user_id: string
          value: number
          weight_kg?: number | null
        }
        Update: {
          achieved_at?: string
          id?: string
          lift?: string
          pr_type?: string
          session_id?: string | null
          user_id?: string
          value?: number
          weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "personal_records_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "personal_records_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          biological_sex: string | null
          bodyweight_kg: number | null
          created_at: string
          date_of_birth: string | null
          display_name: string | null
          id: string
        }
        Insert: {
          biological_sex?: string | null
          bodyweight_kg?: number | null
          created_at?: string
          date_of_birth?: string | null
          display_name?: string | null
          id: string
        }
        Update: {
          biological_sex?: string | null
          bodyweight_kg?: number | null
          created_at?: string
          date_of_birth?: string | null
          display_name?: string | null
          id?: string
        }
        Relationships: []
      }
      programs: {
        Row: {
          created_at: string
          formula_config_id: string | null
          id: string
          lifter_maxes_id: string | null
          program_mode: string
          start_date: string
          status: string
          total_weeks: number | null
          training_days: number[] | null
          training_days_per_week: number
          unending_session_counter: number
          user_id: string
          version: number
        }
        Insert: {
          created_at?: string
          formula_config_id?: string | null
          id?: string
          lifter_maxes_id?: string | null
          program_mode?: string
          start_date: string
          status?: string
          total_weeks?: number | null
          training_days?: number[] | null
          training_days_per_week?: number
          unending_session_counter?: number
          user_id: string
          version?: number
        }
        Update: {
          created_at?: string
          formula_config_id?: string | null
          id?: string
          lifter_maxes_id?: string | null
          program_mode?: string
          start_date?: string
          status?: string
          total_weeks?: number | null
          training_days?: number[] | null
          training_days_per_week?: number
          unending_session_counter?: number
          user_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "programs_formula_config_id_fkey"
            columns: ["formula_config_id"]
            isOneToOne: false
            referencedRelation: "formula_configs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "programs_lifter_maxes_id_fkey"
            columns: ["lifter_maxes_id"]
            isOneToOne: false
            referencedRelation: "lifter_maxes"
            referencedColumns: ["id"]
          },
        ]
      }
      recovery_snapshots: {
        Row: {
          hrv_ms: number | null
          id: string
          raw_payload: Json | null
          recorded_at: string
          resting_hr_bpm: number | null
          sleep_duration_minutes: number | null
          sleep_quality_score: number | null
          source: string
          user_id: string
        }
        Insert: {
          hrv_ms?: number | null
          id?: string
          raw_payload?: Json | null
          recorded_at: string
          resting_hr_bpm?: number | null
          sleep_duration_minutes?: number | null
          sleep_quality_score?: number | null
          source: string
          user_id: string
        }
        Update: {
          hrv_ms?: number | null
          id?: string
          raw_payload?: Json | null
          recorded_at?: string
          resting_hr_bpm?: number | null
          sleep_duration_minutes?: number | null
          sleep_quality_score?: number | null
          source?: string
          user_id?: string
        }
        Relationships: []
      }
      rest_configs: {
        Row: {
          intensity_type: string | null
          lift: string | null
          rest_seconds: number
          updated_at: string
          user_id: string
        }
        Insert: {
          intensity_type?: string | null
          lift?: string | null
          rest_seconds: number
          updated_at?: string
          user_id: string
        }
        Update: {
          intensity_type?: string | null
          lift?: string | null
          rest_seconds?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rest_configs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      session_logs: {
        Row: {
          auto_finalised: boolean
          completed_at: string | null
          completion_pct: number | null
          corrects_log_id: string | null
          cycle_phase: string | null
          duration_seconds: number | null
          id: string
          is_correction: boolean
          logged_at: string
          performance_vs_plan: string | null
          session_id: string
          session_notes: string | null
          session_rpe: number | null
          started_at: string | null
          user_id: string
        }
        Insert: {
          auto_finalised?: boolean
          completed_at?: string | null
          completion_pct?: number | null
          corrects_log_id?: string | null
          cycle_phase?: string | null
          duration_seconds?: number | null
          id?: string
          is_correction?: boolean
          logged_at?: string
          performance_vs_plan?: string | null
          session_id: string
          session_notes?: string | null
          session_rpe?: number | null
          started_at?: string | null
          user_id: string
        }
        Update: {
          auto_finalised?: boolean
          completed_at?: string | null
          completion_pct?: number | null
          corrects_log_id?: string | null
          cycle_phase?: string | null
          duration_seconds?: number | null
          id?: string
          is_correction?: boolean
          logged_at?: string
          performance_vs_plan?: string | null
          session_id?: string
          session_notes?: string | null
          session_rpe?: number | null
          started_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_logs_corrects_log_id_fkey"
            columns: ["corrects_log_id"]
            isOneToOne: false
            referencedRelation: "session_logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_logs_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      session_videos: {
        Row: {
          analysis: Json | null
          coaching_response: Json | null
          created_at: string
          debug_landmarks: Json | null
          duration_sec: number
          id: string
          lift: string
          local_uri: string
          recorded_by: string | null
          remote_uri: string | null
          sagittal_confidence: number
          session_id: string
          set_number: number
          set_reps: number | null
          set_rpe: number | null
          set_weight_grams: number | null
          user_id: string
          video_height_px: number | null
          video_width_px: number | null
        }
        Insert: {
          analysis?: Json | null
          coaching_response?: Json | null
          created_at?: string
          debug_landmarks?: Json | null
          duration_sec: number
          id?: string
          lift: string
          local_uri: string
          recorded_by?: string | null
          remote_uri?: string | null
          sagittal_confidence?: number
          session_id: string
          set_number?: number
          set_reps?: number | null
          set_rpe?: number | null
          set_weight_grams?: number | null
          user_id: string
          video_height_px?: number | null
          video_width_px?: number | null
        }
        Update: {
          analysis?: Json | null
          coaching_response?: Json | null
          created_at?: string
          debug_landmarks?: Json | null
          duration_sec?: number
          id?: string
          lift?: string
          local_uri?: string
          recorded_by?: string | null
          remote_uri?: string | null
          sagittal_confidence?: number
          session_id?: string
          set_number?: number
          set_reps?: number | null
          set_rpe?: number | null
          set_weight_grams?: number | null
          user_id?: string
          video_height_px?: number | null
          video_width_px?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "session_videos_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_videos_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_videos_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sessions: {
        Row: {
          activity_name: string | null
          block_number: number | null
          completed_at: string | null
          created_at: string
          day_number: number
          id: string
          intensity_type: string | null
          is_deload: boolean
          jit_generated_at: string | null
          jit_input_snapshot: Json | null
          jit_output_trace: Json | null
          jit_strategy: string | null
          planned_date: string | null
          planned_sets: Json | null
          primary_lift: string | null
          program_id: string | null
          status: string
          updated_at: string
          user_id: string
          week_number: number
        }
        Insert: {
          activity_name?: string | null
          block_number?: number | null
          completed_at?: string | null
          created_at?: string
          day_number: number
          id?: string
          intensity_type?: string | null
          is_deload?: boolean
          jit_generated_at?: string | null
          jit_input_snapshot?: Json | null
          jit_output_trace?: Json | null
          jit_strategy?: string | null
          planned_date?: string | null
          planned_sets?: Json | null
          primary_lift?: string | null
          program_id?: string | null
          status?: string
          updated_at?: string
          user_id: string
          week_number: number
        }
        Update: {
          activity_name?: string | null
          block_number?: number | null
          completed_at?: string | null
          created_at?: string
          day_number?: number
          id?: string
          intensity_type?: string | null
          is_deload?: boolean
          jit_generated_at?: string | null
          jit_input_snapshot?: Json | null
          jit_output_trace?: Json | null
          jit_strategy?: string | null
          planned_date?: string | null
          planned_sets?: Json | null
          primary_lift?: string | null
          program_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          week_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "sessions_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      set_logs: {
        Row: {
          actual_rest_seconds: number | null
          corrected_by: string | null
          exercise: string | null
          exercise_type: string | null
          failed: boolean
          id: string
          kind: string
          logged_at: string
          notes: string | null
          reps_completed: number
          rpe_actual: number | null
          session_id: string
          set_number: number
          user_id: string
          weight_grams: number
        }
        Insert: {
          actual_rest_seconds?: number | null
          corrected_by?: string | null
          exercise?: string | null
          exercise_type?: string | null
          failed?: boolean
          id?: string
          kind: string
          logged_at?: string
          notes?: string | null
          reps_completed: number
          rpe_actual?: number | null
          session_id: string
          set_number: number
          user_id: string
          weight_grams: number
        }
        Update: {
          actual_rest_seconds?: number | null
          corrected_by?: string | null
          exercise?: string | null
          exercise_type?: string | null
          failed?: boolean
          id?: string
          kind?: string
          logged_at?: string
          notes?: string | null
          reps_completed?: number
          rpe_actual?: number | null
          session_id?: string
          set_number?: number
          user_id?: string
          weight_grams?: number
        }
        Relationships: [
          {
            foreignKeyName: "set_logs_corrected_by_fkey"
            columns: ["corrected_by"]
            isOneToOne: false
            referencedRelation: "set_logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "set_logs_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      soreness_checkins: {
        Row: {
          id: string
          ratings: Json
          recorded_at: string
          session_id: string | null
          skipped: boolean
          user_id: string
        }
        Insert: {
          id?: string
          ratings: Json
          recorded_at?: string
          session_id?: string | null
          skipped?: boolean
          user_id: string
        }
        Update: {
          id?: string
          ratings?: Json
          recorded_at?: string
          session_id?: string | null
          skipped?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "soreness_checkins_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      user_badges: {
        Row: {
          badge_id: string
          earned_at: string
          id: string
          metadata: Json | null
          session_id: string | null
          user_id: string
        }
        Insert: {
          badge_id: string
          earned_at?: string
          id?: string
          metadata?: Json | null
          session_id?: string | null
          user_id: string
        }
        Update: {
          badge_id?: string
          earned_at?: string
          id?: string
          metadata?: Json | null
          session_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_badges_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      warmup_configs: {
        Row: {
          custom_steps: Json | null
          id: string
          lift: string
          protocol: string
          updated_at: string
          user_id: string
        }
        Insert: {
          custom_steps?: Json | null
          id?: string
          lift: string
          protocol?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          custom_steps?: Json | null
          id?: string
          lift?: string
          protocol?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      weekly_body_reviews: {
        Row: {
          created_at: string
          felt_soreness: Json
          id: string
          mismatches: Json
          notes: string | null
          predicted_fatigue: Json
          program_id: string | null
          user_id: string
          week_number: number
        }
        Insert: {
          created_at?: string
          felt_soreness: Json
          id?: string
          mismatches?: Json
          notes?: string | null
          predicted_fatigue: Json
          program_id?: string | null
          user_id: string
          week_number: number
        }
        Update: {
          created_at?: string
          felt_soreness?: Json
          id?: string
          mismatches?: Json
          notes?: string | null
          predicted_fatigue?: Json
          program_id?: string | null
          user_id?: string
          week_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "weekly_body_reviews_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      claim_partner_invite: {
        Args: { p_token: string }
        Returns: {
          inviter_id: string
        }[]
      }
      is_accepted_partner: {
        Args: { p_partner_id: string; p_user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const

