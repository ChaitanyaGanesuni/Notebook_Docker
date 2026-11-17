/* Shared by the app (src/domain re-exports it) and the Edge Functions. Keep it free of
   platform APIs, and use explicit .ts extensions in imports so Deno can load it. */
/** Deficit verdict for a day (brief section 5). Pure: the same inputs always give the same verdict. */

export type VerdictKind = 'none' | 'in_progress' | 'surplus' | 'too_low' | 'deficit' | 'maintenance';

export interface Verdict {
  kind: VerdictKind;
  label: string;
  message: string;
  /** Extra caution for past days with missing meals. */
  note: string | null;
  /** burn − eaten, rounded to the nearest 10. */
  diff: number;
}

export interface VerdictInput {
  /** Estimated burn for the day, kcal. */
  burn: number;
  /** Calories eaten, kcal. */
  eaten: number;
  /** How many of breakfast, lunch and dinner have at least one entry (0 to 3). */
  mainMeals: number;
  /** Total entries logged in any slot. */
  entries: number;
  isToday: boolean;
}

export const MAINTENANCE_BAND = 150;
export const TOO_LOW_KCAL = 1400;

const about = (n: number) => Math.round(Math.abs(n) / 10) * 10;
const fmt = (n: number) => n.toLocaleString('en-IN');

export function dayVerdict(i: VerdictInput): Verdict {
  const exact = i.burn - i.eaten;
  const diff = Math.round(exact / 10) * 10;
  const n = fmt(about(exact));

  if (i.entries === 0) {
    return { kind: 'none', label: 'No meals yet', message: i.isToday ? 'Add your first meal to start the day.' : 'Nothing was logged on this day.', note: null, diff };
  }
  if (i.isToday && i.mainMeals < 3) {
    return exact > 0
      ? { kind: 'in_progress', label: 'In progress', message: `About ${n} kcal left before you reach maintenance`, note: null, diff }
      : { kind: 'surplus', label: 'Surplus', message: `Already about ${n} kcal over your estimated burn`, note: null, diff };
  }
  const note = !i.isToday && i.mainMeals < 3 ? `Only ${i.mainMeals} of 3 meals logged, so this may be off.` : null;
  if (i.mainMeals >= 3 && i.eaten < TOO_LOW_KCAL) {
    return { kind: 'too_low', label: 'Too low', message: 'This is too little to train and recover on. Eat more.', note, diff };
  }
  if (exact > MAINTENANCE_BAND) return { kind: 'deficit', label: 'Deficit', message: `About ${n} kcal under your estimated burn`, note, diff };
  if (exact < -MAINTENANCE_BAND) return { kind: 'surplus', label: 'Surplus', message: `About ${n} kcal over your estimated burn`, note, diff };
  return { kind: 'maintenance', label: 'Maintenance', message: `Within ${MAINTENANCE_BAND} kcal of your estimated burn`, note, diff };
}
