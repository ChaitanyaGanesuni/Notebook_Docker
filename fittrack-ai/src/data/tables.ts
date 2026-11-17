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
  coach_messages: { pk: 'id', date: null },
  ai_reports: { pk: 'id', date: 'period_start' },
} as const satisfies Record<string, { pk: string; date: string | null }>;

export type TableName = keyof typeof TABLES;

/** Tables pulled from the server after sign-in. Later phases add theirs. */
export const PULL_TABLES: TableName[] = [
  'profiles', 'targets', 'programmes', 'weight_logs', 'day_logs', 'meal_entries', 'body_measurements', 'saved_meals',
  'coach_messages', 'ai_reports',
];

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

export interface DayLogRow extends Row {
  id: string;
  date: string;
  water_ml: number;
  steps: number | null;
  steps_source: 'manual' | 'health' | null;
  badminton: boolean;
  workout_done: boolean;
  in_bed_on_time: boolean;
  chai_sugar: 'full' | 'half' | 'none' | null;
  note: string;
}

export interface MealEntryRow extends Row {
  id: string;
  date: string;
  slot: 'breakfast' | 'lunch' | 'dinner' | 'snacks';
  source: 'home' | 'canteen' | 'ordered';
  logged_at: string;
  text: string;
  photo_path: string | null;
  name: string;
  kcal: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  fibre_g: number | null;
  sugar_g: number | null;
  sodium_mg: number | null;
  junk: boolean;
  /** The original AI estimate, kept unchanged after the user edits the numbers. `{ error }` when there was no food. */
  ai_estimate: (Partial<import('../../supabase/functions/_shared/ai/estimate.ts').MealEstimate> & { model?: string; error?: string }) | null;
  estimate_status: 'none' | 'pending' | 'done' | 'failed';
  confidence: 'low' | 'medium' | 'high' | null;
  assumption: string | null;
  edited: boolean;
  deleted_at: string | null;
}

export interface MeasurementRow extends Row {
  id: string;
  date: string;
  waist_cm: number | null;
  hip_cm: number | null;
  deleted_at: string | null;
}

export interface SavedMealRow extends Row {
  id: string;
  name: string;
  slot: MealEntryRow['slot'] | null;
  source: MealEntryRow['source'] | null;
  kcal: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  fibre_g: number | null;
  junk: boolean;
  items: unknown[];
  deleted_at: string | null;
}

export type { CoachMessageRow, ReportRow } from '../../supabase/functions/_shared/types.ts';
