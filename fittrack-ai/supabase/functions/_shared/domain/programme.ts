/* Shared by the app (src/domain re-exports it) and the Edge Functions. Keep it free of
   platform APIs, and use explicit .ts extensions in imports so Deno can load it. */
import { addDays, diffDays, type LocalDate } from './dates.ts';

export interface ProgrammeSpan {
  startDate: LocalDate;
  weeks: number;
}

export type ProgrammeProgress =
  | { status: 'upcoming'; daysToStart: number; totalWeeks: number; totalDays: number }
  | { status: 'active'; week: number; day: number; totalWeeks: number; totalDays: number }
  | { status: 'finished'; daysSinceEnd: number; totalWeeks: number; totalDays: number };

export function programmeEndDate(p: ProgrammeSpan): LocalDate {
  return addDays(p.startDate, p.weeks * 7 - 1);
}

/**
 * Where `today` falls in the programme. Day 1 is the start date; programme
 * weeks are 7-day blocks counted from the start date, whatever weekday it is.
 */
export function programmeProgress(p: ProgrammeSpan, today: LocalDate): ProgrammeProgress {
  const totalWeeks = p.weeks;
  const totalDays = p.weeks * 7;
  const offset = diffDays(p.startDate, today);
  if (offset < 0) return { status: 'upcoming', daysToStart: -offset, totalWeeks, totalDays };
  if (offset >= totalDays) {
    return { status: 'finished', daysSinceEnd: offset - totalDays + 1, totalWeeks, totalDays };
  }
  return {
    status: 'active',
    week: Math.floor(offset / 7) + 1,
    day: offset + 1,
    totalWeeks,
    totalDays,
  };
}

/** Days until a date; 0 on the day itself, negative once it has passed. */
export function daysUntil(target: LocalDate, today: LocalDate): number {
  return diffDays(today, target);
}
