import { addDays } from '../domain/dates.ts';
import { buildReportData, narrativeText, reportFacts, reportPeriod, validateNarrative } from '../reports.ts';
import { coachContext, periodFacts, weightAverage } from '../summaries.ts';
import type { UserHistory } from '../types.ts';
import { enforceGuardrails, lowIntakeSuggestions } from './guardrails.ts';
import { coachSystem, reportSystem } from './prompts.ts';

const meal = (date: string, slot: 'breakfast' | 'lunch' | 'dinner' | 'snacks', name: string, kcal: number, protein: number, junk = false) =>
  ({ date, slot, source: 'home' as const, name, junk, edited: false, confidence: 'medium', kcal, protein_g: protein, carbs_g: 0, fat_g: 0, fibre_g: 5 });

function history(): UserHistory {
  return {
    today: '2026-11-24',
    profile: { display_name: 'Chaitanya', sex: 'male', age: 25, height_cm: 168, timezone: 'Asia/Kolkata', goal: 'Fat loss', diet: 'Indian non-veg', weak_spots: 'chai', daily_activity: '10k steps', training: 'home' },
    targets: { kcal_target: 2050, protein_min_g: 120, protein_target_g: 130, protein_max_g: 140, fat_min_g: 50, fat_max_g: 65, fibre_min_g: 25, fibre_max_g: 30, water_ml: 3000, steps: 10000, workouts_per_week: 3, bedtime_target: '23:30:00', add_exercise_calories: false },
    programme: { name: '12-week fat loss', start_date: '2026-11-17', weeks: 12, checkpoint_date: '2027-01-01', expectation: '3 to 4 kg' },
    meals: [
      meal('2026-11-17', 'breakfast', 'Poha', 270, 5), meal('2026-11-17', 'lunch', 'Chicken biryani', 600, 28), meal('2026-11-17', 'dinner', 'Dal and roti', 380, 16),
      meal('2026-11-18', 'breakfast', 'Poha', 270, 5), meal('2026-11-18', 'snacks', 'Samosa', 260, 4, true),
      meal('2026-11-24', 'breakfast', 'Omelette', 190, 13),
    ],
    logs: [
      { date: '2026-11-17', water_ml: 3000, steps: 11000, badminton: true, workout_done: false, in_bed_on_time: true, chai_sugar: 'half' },
      { date: '2026-11-18', water_ml: 1500, steps: null, badminton: false, workout_done: true, in_bed_on_time: false, chai_sugar: 'half' },
    ],
    weights: [{ date: '2026-11-12', weight_kg: 73 }, { date: '2026-11-17', weight_kg: 72.8 }, { date: '2026-11-18', weight_kg: 73.4 }, { date: '2026-11-23', weight_kg: 72.4 }],
    measurements: [{ date: '2026-11-22', waist_cm: 88 }],
  };
}

describe('coach context', () => {
  const ctx = coachContext(history());
  it('contains only logged data and marks gaps', () => {
    expect(ctx).toContain('TODAY: 2026-11-24 (Asia/Kolkata).');
    expect(ctx).toContain('2026-11-24 (today, still in progress): eaten ~190 kcal est.');
    expect(ctx).toContain('2026-11-22: nothing logged.');
    expect(ctx).toContain('2026-11-18 (only 1 of 3 main meals logged)');
    expect(ctx).toMatch(/2026-11-18 .*steps not logged; badminton no; strength workout yes/);
  });
  it('labels estimates and measurements', () => {
    expect(ctx).toContain('Calories and macros are ESTIMATES');
    expect(ctx).toMatch(/2026-11-17: eaten ~1250 kcal est\..*burn ~2600 kcal est\.; verdict Too low; weight 72.8 kg measured/);
  });
  it('gives 7-day weight averages, not single days', () => {
    expect(ctx).toContain('WEIGHT TREND (measured, 7-day averages): now 72.9 kg from 2 weigh-ins');
    expect(ctx).toContain('First record: 73 kg on 2026-11-12 (12 days ago)');
  });
  it('lists the most logged foods and flags junk', () => {
    expect(ctx).toMatch(/MOST LOGGED FOODS.*poha x2.*samosa x1 \[junk\]/);
  });
  it('builds the system prompt with the data and the right caveats', () => {
    expect(coachSystem(ctx, 'male')).toContain('USER DATA\nTODAY: 2026-11-24');
    expect(coachSystem(ctx, 'male')).not.toContain('menstrual');
    expect(coachSystem(ctx, 'female')).toContain('menstrual-cycle changes');
    expect(coachSystem(ctx, 'male')).toContain('Never recommend eating under 1,400 kcal');
  });
});

