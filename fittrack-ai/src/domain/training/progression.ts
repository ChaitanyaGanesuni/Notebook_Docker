/** Progression from logged performance, never from sex (brief section 8). */
import type { MoveChoice, RoutineMove } from './plan';
import type { SetResult, Who } from './player';

export interface Suggestion {
  position: number;
  slug: string;
  kind: 'level' | 'target';
  from: number;
  to: number;
  message: string;
}

export const PUSH_UP_ADVANCE = 15;
export const EASY = 2; // difficulty rating at or below this counts as "felt easy"

/**
 * - Max-rep moves with levels (push-ups): a best set of 15 or more moves to the next level.
 * - Rep moves at their target in every set, with the session rated easy: add 5 reps.
 * Timed holds follow the programme week (plank) or the user's own target.
 */
export function suggestProgressions(routine: RoutineMove[], results: SetResult[], who: Who, difficulty: number | null): Suggestion[] {
  const out: Suggestion[] = [];
  routine.forEach((m) => {
    const mine = results.filter((r) => r.who === who && r.move === m.position);
    if (mine.length === 0) return;
    const e = m.exercise;
    if (e.kind === 'max_reps' && e.levels.length > 1 && m.level < e.levels.length - 1) {
      const best = Math.max(...mine.map((r) => r.reps ?? 0));
      if (best >= PUSH_UP_ADVANCE) {
        out.push({ position: m.position, slug: e.slug, kind: 'level', from: m.level, to: m.level + 1,
          message: `${best} clean ${e.name.toLowerCase()}s. Next time: ${e.levels[m.level + 1]!.toLowerCase()}.` });
      }
    }
    // "Add 5 reps when 15 feels easy": moves prescribed at 15 or more (squats, bridges, calf raises).
    if ((e.kind === 'reps' || e.kind === 'reps_per_side') && (e.target ?? 0) >= 15 && m.target !== null && difficulty !== null && difficulty <= EASY) {
      const allSets = mine.length >= m.sets && mine.every((r) => (r.reps ?? 0) >= (m.target as number));
      if (allSets) {
        out.push({ position: m.position, slug: e.slug, kind: 'target', from: m.target, to: m.target + 5,
          message: `${e.name} at ${m.target} felt easy. Next time: ${m.target + 5}.` });
      }
    }
  });
  return out;
}

export function applySuggestions(choices: MoveChoice[], suggestions: Suggestion[]): MoveChoice[] {
  return choices.map((c, i) => {
    let next = { ...c };
    for (const s of suggestions.filter((x) => x.position === i && x.slug === c.slug)) {
      next = s.kind === 'level' ? { ...next, level: s.to } : { ...next, target: s.to };
    }
    return next;
  });
}
