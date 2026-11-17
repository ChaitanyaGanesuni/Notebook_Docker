/**
 * The tables the app syncs, and how each row is keyed.
 *   pk    - primary-key column (used as the local row id and the upsert conflict target)
 *   date  - column holding the local date, when the table is per-day
 */
export const TABLES = {
  profiles: { pk: 'user_id', date: null },
  targets: { pk: 'user_id', date: null },
  programmes: { pk: 'id', date: 'start_date' },
  day_logs: { pk: 'id', date: 'date' },
  weight_logs: { pk: 'id', date: 'date' },
  body_measurements: { pk: 'id', date: 'date' },
  sleep_logs: { pk: 'id', date: 'date' },
  progress_photos: { pk: 'id', date: 'date' },
  notification_preferences: { pk: 'id', date: null },
  meal_entries: { pk: 'id', date: 'date' },
  meal_items: { pk: 'id', date: null },
  saved_meals: { pk: 'id', date: null },
  food_items: { pk: 'id', date: null },
  workout_sessions: { pk: 'id', date: 'date' },
  session_participants: { pk: 'id', date: null },
  exercise_sets: { pk: 'id', date: null },
} as const satisfies Record<string, { pk: string; date: string | null }>;

export type TableName = keyof typeof TABLES;

/** Tables pulled from the server after sign-in in phase 1. Later phases add theirs. */
export const PHASE1_PULL_TABLES: TableName[] = ['profiles', 'targets', 'programmes', 'weight_logs'];

export type Row = Record<string, unknown> & { user_id: string; updated_at: string };

export interface ProfileRow extends Row {
  display_name: string;
  sex: 'male' | 'female';
  age: number;
  height_cm: number;
  goal: string;
  fat_storage: string;
  job: string;
  wake_time: string;
  bed_time: string;
  daily_activity: string;
  training: string;
  strength_level: string;
  diet: string;
  food_sources: string;
  weak_spots: string;
  timezone: string;
  default_track: 'men' | 'women' | 'couples';
  demo_presenter: 'female' | 'male';
  onboarded_at: string | null;
}

export interface TargetsRow extends Row {
  kcal_target: number;
  kcal_min: number;
  kcal_max: number;
  protein_target_g: number;
  protein_min_g: number;
  protein_max_g: number;
  fat_min_g: number;
  fat_max_g: number;
  fibre_min_g: number;
  fibre_max_g: number;
  water_ml: number;
  steps: number;
  workouts_per_week: number;
  bedtime_target: string;
  sleep_min_h: number;
  sleep_max_h: number;
  add_exercise_calories: boolean;
}

export interface ProgrammeRow extends Row {
  id: string;
  name: string;
  start_date: string;
  weeks: number;
  checkpoint_date: string | null;
  expectation: string;
  is_active: boolean;
}

export interface WeightLogRow extends Row {
  id: string;
  date: string;
  weight_kg: number;
  deleted_at: string | null;
}
