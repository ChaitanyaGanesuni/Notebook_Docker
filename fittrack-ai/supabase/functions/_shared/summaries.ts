/**
 * Numbers for the coach and the reports, computed in code from logged data.
 * The model only ever writes words around these; it never produces the figures.
 */
import { addDays, diffDays } from './domain/dates.ts';
import { summariseDay, type DaySummary } from './domain/day.ts';
import { daysUntil, programmeProgress } from './domain/programme.ts';
import type { UserHistory } from './types.ts';

const round = (n: number, dp = 0) => Math.round(n * 10 ** dp) / 10 ** dp;
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

export interface DayFacts {
  date: string;
  logged: boolean;
  entries: number;
  mainMeals: number;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fibre_g: number;
  water_ml: number | null;
  steps: number | null;
  badminton: boolean;
  workout: boolean;
  in_bed_on_time: boolean;
  weight_kg: number | null;
  waist_cm: number | null;
  burn_estimate: number | null;
  verdict: string | null;
  verdict_note: string | null;
  score: number;
  junk_entries: number;
}

export function dayFacts(h: UserHistory, date: string): DayFacts & { summary: DaySummary } {
  const meals = h.meals.filter((m) => m.date === date);
  const log = h.logs.find((l) => l.date === date) ?? null;
  const summary = summariseDay({ date, today: h.today, profile: h.profile, targets: h.targets, log, meals, weights: h.weights });
  const weight = h.weights.find((w) => w.date === date);
  return {
    date, summary,
    logged: meals.length > 0 || log !== null || weight !== undefined,
    entries: meals.length,
    mainMeals: summary.mainMeals,
    kcal: round(summary.totals.kcal), protein_g: round(summary.totals.protein_g), carbs_g: round(summary.totals.carbs_g),
    fat_g: round(summary.totals.fat_g), fibre_g: round(summary.totals.fibre_g),
    water_ml: log ? log.water_ml : null,
    steps: log?.steps ?? null,
    badminton: log?.badminton ?? false,
    workout: log?.workout_done ?? false,
    in_bed_on_time: log?.in_bed_on_time ?? false,
    weight_kg: weight ? Number(weight.weight_kg) : null,
    waist_cm: h.measurements.find((m) => m.date === date)?.waist_cm ?? null,
    burn_estimate: summary.burn,
    verdict: summary.verdict && summary.verdict.kind !== 'none' ? summary.verdict.label : null,
    verdict_note: summary.verdict?.note ?? null,
    score: summary.score.met,
    junk_entries: meals.filter((m) => m.junk).length,
  };
}

/** Mean of weigh-ins in the 7 days ending on `end` (inclusive). Null when there are none. */
export function weightAverage(h: UserHistory, end: string, days = 7): { avg: number; count: number } | null {
  const start = addDays(end, -(days - 1));
  const xs = h.weights.filter((w) => w.date >= start && w.date <= end).map((w) => Number(w.weight_kg));
  const m = mean(xs);
  return m === null ? null : { avg: round(m, 2), count: xs.length };
}

export interface PeriodFacts {
  start: string;
  end: string;
  days: number;
  daysWithMeals: number;
  /** Averages over days that have meals logged; days with nothing logged are left out, never counted as zero. */
  avg_kcal: number | null;
  avg_protein_g: number | null;
  avg_fibre_g: number | null;
  avg_water_ml: number | null;
  avg_steps: number | null;
  daysWithSteps: number;
  workouts: number;
  badmintonDays: number;
  deficitDays: number;
  junkFreeDays: number;
  proteinDays: number;
  waterDays: number;
  stepDays: number;
  bedDays: number;
  weight_avg: number | null;
  weight_avg_previous: number | null;
  weight_change: number | null;
  weighIns: number;
  waist_latest: number | null;
}

