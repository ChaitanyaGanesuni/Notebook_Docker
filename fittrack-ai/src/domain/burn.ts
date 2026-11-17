/** Estimated daily energy burn (brief section 5). Always an estimate; label it as one in the UI. */
import type { Sex } from './defaults';

export interface BurnInput {
  weightKg: number;
  heightCm: number;
  age: number;
  sex: Sex;
  /** null = not logged yet (7,000 is assumed). */
  steps: number | null;
  badminton: boolean;
  workout: boolean;
}

export const ASSUMED_STEPS = 7000;
export const STEP_CAP = 25000;
export const BADMINTON_KCAL = 250;
export const WORKOUT_KCAL = 100;

/** Mifflin-St Jeor. */
export function bmr(weightKg: number, heightCm: number, age: number, sex: Sex): number {
  return 10 * weightKg + 6.25 * heightCm - 5 * age + (sex === 'female' ? -161 : 5);
}

export function estimateBurn(i: BurnInput): number {
  const steps = Math.min(Math.max(i.steps ?? ASSUMED_STEPS, 0), STEP_CAP);
  const raw = bmr(i.weightKg, i.heightCm, i.age, i.sex) * 1.25
    + steps * 0.025
    + (i.badminton ? BADMINTON_KCAL : 0)
    + (i.workout ? WORKOUT_KCAL : 0);
  return Math.round(raw / 10) * 10;
}

/** The most recent weight logged on or before `date`, or null. `logs` may be in any order. */
export function weightOnOrBefore(logs: readonly { date: string; weight_kg: number }[], date: string): number | null {
  let best: { date: string; weight_kg: number } | null = null;
  for (const l of logs) {
    if (l.date <= date && (best === null || l.date > best.date)) best = l;
  }
  return best ? Number(best.weight_kg) : null;
}
