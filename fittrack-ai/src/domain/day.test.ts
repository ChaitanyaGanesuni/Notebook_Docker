import { bmr, estimateBurn, weightOnOrBefore } from './burn';
import { summariseDay, type DayInput } from './day';
import { FOODS, searchFoods } from './foods';
import { chai, junkFree, macroCheck, mainMealsLogged, nextSource, plannedChaiSugar, proteinTick, totals, WHEY_SCOOP, type MealLike } from './meals';
import { dayVerdict } from './verdict';

const me = { weightKg: 73, heightCm: 168, age: 25, sex: 'male' as const };
const meal = (slot: MealLike['slot'], kcal: number | null, protein = 0, junk = false): MealLike =>
  ({ slot, kcal, protein_g: protein, carbs_g: null, fat_g: null, fibre_g: null, junk });

describe('burn estimate', () => {
  it('matches the brief: BMR 1,660 and burn 2,250 at 73 kg with nothing logged', () => {
    expect(bmr(73, 168, 25, 'male')).toBe(1660);
    expect(estimateBurn({ ...me, steps: null, badminton: false, workout: false })).toBe(2250);
  });
  it('uses −161 for female', () => {
    expect(bmr(73, 168, 25, 'female')).toBe(1494);
  });
  it('adds steps, badminton and strength work, and rounds to the nearest 10', () => {
    expect(estimateBurn({ ...me, steps: 10000, badminton: false, workout: false })).toBe(2330); // 2075 + 250 = 2325 → 2330
    expect(estimateBurn({ ...me, steps: 10000, badminton: true, workout: true })).toBe(2680); // 2675 → 2680
    expect(estimateBurn({ ...me, steps: 0, badminton: false, workout: false })).toBe(2080); // 2075 → 2080
  });
  it('caps steps at 25,000', () => {
    const capped = estimateBurn({ ...me, steps: 25000, badminton: false, workout: false });
    expect(estimateBurn({ ...me, steps: 60000, badminton: false, workout: false })).toBe(capped);
    expect(capped).toBe(2700);
  });
  it('uses the most recent weight on or before the day', () => {
    const logs = [{ date: '2026-11-17', weight_kg: 72.6 }, { date: '2026-11-12', weight_kg: 73 }, { date: '2026-11-20', weight_kg: 72.1 }];
    expect(weightOnOrBefore(logs, '2026-11-11')).toBeNull();
    expect(weightOnOrBefore(logs, '2026-11-12')).toBe(73);
    expect(weightOnOrBefore(logs, '2026-11-19')).toBe(72.6);
    expect(weightOnOrBefore(logs, '2027-01-01')).toBe(72.1);
  });
});

describe('verdict table', () => {
  const v = (eaten: number, mainMeals: number, entries: number, isToday: boolean, burn = 2250) => dayVerdict({ burn, eaten, mainMeals, entries, isToday });
  it('brief fixture: 120 kcal eaten today, fewer than 3 main meals → In progress, about 2,130 left', () => {
    expect(v(120, 0, 1, true)).toMatchObject({ kind: 'in_progress', label: 'In progress', message: 'About 2,130 kcal left before you reach maintenance', diff: 2130 });
  });
  it('no meals logged', () => {
    expect(v(0, 0, 0, true)).toMatchObject({ kind: 'none', label: 'No meals yet' });
    expect(v(0, 0, 0, false).kind).toBe('none');
  });
  it('today, fewer than 3 main meals, already over the burn → Surplus', () => {
    expect(v(2400, 2, 3, true)).toMatchObject({ kind: 'surplus', message: 'Already about 150 kcal over your estimated burn' });
    expect(v(2250, 2, 3, true).kind).toBe('surplus'); // diff ≤ 0
  });
  it('all 3 main meals and under 1,400 → Too low', () => {
    expect(v(1399, 3, 3, true).kind).toBe('too_low');
    expect(v(1399, 3, 3, false).kind).toBe('too_low');
    expect(v(1400, 3, 3, true).kind).toBe('deficit');
  });
  it('deficit, surplus and maintenance at the 150 kcal boundaries', () => {
    expect(v(2099, 3, 3, true)).toMatchObject({ kind: 'deficit', message: 'About 150 kcal under your estimated burn' });
    expect(v(2100, 3, 3, true).kind).toBe('maintenance'); // diff exactly 150
    expect(v(2400, 3, 3, true)).toMatchObject({ kind: 'maintenance', message: 'Within 150 kcal of your estimated burn' }); // diff exactly −150
    expect(v(2401, 3, 3, true).kind).toBe('surplus');
    expect(v(1800, 3, 4, false)).toMatchObject({ kind: 'deficit', message: 'About 450 kcal under your estimated burn', note: null });
  });
  it('past days with missing meals carry a caution and are never "in progress"', () => {
    expect(v(900, 2, 2, false)).toMatchObject({ kind: 'deficit', note: 'Only 2 of 3 meals logged, so this may be off.' });
    expect(v(120, 0, 1, false).kind).toBe('deficit');
  });
});

