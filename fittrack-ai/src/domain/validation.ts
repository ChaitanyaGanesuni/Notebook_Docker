/** Input validation for onboarding and settings. Pure: returns field → message. */
import { isLocalDate } from './dates';
import type { ProfileFields, ProgrammeFields, TargetFields } from './defaults';

export type FieldErrors<T> = Partial<Record<keyof T | '_form', string>>;

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function inRange(n: unknown, min: number, max: number): n is number {
  return typeof n === 'number' && Number.isFinite(n) && n >= min && n <= max;
}

/** Parses user-typed numbers; returns NaN for anything that is not a plain number. */
export function parseNumber(text: string): number {
  const t = text.trim().replace(',', '.');
  return /^-?\d+(\.\d+)?$/.test(t) ? Number(t) : NaN;
}

export function validateProfile(p: ProfileFields): FieldErrors<ProfileFields> {
  const e: FieldErrors<ProfileFields> = {};
  if (!p.display_name.trim()) e.display_name = 'Enter a name';
  else if (p.display_name.trim().length > 60) e.display_name = 'Keep the name under 60 characters';
  if (p.sex !== 'male' && p.sex !== 'female') e.sex = 'Choose one (used only for the burn formula)';
  if (!Number.isInteger(p.age) || !inRange(p.age, 18, 100)) e.age = 'This app is for adults aged 18 to 100';
  if (!inRange(p.height_cm, 100, 250)) e.height_cm = 'Enter height between 100 and 250 cm';
  if (!TIME_RE.test(p.wake_time)) e.wake_time = 'Use 24-hour HH:MM';
  if (!TIME_RE.test(p.bed_time)) e.bed_time = 'Use 24-hour HH:MM';
  if (!isValidTimeZone(p.timezone)) e.timezone = 'Unknown timezone';
  return e;
}

export function validateWeight(weightKg: number): string | undefined {
  return inRange(weightKg, 20, 300) ? undefined : 'Enter weight between 20 and 300 kg';
}

export function validateTargets(t: TargetFields): FieldErrors<TargetFields> {
  const e: FieldErrors<TargetFields> = {};
  // The coach never recommends under 1,400 kcal, so the target cannot go below it either.
  if (!inRange(t.kcal_target, 1400, 5000)) e.kcal_target = 'Calories must be between 1,400 and 5,000';
  if (!inRange(t.kcal_min, 1400, 5000)) e.kcal_min = 'Must be between 1,400 and 5,000';
  if (!inRange(t.kcal_max, 1400, 5000)) e.kcal_max = 'Must be between 1,400 and 5,000';
  if (!e.kcal_min && !e.kcal_max && !e.kcal_target && !(t.kcal_min <= t.kcal_target && t.kcal_target <= t.kcal_max)) {
    e.kcal_target = 'Target must sit inside its range';
  }
  if (!inRange(t.protein_target_g, 30, 300)) e.protein_target_g = 'Protein must be between 30 and 300 g';
  if (!inRange(t.protein_min_g, 30, 300)) e.protein_min_g = 'Must be between 30 and 300 g';
  if (!inRange(t.protein_max_g, 30, 300)) e.protein_max_g = 'Must be between 30 and 300 g';
  if (
    !e.protein_min_g && !e.protein_max_g && !e.protein_target_g &&
    !(t.protein_min_g <= t.protein_target_g && t.protein_target_g <= t.protein_max_g)
  ) {
    e.protein_target_g = 'Target must sit inside its range';
  }
  if (!inRange(t.fat_min_g, 10, 300)) e.fat_min_g = 'Must be between 10 and 300 g';
  if (!inRange(t.fat_max_g, 10, 300) || t.fat_max_g < t.fat_min_g) e.fat_max_g = 'Must be at least the minimum';
  if (!inRange(t.fibre_min_g, 0, 100)) e.fibre_min_g = 'Must be between 0 and 100 g';
  if (!inRange(t.fibre_max_g, 0, 100) || t.fibre_max_g < t.fibre_min_g) e.fibre_max_g = 'Must be at least the minimum';
  if (!inRange(t.water_ml, 500, 10000)) e.water_ml = 'Water must be between 0.5 and 10 L';
  if (!Number.isInteger(t.steps) || !inRange(t.steps, 1000, 50000)) e.steps = 'Steps must be between 1,000 and 50,000';
  if (!Number.isInteger(t.workouts_per_week) || !inRange(t.workouts_per_week, 0, 7)) {
    e.workouts_per_week = 'Must be between 0 and 7';
  }
  if (!TIME_RE.test(t.bedtime_target)) e.bedtime_target = 'Use 24-hour HH:MM';
  if (!inRange(t.sleep_min_h, 3, 14)) e.sleep_min_h = 'Must be between 3 and 14 hours';
  if (!inRange(t.sleep_max_h, 3, 14) || t.sleep_max_h < t.sleep_min_h) e.sleep_max_h = 'Must be at least the minimum';
  return e;
}

export function validateProgramme(p: ProgrammeFields): FieldErrors<ProgrammeFields> {
  const e: FieldErrors<ProgrammeFields> = {};
  if (!isLocalDate(p.start_date)) e.start_date = 'Use YYYY-MM-DD';
  if (!Number.isInteger(p.weeks) || !inRange(p.weeks, 1, 52)) e.weeks = 'Must be between 1 and 52 weeks';
  if (p.checkpoint_date !== null) {
    if (!isLocalDate(p.checkpoint_date)) e.checkpoint_date = 'Use YYYY-MM-DD';
    else if (!e.start_date && p.checkpoint_date < p.start_date) e.checkpoint_date = 'Checkpoint is before the start';
  }
  return e;
}

export function isValidTimeZone(tz: string): boolean {
  if (!tz) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export function hasErrors(errors: object): boolean {
  return Object.keys(errors).length > 0;
}

export function validateEmail(email: string): string | undefined {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ? undefined : 'Enter a valid email address';
}

export function validatePassword(password: string): string | undefined {
  return password.length >= 8 ? undefined : 'Use at least 8 characters';
}
