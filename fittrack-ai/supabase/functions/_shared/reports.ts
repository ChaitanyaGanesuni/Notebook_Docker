/** Daily and weekly reports: numbers from code, words from the model. */
import { addDays } from './domain/dates.ts';
import { programmeProgress } from './domain/programme.ts';
import { dayFacts, periodFacts, programmeLine, weightAverage, type DayFacts, type PeriodFacts } from './summaries.ts';
import type { UserHistory } from './types.ts';

export type ReportKind = 'daily' | 'weekly';

export interface DailyReportData {
  kind: 'daily';
  date: string;
  day: DayFacts;
  targets: { kcal: number; protein_g: number; water_ml: number; steps: number; fibre_min_g: number };
  weight_avg_7d: number | null;
  weight_avg_prev_7d: number | null;
  programme: string;
}

export interface WeeklyReportData {
  kind: 'weekly';
  start: string;
  end: string;
  week: PeriodFacts;
  targets: { kcal: number; protein_g: number; water_ml: number; steps: number; workouts_per_week: number };
  programme: string;
  programme_week: number | null;
}

export type ReportData = DailyReportData | WeeklyReportData;

export function reportPeriod(kind: ReportKind, date: string): { start: string; end: string } {
  return kind === 'daily' ? { start: date, end: date } : { start: addDays(date, -6), end: date };
}

export function buildReportData(h: UserHistory, kind: ReportKind, date: string): ReportData {
  const t = h.targets;
  if (kind === 'daily') {
    const { summary: _s, ...day } = dayFacts(h, date);
    return {
      kind, date, day,
      targets: { kcal: t.kcal_target, protein_g: t.protein_target_g, water_ml: t.water_ml, steps: t.steps, fibre_min_g: t.fibre_min_g },
      weight_avg_7d: weightAverage(h, date)?.avg ?? null,
      weight_avg_prev_7d: weightAverage(h, addDays(date, -7))?.avg ?? null,
      programme: programmeLine(h, date),
    };
  }
  const { start, end } = reportPeriod(kind, date);
  const p = h.programme ? programmeProgress({ startDate: h.programme.start_date, weeks: h.programme.weeks }, end) : null;
  return {
    kind, start, end,
    week: periodFacts(h, end, 7),
    targets: { kcal: t.kcal_target, protein_g: t.protein_target_g, water_ml: t.water_ml, steps: t.steps, workouts_per_week: t.workouts_per_week },
    programme: programmeLine(h, end),
    programme_week: p?.status === 'active' ? p.week : null,
  };
}

const v = (n: number | null, unit = '') => (n === null ? 'not logged' : `${n}${unit}`);

/** The facts block given to the model. */
export function reportFacts(d: ReportData): string {
  if (d.kind === 'daily') {
    const f = d.day;
    return [
      `Date: ${d.date}. ${d.programme}`,
      `Meals: ${f.entries} entries, ${f.mainMeals} of 3 main meals logged, ${f.junk_entries} junk.`,
      `Eaten (estimate): ${f.kcal} kcal (target ${d.targets.kcal}), protein ${f.protein_g} g (target ${d.targets.protein_g}), carbs ${f.carbs_g} g, fat ${f.fat_g} g, fibre ${f.fibre_g} g (target at least ${d.targets.fibre_min_g}).`,
      `Water: ${v(f.water_ml, ' ml')} (target ${d.targets.water_ml}). Steps: ${v(f.steps)} (target ${d.targets.steps}). Badminton: ${f.badminton ? 'yes' : 'no'}. Strength workout: ${f.workout ? 'yes' : 'no'}. In bed on time: ${f.in_bed_on_time ? 'yes' : 'no'}.`,
      `Burn (estimate): ${v(f.burn_estimate, ' kcal')}. Verdict: ${f.verdict ?? 'none'}${f.verdict_note ? ` (${f.verdict_note})` : ''}. Day score ${f.score} of 6.`,
      `Weight (measured): today ${v(f.weight_kg, ' kg')}; 7-day average ${v(d.weight_avg_7d, ' kg')}; previous 7-day average ${v(d.weight_avg_prev_7d, ' kg')}.`,
    ].join('\n');
  }
  const w = d.week;
  return [
    `Period: ${d.start} to ${d.end}. ${d.programme}`,
    `Meals logged on ${w.daysWithMeals} of 7 days. Averages over logged days (estimates): ${v(w.avg_kcal, ' kcal')} (target ${d.targets.kcal}), protein ${v(w.avg_protein_g, ' g')} (target ${d.targets.protein_g}), fibre ${v(w.avg_fibre_g, ' g')}.`,
    `Average water ${v(w.avg_water_ml, ' ml')} (target ${d.targets.water_ml}). Average steps ${v(w.avg_steps)} over ${w.daysWithSteps} days with steps (target ${d.targets.steps}).`,
    `Strength workouts ${w.workouts} (target ${d.targets.workouts_per_week}). Badminton days ${w.badmintonDays}.`,
    `Days meeting each target: deficit ${w.deficitDays}, protein ${w.proteinDays}, water ${w.waterDays}, steps ${w.stepDays}, junk-free ${w.junkFreeDays}, in bed on time ${w.bedDays}.`,
    `Weight (measured): 7-day average ${v(w.weight_avg, ' kg')} from ${w.weighIns} weigh-ins; previous 7-day average ${v(w.weight_avg_previous, ' kg')}; change ${w.weight_change === null ? 'unknown' : `${w.weight_change > 0 ? '+' : ''}${w.weight_change} kg`}. Latest waist ${v(w.waist_latest, ' cm')}.`,
  ].join('\n');
}

export interface ReportNarrative {
  headline: string;
  went_well: string[];
  improve: string[];
  suggestions: string[];
  weight_comment: string;
}

const str = (x: unknown, max: number) => (typeof x === 'string' ? x.replace(/\s+/g, ' ').trim().slice(0, max) : '');
const list = (x: unknown, maxItems: number) => (Array.isArray(x) ? x.map((i) => str(i, 240)).filter(Boolean).slice(0, maxItems) : []);

export function validateNarrative(raw: unknown): ReportNarrative | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const n: ReportNarrative = {
    headline: str(r.headline, 200),
    went_well: list(r.went_well, 4),
    improve: list(r.improve, 4),
    suggestions: list(r.suggestions, 4),
    weight_comment: str(r.weight_comment, 300),
  };
  return n.headline && n.suggestions.length > 0 ? n : null;
}

export function narrativeText(n: ReportNarrative): string {
  const section = (title: string, xs: string[]) => (xs.length ? `${title}\n${xs.map((x) => `- ${x}`).join('\n')}` : '');
  return [n.headline, section('What went well', n.went_well), section('What to improve', n.improve), section('Next', n.suggestions), n.weight_comment]
    .filter(Boolean).join('\n\n');
}
