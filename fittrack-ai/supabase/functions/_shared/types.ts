/** Row shapes the Edge Functions read. Only the columns they need. */
import type { Sex } from './domain/burn.ts';
import type { Slot, Source } from './domain/meals.ts';

export interface ProfileLite {
  display_name: string; sex: Sex; age: number; height_cm: number; timezone: string;
  goal: string; diet: string; weak_spots: string; daily_activity: string; training: string;
}
export interface TargetsLite {
  kcal_target: number; protein_min_g: number; protein_target_g: number; protein_max_g: number;
  fat_min_g: number; fat_max_g: number; fibre_min_g: number; fibre_max_g: number;
  water_ml: number; steps: number; workouts_per_week: number; bedtime_target: string; add_exercise_calories: boolean;
}
export interface ProgrammeLite { name: string; start_date: string; weeks: number; checkpoint_date: string | null; expectation: string }
export interface MealLite {
  date: string; slot: Slot; source: Source; name: string; junk: boolean; edited: boolean; confidence: string | null;
  kcal: number | null; protein_g: number | null; carbs_g: number | null; fat_g: number | null; fibre_g: number | null;
}
export interface DayLogLite {
  date: string; water_ml: number; steps: number | null; badminton: boolean; workout_done: boolean; in_bed_on_time: boolean; chai_sugar: string | null;
}
export interface WeightLite { date: string; weight_kg: number }
export interface MeasurementLite { date: string; waist_cm: number | null }
export interface CoachMessageRow { id: string; user_id: string; role: 'user' | 'assistant'; content: string; meta: Record<string, unknown>; created_at: string; updated_at: string }
export interface ReportRow {
  id: string; user_id: string; kind: 'daily' | 'weekly'; period_start: string; period_end: string;
  content: Record<string, unknown>; body: string; model: string | null; created_at: string; updated_at: string;
}

/** Everything a coach answer or a report is allowed to know: the user's own logged data, nothing else. */
export interface UserHistory {
  today: string;
  profile: ProfileLite;
  targets: TargetsLite;
  programme: ProgrammeLite | null;
  meals: MealLite[];
  logs: DayLogLite[];
  /** All weights on or before `today` (the burn uses the latest one on or before each day). */
  weights: WeightLite[];
  measurements: MeasurementLite[];
}
