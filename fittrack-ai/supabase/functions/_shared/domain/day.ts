/* Shared by the app (src/domain re-exports it) and the Edge Functions. Keep it free of
   platform APIs, and use explicit .ts extensions in imports so Deno can load it. */
/** Everything shown for one day, derived from what was logged. Nothing here is asked of the user. */
import { BADMINTON_KCAL, estimateBurn, weightOnOrBefore, WORKOUT_KCAL } from './burn.ts';
import type { Sex } from './burn.ts';
import { junkFree, mainMealsLogged, totals, type MealLike, type Totals } from './meals.ts';
import { dayVerdict, type Verdict } from './verdict.ts';

export interface DayInput {
  date: string;
  today: string;
  profile: { sex: Sex; age: number; height_cm: number };
  targets: { kcal_target: number; protein_min_g: number; protein_target_g: number; water_ml: number; steps: number; add_exercise_calories: boolean };
  log: { water_ml: number; steps: number | null; badminton: boolean; workout_done: boolean; in_bed_on_time: boolean } | null;
  meals: readonly MealLike[];
  weights: readonly { date: string; weight_kg: number }[];
}

export interface ScoreItem { key: 'deficit' | 'protein' | 'water' | 'steps' | 'junk_free' | 'bed'; label: string; met: boolean }

export interface DaySummary {
  totals: Totals;
  /** null when no weight has been logged on or before the day: the burn cannot be estimated. */
  burn: number | null;
  verdict: Verdict | null;
  /** Calorie target for the ring. Exercise is only added when the user switched that setting on. */
  kcalTarget: number;
  score: { met: number; of: number; items: ScoreItem[] };
  mainMeals: number;
}

export function summariseDay(i: DayInput): DaySummary {
  const t = totals(i.meals);
  const mainMeals = mainMealsLogged(i.meals);
  const weight = weightOnOrBefore(i.weights, i.date);
  const burn = weight === null ? null : estimateBurn({
    weightKg: weight, heightCm: Number(i.profile.height_cm), age: i.profile.age, sex: i.profile.sex,
    steps: i.log?.steps ?? null, badminton: i.log?.badminton ?? false, workout: i.log?.workout_done ?? false,
  });
  const verdict = burn === null ? null
    : dayVerdict({ burn, eaten: t.kcal, mainMeals, entries: i.meals.length, isToday: i.date === i.today });
  const exercise = (i.log?.badminton ? BADMINTON_KCAL : 0) + (i.log?.workout_done ? WORKOUT_KCAL : 0);
  const kcalTarget = i.targets.kcal_target + (i.targets.add_exercise_calories ? exercise : 0);

  const items: ScoreItem[] = [
    { key: 'deficit', label: 'Deficit', met: verdict?.kind === 'deficit' },
    { key: 'protein', label: `Protein ${i.targets.protein_min_g} g+`, met: t.protein_g >= i.targets.protein_min_g },
    { key: 'water', label: `Water ${i.targets.water_ml / 1000} L`, met: (i.log?.water_ml ?? 0) >= i.targets.water_ml },
    { key: 'steps', label: `${Math.round(i.targets.steps / 1000)}k steps`, met: (i.log?.steps ?? 0) >= i.targets.steps },
    { key: 'junk_free', label: 'Junk-free', met: junkFree(i.meals) },
    { key: 'bed', label: 'In bed on time', met: i.log?.in_bed_on_time ?? false },
  ];
  return { totals: t, burn, verdict, kcalTarget, score: { met: items.filter((x) => x.met).length, of: items.length, items }, mainMeals };
}
