/**
 * The setup form (onboarding and "edit profile") as plain strings, and its
 * conversion to and from typed, validated values. Pure, so it is unit-tested.
 */
import {
  DEFAULT_PROFILE, DEFAULT_PROGRAMME, DEFAULT_STARTING_WEIGHT, DEFAULT_TARGETS,
  type ProfileFields, type ProgrammeFields, type TargetFields,
} from '../../domain/defaults';
import { isLocalDate } from '../../domain/dates';
import { parseNumber, validateProfile, validateProgramme, validateTargets, validateWeight } from '../../domain/validation';

export type SetupForm = Record<string, string>;

export interface SetupValues {
  profile: ProfileFields;
  targets: TargetFields;
  programme: ProgrammeFields;
  /** Only collected during onboarding. */
  startingWeight: { date: string; weight_kg: number } | null;
}

const PROFILE_TEXT = ['display_name', 'goal', 'fat_storage', 'job', 'wake_time', 'bed_time', 'daily_activity',
  'training', 'strength_level', 'diet', 'food_sources', 'weak_spots', 'timezone'] as const;
const TARGET_NUMBERS = ['kcal_target', 'kcal_min', 'kcal_max', 'protein_target_g', 'protein_min_g', 'protein_max_g',
  'fat_min_g', 'fat_max_g', 'fibre_min_g', 'fibre_max_g', 'steps', 'workouts_per_week', 'sleep_min_h', 'sleep_max_h'] as const;

/** Times come back from Postgres as HH:MM:SS; the form works in HH:MM. */
const hhmm = (t: unknown) => String(t ?? '').slice(0, 5);

export function toForm(
  profile: Partial<ProfileFields> | null,
  targets: Partial<TargetFields> | null,
  programme: Partial<ProgrammeFields> | null,
  startingWeight: { date: string; weight_kg: number } | null = DEFAULT_STARTING_WEIGHT,
): SetupForm {
  const p = { ...DEFAULT_PROFILE, ...profile };
  const t = { ...DEFAULT_TARGETS, ...targets };
  const g = { ...DEFAULT_PROGRAMME, ...programme };
  const f: SetupForm = {};
  for (const k of PROFILE_TEXT) f[k] = String(p[k]);
  f.wake_time = hhmm(p.wake_time);
  f.bed_time = hhmm(p.bed_time);
  f.sex = p.sex;
  f.age = String(p.age);
  f.height_cm = String(Number(p.height_cm));
  f.default_track = p.default_track;
  f.demo_presenter = p.demo_presenter;
  for (const k of TARGET_NUMBERS) f[k] = String(Number(t[k]));
  f.water_l = String(Number(t.water_ml) / 1000);
  f.bedtime_target = hhmm(t.bedtime_target);
  f.add_exercise_calories = t.add_exercise_calories ? 'true' : 'false';
  f.name = g.name;
  f.start_date = g.start_date;
  f.weeks = String(g.weeks);
  f.checkpoint_date = g.checkpoint_date ?? '';
  f.expectation = g.expectation;
  f.weight_kg = startingWeight ? startingWeight.weight_kg.toFixed(1) : '';
  f.weight_date = startingWeight ? startingWeight.date : '';
  return f;
}

const s = (f: SetupForm, k: string) => (f[k] ?? '').trim();
const n = (f: SetupForm, k: string) => parseNumber(f[k] ?? '');

export function fromForm(f: SetupForm, withStartingWeight: boolean): { values: SetupValues; errors: Record<string, string> } {
  const profile: ProfileFields = {
    display_name: s(f, 'display_name'),
    sex: f.sex === 'female' ? 'female' : 'male',
    age: n(f, 'age'),
    height_cm: n(f, 'height_cm'),
    goal: s(f, 'goal'), fat_storage: s(f, 'fat_storage'), job: s(f, 'job'),
    wake_time: s(f, 'wake_time'), bed_time: s(f, 'bed_time'),
    daily_activity: s(f, 'daily_activity'), training: s(f, 'training'), strength_level: s(f, 'strength_level'),
    diet: s(f, 'diet'), food_sources: s(f, 'food_sources'), weak_spots: s(f, 'weak_spots'),
    timezone: s(f, 'timezone'),
    default_track: f.default_track === 'women' || f.default_track === 'couples' ? f.default_track : 'men',
    demo_presenter: f.demo_presenter === 'female' ? 'female' : 'male',
  };
  const targets: TargetFields = {
    kcal_target: n(f, 'kcal_target'), kcal_min: n(f, 'kcal_min'), kcal_max: n(f, 'kcal_max'),
    protein_target_g: n(f, 'protein_target_g'), protein_min_g: n(f, 'protein_min_g'), protein_max_g: n(f, 'protein_max_g'),
    fat_min_g: n(f, 'fat_min_g'), fat_max_g: n(f, 'fat_max_g'),
    fibre_min_g: n(f, 'fibre_min_g'), fibre_max_g: n(f, 'fibre_max_g'),
    water_ml: Math.round(n(f, 'water_l') * 1000),
    steps: n(f, 'steps'), workouts_per_week: n(f, 'workouts_per_week'),
    bedtime_target: s(f, 'bedtime_target'),
    sleep_min_h: n(f, 'sleep_min_h'), sleep_max_h: n(f, 'sleep_max_h'),
    add_exercise_calories: f.add_exercise_calories === 'true',
  };
  const programme: ProgrammeFields = {
    name: s(f, 'name'),
    start_date: s(f, 'start_date'),
    weeks: n(f, 'weeks'),
    checkpoint_date: s(f, 'checkpoint_date') === '' ? null : s(f, 'checkpoint_date'),
    expectation: s(f, 'expectation'),
  };

  const errors: Record<string, string> = {
    ...(validateProfile(profile) as Record<string, string>),
    ...(validateProgramme(programme) as Record<string, string>),
  };
  for (const [k, v] of Object.entries(validateTargets(targets) as Record<string, string>)) {
    errors[k === 'water_ml' ? 'water_l' : k] = v;
  }
  // Whole-number targets: the database stores these as integers.
  for (const k of ['kcal_target', 'kcal_min', 'kcal_max', 'protein_target_g', 'protein_min_g', 'protein_max_g',
    'fat_min_g', 'fat_max_g', 'fibre_min_g', 'fibre_max_g'] as const) {
    if (!errors[k] && !Number.isInteger(targets[k])) errors[k] = 'Use a whole number';
  }

  let startingWeight: SetupValues['startingWeight'] = null;
  if (withStartingWeight) {
    const kg = n(f, 'weight_kg');
    const date = s(f, 'weight_date');
    const weightError = validateWeight(kg);
    if (weightError) errors.weight_kg = weightError;
    if (!isLocalDate(date)) errors.weight_date = 'Use YYYY-MM-DD';
    startingWeight = { date, weight_kg: Math.round(kg * 10) / 10 };
  }
  return { values: { profile, targets, programme, startingWeight }, errors };
}