describe('averages', () => {
  it('averages weight over the 7 days ending on a date', () => {
    expect(weightAverage(history(), '2026-11-18')).toEqual({ avg: 73.07, count: 3 });
    expect(weightAverage(history(), '2026-11-11')).toBeNull();
  });
  it('averages intake over logged days only, never counting a blank day as zero', () => {
    const w = periodFacts(history(), '2026-11-23', 7);
    expect(w).toMatchObject({ start: '2026-11-17', daysWithMeals: 2, avg_kcal: 890, avg_steps: 11000, daysWithSteps: 1, workouts: 1, badmintonDays: 1, junkFreeDays: 1 });
    expect(w.weight_avg).toBe(72.87);
    expect(w.weight_avg_previous).toBe(73);
    expect(w.weight_change).toBe(-0.13);
    expect(w.waist_latest).toBe(88);
  });
});

describe('reports', () => {
  it('computes the daily numbers in code', () => {
    const d = buildReportData(history(), 'daily', '2026-11-17');
    expect(d).toMatchObject({ kind: 'daily', date: '2026-11-17', day: { kcal: 1250, protein_g: 49, mainMeals: 3, water_ml: 3000, steps: 11000, burn_estimate: 2600, verdict: 'Too low' } });
    const facts = reportFacts(d);
    expect(facts).toContain('Eaten (estimate): 1250 kcal (target 2050)');
    expect(facts).toContain('Weight (measured): today 72.8 kg');
  });
  it('computes the weekly numbers in code', () => {
    const d = buildReportData(history(), 'weekly', '2026-11-23');
    expect(d).toMatchObject({ kind: 'weekly', start: '2026-11-17', end: '2026-11-23', programme_week: 1 });
    expect(reportFacts(d)).toContain('Meals logged on 2 of 7 days');
    expect(reportFacts(d)).toContain('change -0.13 kg');
    expect(reportPeriod('weekly', '2026-11-23')).toEqual({ start: '2026-11-17', end: '2026-11-23' });
    expect(reportSystem('weekly', 'F')).toContain('2 to 4 practical suggestions for next week');
  });
  it('validates the narrative and renders it', () => {
    expect(validateNarrative({ headline: '', suggestions: ['x'] })).toBeNull();
    expect(validateNarrative('text')).toBeNull();
    const n = validateNarrative({ headline: 'Good day.', went_well: ['Water'], improve: [], suggestions: ['Eggs'], weight_comment: 'Too early.', extra: 1 })!;
    expect(n).toEqual({ headline: 'Good day.', went_well: ['Water'], improve: [], suggestions: ['Eggs'], weight_comment: 'Too early.' });
    expect(narrativeText(n)).toBe('Good day.\n\nWhat went well\n- Water\n\nNext\n- Eggs\n\nToo early.');
  });
});

describe('guardrails', () => {
  it('catches a recommended intake under 1,400 kcal', () => {
    expect(lowIntakeSuggestions('Try to eat around 1,200 kcal a day for faster results.')).toEqual([1200]);
    expect(lowIntakeSuggestions('Aim for 1100-1300 calories.')).toEqual([1100]);
    const r = enforceGuardrails('how do I lose faster', 'You could cut to 1200 kcal.', 2050);
    expect(r.flags).toContain('low_kcal');
    expect(r.text).toContain('never recommends eating under 1,400 kcal a day. Your target is 2,050 kcal.');
  });
  it('does not flag deficits, gaps or snacks', () => {
    expect(lowIntakeSuggestions('You are about 450 kcal under your burn.')).toEqual([]);
    expect(lowIntakeSuggestions('Eat a 120 kcal whey scoop.')).toEqual([]);
    expect(lowIntakeSuggestions('Keep eating about 2,050 kcal.')).toEqual([]);
    expect(lowIntakeSuggestions('You have 1,300 kcal left before maintenance, so eat a full dinner.')).toEqual([]);
    expect(enforceGuardrails('am I in a deficit', 'Yes, about 300 kcal under your burn on average.', 2050)).toEqual({ text: 'Yes, about 300 kcal under your burn on average.', flags: [] });
  });
  it('adds a caution for rapid-loss tactics', () => {
    expect(enforceGuardrails('should I do a water fast', 'A water fast is not needed.', 2050).flags).toEqual(['rapid_loss']);
    expect(enforceGuardrails('tips', 'Skip dinner twice a week.', 2050).flags).toEqual(['rapid_loss']);
  });
  it('sends symptoms to a doctor when the reply does not', () => {
    const r = enforceGuardrails('I have had acidity every morning for three weeks', 'Try not to have chai on an empty stomach.', 2050);
    expect(r.flags).toEqual(['see_doctor']);
    expect(r.text).toMatch(/see a doctor\.$/);
    expect(enforceGuardrails('my knee has pain', 'Rest it, and see a doctor if it persists.', 2050).flags).toEqual([]);
  });
  it('the facts given to the model come from logged data only', () => {
    const h = history();
    h.meals = []; h.logs = []; h.weights = []; h.measurements = [];
    const ctx = coachContext(h);
    expect(ctx).toContain('2026-11-24: nothing logged.');
    expect(ctx).toContain('now no weigh-ins in the last 7 days');
    expect(ctx).toContain('First record: none');
    expect(addDays(h.today, -13)).toBe('2026-11-11');
  });
});
