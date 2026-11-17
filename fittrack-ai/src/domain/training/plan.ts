/** Today's routine: track, the user's swaps and levels, and targets from their own performance. */
import { EXERCISE_BY_SLUG, TRACKS, type Exercise, type TrackSlug } from './exercises';

export interface MoveChoice { slug: string; level: number; target: number | null }

export interface RoutineMove {
  position: number;
  exercise: Exercise;
  level: number;
  sets: number;
  /** Reps, seconds or rounds; null means "max". */
  target: number | null;
  restSeconds: number;
  prescription: string;
}

/** Plank: 20 seconds in week 1, plus 5 each week, capped at 40. Before the programme starts, 20. */
export function plankSeconds(programmeWeek: number | null): number {
  if (programmeWeek === null || programmeWeek < 1) return 20;
  return Math.min(40, 20 + 5 * (programmeWeek - 1));
}

export function prescription(e: Exercise, sets: number, target: number | null): string {
  switch (e.kind) {
    case 'max_reps': return `${sets} × max${e.per ? ` ${e.per}` : ''}`;
    case 'timed': return `${sets} × ${target ?? e.target} s hold`;
    case 'rounds': return `${sets} rounds`;
    case 'reps_per_side': return `${sets} × ${target} ${e.per ?? 'per side'}`;
    default: return `${sets} × ${target}${e.per ? ` ${e.per}` : ''}`;
  }
}

/** The default choices for a track, before any personal swaps or progression. */
export function defaultChoices(track: TrackSlug): MoveChoice[] {
  return TRACKS[track].moves.map((slug) => ({ slug, level: EXERCISE_BY_SLUG[slug]!.defaultLevel ?? 0, target: EXERCISE_BY_SLUG[slug]!.target }));
}

export function resolveRoutine(track: TrackSlug, choices: MoveChoice[] | null, programmeWeek: number | null): RoutineMove[] {
  const def = TRACKS[track];
  const list = choices && choices.length === def.moves.length ? choices : defaultChoices(track);
  return list.map((c, position) => {
    const exercise = EXERCISE_BY_SLUG[c.slug] ?? EXERCISE_BY_SLUG[def.moves[position]!]!;
    const level = Math.max(0, Math.min(exercise.levels.length - 1, c.level));
    // Plank time follows the programme week; other timed holds keep the user's own target.
    const target = exercise.slug === 'plank' ? plankSeconds(programmeWeek)
      : exercise.kind === 'max_reps' ? null
      : c.target ?? exercise.target;
    return { position, exercise, level, sets: def.setsPerMove, target, restSeconds: def.restSeconds, prescription: prescription(exercise, def.setsPerMove, target) };
  });
}

/** Rough session length, for the Start card. */
export function estimatedMinutes(routine: RoutineMove[], couples: boolean): number {
  let s = 0;
  for (const m of routine) {
    const work = m.exercise.kind === 'timed' ? (m.target ?? 30) : m.exercise.kind === 'reps_per_side' ? 70 : 45;
    const turns = couples && m.exercise.pairMode === 'alternate' ? 2 : 1;
    const rest = couples && m.exercise.pairMode === 'alternate' ? 0 : m.restSeconds;
    s += m.sets * (work * turns + rest) + 30;
  }
  return Math.round(s / 60);
}