describe('meals', () => {
  const meals = [meal('breakfast', 270, 5), meal('breakfast', 150, 12.5), meal('lunch', 650, 30), meal('snacks', 120, 24)];
  it('totals entries and ignores empty numbers', () => {
    expect(totals([...meals, meal('dinner', null)])).toMatchObject({ kcal: 1190, protein_g: 71.5 });
  });
  it('counts main meals and awards protein ticks at 20 g', () => {
    expect(mainMealsLogged(meals)).toBe(2);
    expect(proteinTick('breakfast', meals)).toBe(false); // 17.5 g
    expect(proteinTick('lunch', meals)).toBe(true);
    expect(proteinTick('breakfast', [meal('breakfast', 300, 20)])).toBe(true);
    expect(proteinTick('snacks', meals)).toBe(false);
  });
  it('junk-free needs at least one meal and no junk', () => {
    expect(junkFree([])).toBe(false);
    expect(junkFree(meals)).toBe(true);
    expect(junkFree([...meals, meal('snacks', 260, 4, true)])).toBe(false);
  });
  it('quick adds match the brief', () => {
    expect(WHEY_SCOOP).toMatchObject({ kcal: 120, protein_g: 24 });
    expect([chai('full').kcal, chai('half').kcal, chai('none').kcal]).toEqual([90, 70, 50]);
    expect(chai('half').protein_g).toBe(2);
    expect([plannedChaiSugar(null), plannedChaiSugar(1), plannedChaiSugar(2), plannedChaiSugar(3), plannedChaiSugar(12)]).toEqual(['full', 'half', 'half', 'none', 'none']);
  });
  it('cycles the source tag', () => {
    expect([nextSource('home'), nextSource('canteen'), nextSource('ordered')]).toEqual(['canteen', 'ordered', 'home']);
  });
  it('searches the food list', () => {
    expect(searchFoods(FOODS, 'po')[0]?.name).toBe('Poha');
    expect(searchFoods(FOODS, 'chicken').map((f) => f.name)).toContain('Tandoori chicken');
    expect(searchFoods(FOODS, 'p')).toEqual([]);
    expect(FOODS.every((f) => f.kcal >= 0 && f.kcal <= 5000 && f.protein_g <= 300)).toBe(true);
  });
});

describe('macro check', () => {
  it('brief fixture: flags 1,663.2 kcal against 1,548.5 from macros and changes nothing', () => {
    const entry = { kcal: 1663.2, protein_g: 105, carbs_g: 173, fat_g: 48.5, fibre_g: 23 };
    const before = JSON.stringify(entry);
    const check = macroCheck(entry)!;
    expect(check.computed).toBe(1548.5);
    expect(check.gap).toBe(114.7);
    expect(check.discrepancy).toBe(true);
    expect(check.note).toContain('1,548.5 kcal');
    expect(check.note).toMatch(/oil, sugar or alcohol/);
    expect(JSON.stringify(entry)).toBe(before);
  });
  it('stays quiet when macros explain the calories, or when data is missing', () => {
    expect(macroCheck({ kcal: 270, protein_g: 5, carbs_g: 45, fat_g: 8, fibre_g: 3 })).toMatchObject({ computed: 272, discrepancy: false, note: null });
    expect(macroCheck({ kcal: 270, protein_g: 5, carbs_g: null, fat_g: 8, fibre_g: 3 })).toBeNull();
    expect(macroCheck({ kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fibre_g: 0 })).toBeNull();
  });
  it('says when the calorie figure looks too low', () => {
    expect(macroCheck({ kcal: 200, protein_g: 20, carbs_g: 30, fat_g: 10, fibre_g: 0 })!.note).toMatch(/more than logged/);
  });
});

describe('day summary and score', () => {
  const base: DayInput = {
    date: '2026-11-17', today: '2026-11-17',
    profile: { sex: 'male', age: 25, height_cm: 168 },
    targets: { kcal_target: 2050, protein_min_g: 120, protein_target_g: 130, water_ml: 3000, steps: 10000, add_exercise_calories: false },
    log: null, meals: [], weights: [{ date: '2026-11-12', weight_kg: 73 }],
  };
  it('brief fixture end to end: one 120 kcal snack today', () => {
    const s = summariseDay({ ...base, meals: [meal('snacks', 120, 24)] });
    expect(s.burn).toBe(2250);
    expect(s.verdict).toMatchObject({ kind: 'in_progress', message: 'About 2,130 kcal left before you reach maintenance' });
    expect(s.score).toMatchObject({ met: 1, of: 6 }); // junk-free only
  });
  it('scores all six on a perfect day', () => {
    const s = summariseDay({
      ...base, date: '2026-11-16', // a past day
      log: { water_ml: 3000, steps: 10000, badminton: true, workout_done: false, in_bed_on_time: true },
      meals: [meal('breakfast', 500, 40), meal('lunch', 700, 45), meal('dinner', 650, 40)],
    });
    expect(s.burn).toBe(2580);
    expect(s.verdict?.kind).toBe('deficit');
    expect(s.score.met).toBe(6);
  });
  it('has no burn or verdict before any weight is logged', () => {
    const s = summariseDay({ ...base, weights: [] });
    expect(s.burn).toBeNull();
    expect(s.verdict).toBeNull();
    expect(s.score.items.find((x) => x.key === 'deficit')?.met).toBe(false);
  });
  it('keeps the calorie target fixed unless exercise calories are switched on', () => {
    const log = { water_ml: 0, steps: null, badminton: true, workout_done: true, in_bed_on_time: false };
    expect(summariseDay({ ...base, log }).kcalTarget).toBe(2050);
    expect(summariseDay({ ...base, log, targets: { ...base.targets, add_exercise_calories: true } }).kcalTarget).toBe(2400);
  });
});