export function periodFacts(h: UserHistory, end: string, days: number): PeriodFacts {
  const start = addDays(end, -(days - 1));
  const facts = Array.from({ length: days }, (_, i) => dayFacts(h, addDays(start, i)));
  const withMeals = facts.filter((f) => f.entries > 0);
  const withLog = h.logs.filter((l) => l.date >= start && l.date <= end);
  const withSteps = withLog.filter((l) => l.steps !== null);
  const now = weightAverage(h, end, days);
  const before = weightAverage(h, addDays(end, -days), days);
  const waist = h.measurements.filter((m) => m.date >= start && m.date <= end && m.waist_cm !== null).sort((a, b) => a.date.localeCompare(b.date)).pop();
  const met = (key: string) => facts.filter((f) => f.summary.score.items.find((i) => i.key === key)?.met).length;
  return {
    start, end, days,
    daysWithMeals: withMeals.length,
    avg_kcal: withMeals.length ? round(mean(withMeals.map((f) => f.kcal))!) : null,
    avg_protein_g: withMeals.length ? round(mean(withMeals.map((f) => f.protein_g))!) : null,
    avg_fibre_g: withMeals.length ? round(mean(withMeals.map((f) => f.fibre_g))!) : null,
    avg_water_ml: withLog.length ? round(mean(withLog.map((l) => l.water_ml))!) : null,
    avg_steps: withSteps.length ? round(mean(withSteps.map((l) => l.steps as number))!) : null,
    daysWithSteps: withSteps.length,
    workouts: facts.filter((f) => f.workout).length,
    badmintonDays: facts.filter((f) => f.badminton).length,
    deficitDays: met('deficit'),
    junkFreeDays: met('junk_free'),
    proteinDays: met('protein'),
    waterDays: met('water'),
    stepDays: met('steps'),
    bedDays: met('bed'),
    weight_avg: now?.avg ?? null,
    weight_avg_previous: before?.avg ?? null,
    weight_change: now && before ? round(now.avg - before.avg, 2) : null,
    weighIns: now?.count ?? 0,
    waist_latest: waist?.waist_cm == null ? null : Number(waist.waist_cm),
  };
}

export function programmeLine(h: UserHistory, date: string): string {
  const p = h.programme;
  if (!p) return 'No programme set.';
  const pr = programmeProgress({ startDate: p.start_date, weeks: p.weeks }, date);
  const cp = p.checkpoint_date ? daysUntil(p.checkpoint_date, date) : null;
  const where = pr.status === 'active' ? `week ${pr.week} of ${pr.totalWeeks}, day ${pr.day} of ${pr.totalDays}`
    : pr.status === 'upcoming' ? `starts in ${pr.daysToStart} days (${p.start_date})` : `finished ${pr.daysSinceEnd} days ago`;
  return `Programme "${p.name}": ${where}.${cp !== null && cp >= 0 ? ` ${cp} days to the ${p.checkpoint_date} checkpoint.` : ''} Expectation: ${p.expectation || 'not set'}.`;
}

const yes = (b: boolean) => (b ? 'yes' : 'no');
const fmt = (n: number | null, unit = '') => (n === null ? 'not logged' : `${n}${unit}`);

/**
 * The coach's view of the user's history: plain text with every value labelled
 * as measured, estimated or missing. Days with nothing logged say so explicitly.
 */
