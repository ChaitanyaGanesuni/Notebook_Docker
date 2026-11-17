/**
 * Onboarding pre-fill (brief sections 3 and 4). Every value is editable in the
 * app; these are only the starting point.
 */
import type { LocalDate } from './dates';

import type { Sex } from './burn';

export type { Sex };
export type TrackSlug = 'men' | 'women' | 'couples';
export type Presenter = 'female' | 'male';

export interface ProfileFields {
  display_name: string;
  sex: Sex;
  age: number;
  height_cm: number;
  goal: string;
  fat_storage: string;
  job: string;
  wake_time: string; // HH:MM
  bed_time: string; // HH:MM
  daily_activity: string;
  training: string;
  strength_level: string;
  diet: string;
  food_sources: string;
  weak_spots: string;
  timezone: string;
  default_track: TrackSlug;
  demo_presenter: Presenter;
}

export interface TargetFields {
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
  bedtime_target: string; // HH:MM
  sleep_min_h: number;
  sleep_max_h: number;
  /** Off by default: exercise calories are never added back to the target. */
  add_exercise_calories: boolean;
}

export interface ProgrammeFields {
  name: string;
  start_date: LocalDate;
  weeks: number;
  checkpoint_date: LocalDate | null;
  expectation: string;
}

export const DEFAULT_PROFILE: ProfileFields = {
  display_name: 'Chaitanya',
  sex: 'male',
  age: 25,
  height_cm: 168,
  goal: 'Fat loss with muscle retention: flatter stomach, fitted-clothes look',
  fat_storage: 'Belly and love handles',
  job: 'Desk job, 9:30 am to 7:00 pm',
  wake_time: '07:00',
  bed_time: '23:30',
  daily_activity: 'About 10,000 steps and about 1 hour of badminton most days',
  training: 'Home, no equipment, 25 to 30 minutes, 3 days a week',
  strength_level: 'Beginner, 0 to 5 push-ups',
  diet: 'Indian non-vegetarian (eggs, chicken, fish), 3 meals a day, whey protein',
  food_sources: 'Mix of home cooking, office canteen and delivery',
  weak_spots: 'Fried food, weekends, sugary chai',
  timezone: 'Asia/Kolkata',
  default_track: 'men',
  demo_presenter: 'male',
};

export const DEFAULT_TARGETS: TargetFields = {
  kcal_target: 2050,
  kcal_min: 2000,
  kcal_max: 2100,
  protein_target_g: 130,
  protein_min_g: 120,
  protein_max_g: 140,
  fat_min_g: 50,
  fat_max_g: 65,
  fibre_min_g: 25,
  fibre_max_g: 30,
  water_ml: 3000,
  steps: 10000,
  workouts_per_week: 3,
  bedtime_target: '23:30',
  sleep_min_h: 7,
  sleep_max_h: 8,
  add_exercise_calories: false,
};

export const DEFAULT_PROGRAMME: ProgrammeFields = {
  name: '12-week fat loss',
  start_date: '2026-11-17',
  weeks: 12,
  checkpoint_date: '2027-01-01',
  expectation: '3 to 4 kg of fat and 4 to 6 cm off the waist by the checkpoint',
};

/** First historical record; preserved exactly (brief section 14). */
export const DEFAULT_STARTING_WEIGHT = { date: '2026-11-12' as LocalDate, weight_kg: 73.0 };

/** Default track and demo presenter follow profile sex; both stay user-editable. */
export function trackDefaultsForSex(sex: Sex): { default_track: TrackSlug; demo_presenter: Presenter } {
  return sex === 'female'
    ? { default_track: 'women', demo_presenter: 'female' }
    : { default_track: 'men', demo_presenter: 'male' };
}
