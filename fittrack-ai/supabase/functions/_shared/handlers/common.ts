import { AiRequestError, AiUnavailableError, type AiProvider } from '../ai/provider.ts';
import { addDays, localDateOf } from '../domain/dates.ts';
import type { UserDb } from '../db.ts';
import type { UserHistory } from '../types.ts';

export interface Deps {
  db: UserDb;
  ai: AiProvider;
  now: Date;
}

export interface HandlerResult {
  status: number;
  body: Record<string, unknown>;
}

export type Handler = (body: unknown, deps: Deps) => Promise<HandlerResult>;

export const fail = (status: number, error: string, message: string, extra: Record<string, unknown> = {}): HandlerResult =>
  ({ status, body: { error, message, ...extra } });

/** Maps provider failures to responses the app can act on: retry later, or give up. */
export function aiFailure(e: unknown): HandlerResult {
  if (e instanceof AiUnavailableError) return fail(503, 'ai_unavailable', 'The AI service is busy or unreachable. Try again shortly.', { retryable: true });
  if (e instanceof AiRequestError) return fail(502, 'ai_error', e.message, { retryable: false });
  throw e;
}

/** Loads the user's own history, as the user (row-level security applies to every query). */
export async function loadHistory(
  db: UserDb, now: Date, days: number, earliest?: (today: string) => string | null,
): Promise<UserHistory | HandlerResult> {
  const [profile, targets] = await Promise.all([db.getProfile(), db.getTargets()]);
  if (!profile || !targets) return fail(409, 'not_onboarded', 'Finish setting up your profile and targets first.');
  const today = localDateOf(now, profile.timezone);
  const defaultFrom = addDays(today, -(days - 1));
  const requested = earliest?.(today) ?? null;
  const from = requested !== null && requested < defaultFrom ? requested : defaultFrom;
  const [programme, meals, rawLogs, weights, measurements, workoutDates] = await Promise.all([
    db.getActiveProgramme(), db.listMeals(from, today), db.listDayLogs(from, today), db.listWeights(today), db.listMeasurements(from, today),
    db.listWorkoutDates(from, today),
  ]);
  return { today, profile, targets, programme, meals, logs: mergeWorkouts(rawLogs, workoutDates), weights, measurements };
}

export const isResult = (x: unknown): x is HandlerResult =>
  typeof x === 'object' && x !== null && 'status' in x && 'body' in x;

/**
 * A finished workout session counts as the day's strength workout, even if the
 * day's toggle was not set (for example a couples session recorded on the
 * partner's phone).
 */
export function mergeWorkouts(logs: UserHistory['logs'], workoutDates: string[]): UserHistory['logs'] {
  const dates = new Set(workoutDates);
  const out = logs.map((l) => (dates.has(l.date) ? { ...l, workout_done: true } : l));
  for (const d of dates) {
    if (!out.some((l) => l.date === d)) out.push({ date: d, water_ml: 0, steps: null, badminton: false, workout_done: true, in_bed_on_time: false, chai_sugar: null });
  }
  return out;
}