export function coachContext(h: UserHistory, days = 14): string {
  const lines: string[] = [];
  const p = h.profile;
  const t = h.targets;
  lines.push(`TODAY: ${h.today} (${p.timezone}).`);
  lines.push(`PROFILE: ${p.display_name}, ${p.sex}, ${p.age} years, ${Number(p.height_cm)} cm. Goal: ${p.goal}. Diet: ${p.diet}. Weak spots: ${p.weak_spots}. Activity: ${p.daily_activity}. Training: ${p.training}.`);
  lines.push(`TARGETS (fixed): ${t.kcal_target} kcal, protein ${t.protein_min_g} to ${t.protein_max_g} g (target ${t.protein_target_g}), fat ${t.fat_min_g} to ${t.fat_max_g} g, fibre ${t.fibre_min_g} to ${t.fibre_max_g} g, water ${t.water_ml / 1000} L, ${t.steps} steps, ${t.workouts_per_week} strength workouts a week, in bed by ${String(t.bedtime_target).slice(0, 5)}.`);
  lines.push(programmeLine(h, h.today));
  lines.push('');
  lines.push(`DAILY LOG, last ${days} days, newest first. Calories and macros are ESTIMATES from food logging; burn is an ESTIMATE from a formula; weight and waist are MEASURED; "not logged" means the user did not record it, so do not assume anything about it.`);
  for (let i = 0; i < days; i++) {
    const d = addDays(h.today, -i);
    const f = dayFacts(h, d);
    if (!f.logged) { lines.push(`${d}: nothing logged.`); continue; }
    const partial = d === h.today ? ' (today, still in progress)' : f.mainMeals < 3 ? ` (only ${f.mainMeals} of 3 main meals logged)` : '';
    lines.push(`${d}${partial}: eaten ~${f.kcal} kcal est., protein ${f.protein_g} g, carbs ${f.carbs_g} g, fat ${f.fat_g} g, fibre ${f.fibre_g} g; ${f.entries} entries, ${f.junk_entries} junk; water ${fmt(f.water_ml, ' ml')}; steps ${fmt(f.steps)}; badminton ${yes(f.badminton)}; strength workout ${yes(f.workout)}; in bed on time ${yes(f.in_bed_on_time)}; burn ~${fmt(f.burn_estimate, ' kcal')} est.; verdict ${f.verdict ?? 'none'}; weight ${fmt(f.weight_kg, ' kg')} measured${f.waist_cm !== null ? `; waist ${f.waist_cm} cm measured` : ''}.`);
  }
  lines.push('');
  const w7 = periodFacts(h, h.today, 7);
  lines.push(`LAST 7 DAYS: meals logged on ${w7.daysWithMeals} of 7 days; average over logged days ${fmt(w7.avg_kcal, ' kcal')} est., protein ${fmt(w7.avg_protein_g, ' g')}; average steps ${fmt(w7.avg_steps)} over ${w7.daysWithSteps} days with steps; strength workouts ${w7.workouts}; badminton days ${w7.badmintonDays}; deficit days ${w7.deficitDays}; junk-free days ${w7.junkFreeDays}.`);
  const avgNow = weightAverage(h, h.today);
  const avgPrev = weightAverage(h, addDays(h.today, -7));
  const avg30 = weightAverage(h, addDays(h.today, -30));
  const first = [...h.weights].sort((a, b) => a.date.localeCompare(b.date))[0];
  lines.push(`WEIGHT TREND (measured, 7-day averages): now ${avgNow ? `${avgNow.avg} kg from ${avgNow.count} weigh-ins` : 'no weigh-ins in the last 7 days'}; a week ago ${avgPrev ? `${avgPrev.avg} kg` : 'no data'}; 30 days ago ${avg30 ? `${avg30.avg} kg` : 'no data'}. First record: ${first ? `${Number(first.weight_kg)} kg on ${first.date} (${diffDays(first.date, h.today)} days ago)` : 'none'}.`);
  const counts = new Map<string, { n: number; junk: boolean; kcal: number }>();
  for (const m of h.meals.filter((x) => x.date >= addDays(h.today, -(days - 1)))) {
    const key = m.name.toLowerCase();
    const c = counts.get(key) ?? { n: 0, junk: m.junk, kcal: 0 };
    counts.set(key, { n: c.n + 1, junk: c.junk || m.junk, kcal: c.kcal + Number(m.kcal ?? 0) });
  }
  const top = [...counts.entries()].sort((a, b) => b[1].n - a[1].n || b[1].kcal - a[1].kcal).slice(0, 10);
  lines.push(`MOST LOGGED FOODS (last ${days} days): ${top.length ? top.map(([k, v]) => `${k} x${v.n}${v.junk ? ' [junk]' : ''}`).join('; ') : 'none'}.`);
  return lines.join('\n');
}
