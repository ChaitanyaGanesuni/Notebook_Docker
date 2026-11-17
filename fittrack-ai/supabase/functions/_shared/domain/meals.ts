/* Shared by the app (src/domain re-exports it) and the Edge Functions. Keep it free of
   platform APIs, and use explicit .ts extensions in imports so Deno can load it. */
/** Meal slots, totals, quick adds, the macro check, and everything derived from meals. */

export type Slot = 'breakfast' | 'lunch' | 'dinner' | 'snacks';
export type Source = 'home' | 'canteen' | 'ordered';
export type ChaiSugar = 'full' | 'half' | 'none';

export const SLOTS: readonly Slot[] = ['breakfast', 'lunch', 'dinner', 'snacks'];
export const MAIN_SLOTS: readonly Slot[] = ['breakfast', 'lunch', 'dinner'];
export const SLOT_LABEL: Record<Slot, string> = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', snacks: 'Snacks' };
export const SOURCE_LABEL: Record<Source, string> = { home: 'Home', canteen: 'Canteen', ordered: 'Ordered' };
export const DEFAULT_SOURCE: Record<Slot, Source> = { breakfast: 'home', lunch: 'canteen', dinner: 'home', snacks: 'home' };

const SOURCES: readonly Source[] = ['home', 'canteen', 'ordered'];
export function nextSource(s: Source): Source {
  return SOURCES[(SOURCES.indexOf(s) + 1) % SOURCES.length] ?? 'home';
}

export interface MealNumbers {
  kcal: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  fibre_g: number | null;
}

export interface MealLike extends MealNumbers {
  slot: Slot;
  junk: boolean;
}

export interface Totals { kcal: number; protein_g: number; carbs_g: number; fat_g: number; fibre_g: number }

const num = (v: number | null | undefined) => (v == null || !Number.isFinite(Number(v)) ? 0 : Number(v));

export function totals(meals: readonly MealNumbers[]): Totals {
  const t: Totals = { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fibre_g: 0 };
  for (const m of meals) {
    t.kcal += num(m.kcal); t.protein_g += num(m.protein_g); t.carbs_g += num(m.carbs_g);
    t.fat_g += num(m.fat_g); t.fibre_g += num(m.fibre_g);
  }
  return t;
}

/** How many of breakfast, lunch and dinner have at least one entry. */
export function mainMealsLogged(meals: readonly MealLike[]): number {
  return MAIN_SLOTS.filter((s) => meals.some((m) => m.slot === s)).length;
}

export const PROTEIN_TICK_G = 20;
/** A main meal earns its protein tick at 20 g or more. Snacks never show one. */
export function proteinTick(slot: Slot, meals: readonly MealLike[]): boolean {
  if (slot === 'snacks') return false;
  return totals(meals.filter((m) => m.slot === slot)).protein_g >= PROTEIN_TICK_G;
}

/** Junk-free day: at least one meal logged and none flagged junk. */
export function junkFree(meals: readonly MealLike[]): boolean {
  return meals.length > 0 && !meals.some((m) => m.junk);
}

// ---------------------------------------------------------------- quick adds

export interface QuickAdd { name: string; kcal: number; protein_g: number; carbs_g: number; fat_g: number; fibre_g: number; junk: boolean }

export const WHEY_SCOOP: QuickAdd = { name: 'Whey scoop', kcal: 120, protein_g: 24, carbs_g: 3, fat_g: 1.5, fibre_g: 0, junk: false };

const CHAI_KCAL: Record<ChaiSugar, number> = { full: 90, half: 70, none: 50 };
const CHAI_CARBS: Record<ChaiSugar, number> = { full: 14, half: 9, none: 4 };
export function chai(sugar: ChaiSugar): QuickAdd {
  const label = sugar === 'full' ? 'full sugar' : sugar === 'half' ? 'half sugar' : 'no sugar';
  return { name: `Chai, ${label}`, kcal: CHAI_KCAL[sugar], protein_g: 2, carbs_g: CHAI_CARBS[sugar], fat_g: 2.5, fibre_g: 0, junk: false };
}

/** The plan: half sugar in weeks 1 and 2, none from week 3. Full before the programme starts. */
export function plannedChaiSugar(programmeWeek: number | null): ChaiSugar {
  if (programmeWeek === null) return 'full';
  return programmeWeek >= 3 ? 'none' : 'half';
}

// --------------------------------------------------------------- macro check

/**
 * Relative gap between logged calories and what the macros explain, above which a note is shown.
 * The brief's rule says 10 percent, but its own fixture (1,663.2 kcal logged, 1,548.5 from macros,
 * a 6.9 percent gap) must show a note, so the threshold is 5 percent until that is settled.
 */
export const MACRO_GAP_THRESHOLD = 0.05;

export interface MacroCheck {
  /** protein × 4 + carbs × 4 + fat × 9 */
  computed: number;
  gap: number;
  gapFraction: number;
  discrepancy: boolean;
  note: string | null;
}

/** Never changes any value: it only reports. Returns null when there is not enough data to check. */
export function macroCheck(m: MealNumbers): MacroCheck | null {
  if (m.kcal == null || m.protein_g == null || m.carbs_g == null || m.fat_g == null) return null;
  const kcal = Number(m.kcal);
  if (!(kcal > 0)) return null;
  const computed = Math.round((Number(m.protein_g) * 4 + Number(m.carbs_g) * 4 + Number(m.fat_g) * 9) * 10) / 10;
  const gap = Math.round((kcal - computed) * 10) / 10;
  const gapFraction = Math.abs(gap) / kcal;
  const discrepancy = gapFraction > MACRO_GAP_THRESHOLD;
  const note = !discrepancy ? null
    : gap > 0
      ? `Macros add up to ${computed.toLocaleString('en-IN')} kcal, ${Math.abs(gap).toLocaleString('en-IN')} less than logged. Cooking oil, sugar or alcohol may be missing from the macros.`
      : `Macros add up to ${computed.toLocaleString('en-IN')} kcal, ${Math.abs(gap).toLocaleString('en-IN')} more than logged. The calorie figure may be too low.`;
  return { computed, gap, gapFraction, discrepancy, note };
}
