/* Shared by the app (src/domain re-exports it) and the Edge Functions. Keep it free of
   platform APIs, and use explicit .ts extensions in imports so Deno can load it. */
/**
 * Local-date handling. A "local date" is a plain `YYYY-MM-DD` string in the
 * user's timezone (Asia/Kolkata by default). Instants are stored in UTC; every
 * day boundary in the app goes through this module.
 */

export type LocalDate = string; // YYYY-MM-DD

export const DEFAULT_TIMEZONE = 'Asia/Kolkata';

const DAY_MS = 86_400_000;
const LOCAL_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  let f = formatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    formatters.set(timeZone, f);
  }
  return f;
}

/** The local calendar date of an instant in the given timezone. */
export function localDateOf(instant: Date, timeZone: string = DEFAULT_TIMEZONE): LocalDate {
  const parts = formatterFor(timeZone).formatToParts(instant);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

export function isLocalDate(value: unknown): value is LocalDate {
  if (typeof value !== 'string') return false;
  const m = LOCAL_DATE_RE.exec(value);
  if (!m) return false;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return d.toISOString().slice(0, 10) === value;
}

/** Days since the Unix epoch for a local date (timezone-free arithmetic). */
function toDayNumber(date: LocalDate): number {
  const m = LOCAL_DATE_RE.exec(date);
  if (!m) throw new Error(`Invalid local date: ${date}`);
  return Math.round(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) / DAY_MS);
}

function fromDayNumber(n: number): LocalDate {
  return new Date(n * DAY_MS).toISOString().slice(0, 10);
}

export function addDays(date: LocalDate, days: number): LocalDate {
  return fromDayNumber(toDayNumber(date) + days);
}

/** Whole days from `from` to `to` (positive when `to` is later). */
export function diffDays(from: LocalDate, to: LocalDate): number {
  return toDayNumber(to) - toDayNumber(from);
}

/** 0 = Monday … 6 = Sunday. */
export function weekdayIndex(date: LocalDate): number {
  // 1970-01-01 was a Thursday (index 3).
  return (((toDayNumber(date) + 3) % 7) + 7) % 7;
}

/** Monday of the calendar week containing `date`. */
export function startOfWeek(date: LocalDate): LocalDate {
  return addDays(date, -weekdayIndex(date));
}

/** The seven dates, Monday to Sunday, of the calendar week containing `date`. */
export function weekDates(date: LocalDate): LocalDate[] {
  const monday = startOfWeek(date);
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** "Tue 17 Nov 2026" */
export function formatLocalDate(date: LocalDate): string {
  const m = LOCAL_DATE_RE.exec(date);
  if (!m) return date;
  return `${WEEKDAYS[weekdayIndex(date)]} ${Number(m[3])} ${MONTHS[Number(m[2]) - 1]} ${m[1]}`;
}
