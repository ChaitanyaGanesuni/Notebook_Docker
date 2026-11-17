/**
 * The guided workout as a pure state machine. Timers are stored as absolute
 * end times, so the countdown stays right if the phone sleeps or the app is
 * backgrounded; the screen only renders `remaining(state, now)`.
 */
import type { RoutineMove } from './plan';

export type Who = 'me' | 'partner';
export type Turn = Who | 'both';

export interface Step { move: number; set: number; turn: Turn }

export interface SetResult { who: Who; move: number; slug: string; set: number; level: number; reps: number | null; holdSeconds: number | null }

export interface PlayerState {
  phase: 'ready' | 'work' | 'hold' | 'rest' | 'done';
  steps: Step[];
  index: number;
  startedAt: number | null;
  finishedAt: number | null;
  /** End of the current rest or hold, as epoch ms. */
  endsAt: number | null;
  holdStartedAt: number | null;
  results: SetResult[];
}

export type Action =
  | { type: 'start'; now: number }
  | { type: 'setDone'; now: number; reps?: Partial<Record<Who, number>> }
  | { type: 'startHold'; now: number }
  | { type: 'holdDone'; now: number }
  | { type: 'restDone'; now: number }
  | { type: 'finishEarly'; now: number };

/**
 * Solo: every set is the user's. Couples: "together" moves are done at the same
 * time and rest between sets; "alternate" moves take turns, and each partner
 * rests while the other works, so there is no separate rest timer.
 */
export function buildSteps(routine: RoutineMove[], couples: boolean): Step[] {
  const steps: Step[] = [];
  routine.forEach((m, move) => {
    for (let set = 1; set <= m.sets; set++) {
      if (!couples) steps.push({ move, set, turn: 'me' });
      else if (m.exercise.pairMode === 'alternate') steps.push({ move, set, turn: 'me' }, { move, set, turn: 'partner' });
      else steps.push({ move, set, turn: 'both' });
    }
  });
  return steps;
}

export function initialState(routine: RoutineMove[], couples: boolean): PlayerState {
  return { phase: 'ready', steps: buildSteps(routine, couples), index: 0, startedAt: null, finishedAt: null, endsAt: null, holdStartedAt: null, results: [] };
}

const whoOf = (t: Turn): Who[] => (t === 'both' ? ['me', 'partner'] : [t]);

export function makeReducer(routine: RoutineMove[], couples: boolean) {
  const needsRestAfter = (s: PlayerState, i: number): boolean => {
    const step = s.steps[i]!;
    const next = s.steps[i + 1];
    if (!next) return false;
    const m = routine[step.move]!;
    // Taking turns: the partner's set is the rest. Rest only after the last person's turn of a set,
    // and only when the next step starts a new set of the same move or a new move... which the turn order covers.
    if (couples && m.exercise.pairMode === 'alternate') return false;
    return m.restSeconds > 0;
  };

  const advance = (s: PlayerState, now: number, recorded: SetResult[]): PlayerState => {
    const results = [...s.results, ...recorded];
    if (s.index >= s.steps.length - 1) return { ...s, results, phase: 'done', finishedAt: now, endsAt: null, holdStartedAt: null };
    if (needsRestAfter(s, s.index)) {
      const m = routine[s.steps[s.index]!.move]!;
      return { ...s, results, phase: 'rest', endsAt: now + m.restSeconds * 1000, holdStartedAt: null };
    }
    return { ...s, results, phase: 'work', index: s.index + 1, endsAt: null, holdStartedAt: null };
  };

  return function reducer(s: PlayerState, a: Action): PlayerState {
    const step = s.steps[s.index];
    switch (a.type) {
      case 'start':
        return s.phase === 'ready' ? { ...s, phase: 'work', startedAt: a.now } : s;
      case 'setDone': {
        if (s.phase !== 'work' || !step) return s;
        const m = routine[step.move]!;
        if (m.exercise.kind === 'timed') return s; // timed sets finish through the hold
        const recorded = whoOf(step.turn).map((who) => ({
          who, move: step.move, slug: m.exercise.slug, set: step.set, level: m.level, holdSeconds: null,
          reps: m.exercise.kind === 'max_reps' ? Math.max(0, Math.round(a.reps?.[who] ?? 0)) : m.target,
        }));
        return advance(s, a.now, recorded);
      }
      case 'startHold': {
        if (s.phase !== 'work' || !step) return s;
        const m = routine[step.move]!;
        if (m.exercise.kind !== 'timed') return s;
        return { ...s, phase: 'hold', holdStartedAt: a.now, endsAt: a.now + (m.target ?? 30) * 1000 };
      }
      case 'holdDone': {
        if (s.phase !== 'hold' || !step || s.holdStartedAt === null) return s;
        const m = routine[step.move]!;
        const held = Math.min(m.target ?? 30, Math.max(0, Math.round((a.now - s.holdStartedAt) / 1000)));
        const recorded = whoOf(step.turn).map((who) => ({ who, move: step.move, slug: m.exercise.slug, set: step.set, level: m.level, reps: null, holdSeconds: held }));
        return advance(s, a.now, recorded);
      }
      case 'restDone':
        return s.phase === 'rest' ? { ...s, phase: 'work', index: s.index + 1, endsAt: null } : s;
      case 'finishEarly':
        return s.phase === 'done' ? s : { ...s, phase: 'done', finishedAt: a.now, endsAt: null };
      default:
        return s;
    }
  };
}

export function remainingMs(s: PlayerState, now: number): number {
  return s.endsAt === null ? 0 : Math.max(0, s.endsAt - now);
}

/** Sets finished, for the progress bar (a set counts once everyone in it is done). */
export function setsDone(s: PlayerState): number {
  const done = new Set<string>();
  const finishedSteps = s.phase === 'done' ? s.steps.length : s.index + (s.phase === 'rest' ? 1 : 0);
  for (const step of s.steps.slice(0, finishedSteps)) done.add(`${step.move}:${step.set}`);
  // An alternate set is only complete when the second turn is done.
  for (const step of s.steps.slice(finishedSteps)) done.delete(`${step.move}:${step.set}`);
  return done.size;
}

export function totalSets(routine: RoutineMove[]): number {
  return routine.reduce((n, m) => n + m.sets, 0);
}

export function bestReps(results: SetResult[], who: Who, slugs: string[]): number | null {
  const xs = results.filter((r) => r.who === who && slugs.includes(r.slug) && r.reps !== null).map((r) => r.reps as number);
  return xs.length ? Math.max(...xs) : null;
}
