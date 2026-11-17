import { describeLinks, type PartnerLink } from '../../data/partnerHooks';
import { EXERCISES, EXERCISE_BY_SLUG, formVideoUrl, swapOptions, TRACKS, trackExerciseId } from './exercises';
import { defaultChoices, estimatedMinutes, plankSeconds, resolveRoutine } from './plan';
import { buildSteps, initialState, makeReducer, remainingMs, setsDone, totalSets, type PlayerState } from './player';
import { DEMOS, JOINTS, LEN, solve, solveLimb } from './poses';
import { applySuggestions, suggestProgressions } from './progression';
import { buildSessionRows } from './sessionRows';

describe('library and tracks', () => {
  it('has the brief\'s three routines', () => {
    expect(TRACKS.men.moves).toEqual(['incline-push-up', 'squat', 'reverse-lunge', 'glute-bridge', 'plank', 'dead-bug']);
    expect(TRACKS.women.moves).toEqual(['squat', 'glute-bridge', 'reverse-lunge', 'incline-push-up', 'bird-dog', 'plank']);
    expect(TRACKS.couples.moves).toEqual(['mirror-squats', 'hand-hold-lunges', 'plank-high-fives', 'anchored-sit-ups', 'you-go-i-go-push-ups', 'back-to-back-sit']);
    for (const t of Object.values(TRACKS)) expect(t).toMatchObject({ setsPerMove: 3, restSeconds: 60 });
  });
  it('every move has a demo, cues, a form-video link and unique fixed ids', () => {
    for (const e of EXERCISES) {
      expect(DEMOS[e.demo]).toBeDefined();
      for (const k of Object.values(e.demoByLevel ?? {})) expect(DEMOS[k]).toBeDefined();
      expect(e.cues.length).toBeGreaterThan(0);
      expect(formVideoUrl(e)).toMatch(/^https:\/\/www\.youtube\.com\/results\?search_query=/);
    }
    expect(new Set(EXERCISES.map((e) => e.id)).size).toBe(EXERCISES.length);
    expect(trackExerciseId('women', 3)).toBe('e3000000-0000-4000-8000-000000000203');
  });
  it('swaps stay within solo or pair moves, never locked by gender', () => {
    expect(swapOptions('squat').every((e) => !e.pair)).toBe(true);
    expect(swapOptions('squat').map((e) => e.slug)).toContain('bird-dog');
    expect(swapOptions('mirror-squats').every((e) => e.pair)).toBe(true);
  });
});

describe('routine', () => {
  it('prescribes the brief\'s sets and reps', () => {
    const r = resolveRoutine('men', null, 1);
    expect(r.map((m) => m.prescription)).toEqual(['3 × max', '3 × 15', '3 × 10 per leg', '3 × 15', '3 × 20 s hold', '3 × 10']);
    expect(resolveRoutine('couples', null, 1).map((m) => m.prescription)).toEqual(['3 × 15', '3 × 10 per leg', '3 × 10 per hand', '3 × 12 each', '3 × max each', '3 × 30 s hold']);
  });
  it('starts dead bugs at opposite arm and leg, as prescribed', () => {
    expect(resolveRoutine('men', null, 1)[5]).toMatchObject({ level: 1 });
  });
  it('plank: 20 s in week 1, +5 a week, capped at 40', () => {
    expect([null, 0, 1, 2, 3, 4, 5, 6, 12].map(plankSeconds)).toEqual([20, 20, 20, 25, 30, 35, 40, 40, 40]);
    expect(resolveRoutine('women', null, 3)[5]!.target).toBe(30);
  });
  it('applies the user\'s swaps, levels and targets', () => {
    const choices = defaultChoices('men');
    choices[1] = { slug: 'wall-sit', level: 0, target: 45 };
    choices[3] = { slug: 'glute-bridge', level: 1, target: 20 };
    const r = resolveRoutine('men', choices, 1);
    expect(r[1]).toMatchObject({ exercise: { slug: 'wall-sit' }, target: 45, prescription: '3 × 45 s hold' });
    expect(r[3]).toMatchObject({ level: 1, target: 20 });
    expect(resolveRoutine('men', [{ slug: 'squat', level: 0, target: 15 }], 1)).toHaveLength(6); // malformed: defaults
    expect(estimatedMinutes(resolveRoutine('men', null, 1), false)).toBeGreaterThanOrEqual(20);
    expect(estimatedMinutes(resolveRoutine('men', null, 1), false)).toBeLessThanOrEqual(35);
  });
});

describe('player', () => {
  const routine = resolveRoutine('men', null, 1);
  const reduce = makeReducer(routine, false);
  const run = (s: PlayerState, ...actions: Parameters<typeof reduce>[1][]) => actions.reduce(reduce, s);

  it('walks 18 sets: move, set done, 60 s rest, next set', () => {
    expect(totalSets(routine)).toBe(18);
    let s = run(initialState(routine, false), { type: 'start', now: 0 });
    expect(s).toMatchObject({ phase: 'work', index: 0 });
    s = run(s, { type: 'setDone', now: 30_000, reps: { me: 8 } });
    expect(s.phase).toBe('rest');
    expect(remainingMs(s, 30_000)).toBe(60_000);
    expect(remainingMs(s, 100_000)).toBe(0);
    expect(setsDone(s)).toBe(1);
    s = run(s, { type: 'restDone', now: 50_000 }); // skip rest
    expect(s).toMatchObject({ phase: 'work', index: 1 });
    expect(s.results[0]).toMatchObject({ slug: 'incline-push-up', set: 1, reps: 8 });
  });
  it('records target reps for rep moves and the time held for planks', () => {
    let s = initialState(routine, false);
    s = run(s, { type: 'start', now: 0 });
    for (let i = 0; i < 12; i++) s = run(s, { type: 'setDone', now: i * 1000, reps: { me: 9 } }, { type: 'restDone', now: i * 1000 + 1 });
    expect(s.results[3]).toMatchObject({ slug: 'squat', reps: 15 });
    expect(s.results[6]).toMatchObject({ slug: 'reverse-lunge', reps: 10 });
    // plank: Set done is ignored, the hold counts down from the week's target
    expect(routine[4]!.exercise.slug).toBe('plank');
    expect(run(s, { type: 'setDone', now: 0 })).toBe(s);
    s = run(s, { type: 'startHold', now: 100_000 });
    expect(s.phase).toBe('hold');
    expect(remainingMs(s, 105_000)).toBe(15_000);
    s = run(s, { type: 'holdDone', now: 112_000 }); // stopped early: hips sagged
    expect(s.results.at(-1)).toMatchObject({ slug: 'plank', holdSeconds: 12 });
    s = run(s, { type: 'restDone', now: 0 }, { type: 'startHold', now: 0 }, { type: 'holdDone', now: 999_000 });
    expect(s.results.at(-1)!.holdSeconds).toBe(20); // never more than the target
  });
  it('finishes after the last set and records nothing extra', () => {
    let s = run(initialState(routine, false), { type: 'start', now: 0 });
    for (let i = 0; i < 18; i++) {
      s = s.steps[s.index]!.move === 4 ? run(s, { type: 'startHold', now: 0 }, { type: 'holdDone', now: 20_000 }) : run(s, { type: 'setDone', now: 0, reps: { me: 5 } });
      if (s.phase === 'rest') s = run(s, { type: 'restDone', now: 0 });
    }
    expect(s.phase).toBe('done');
    expect(s.results).toHaveLength(18);
    expect(setsDone(s)).toBe(18);
  });
  it('couples: together moves rest between sets; turn-taking moves alternate with no rest timer', () => {
    const c = resolveRoutine('couples', null, 1);
    const steps = buildSteps(c, true);
    expect(steps.filter((x) => x.move === 0).map((x) => x.turn)).toEqual(['both', 'both', 'both']);
    expect(steps.filter((x) => x.move === 3).map((x) => x.turn)).toEqual(['me', 'partner', 'me', 'partner', 'me', 'partner']);
    const r = makeReducer(c, true);
    let s = initialState(c, true);
    s.index = steps.findIndex((x) => x.move === 3);
    s = { ...s, phase: 'work' };
    const before = setsDone(s);
    s = r(s, { type: 'setDone', now: 0 });
    expect(s.phase).toBe('work'); // partner's turn straight away
    expect(setsDone(s)).toBe(before); // the set is not complete until both have done it
    s = r(s, { type: 'setDone', now: 0 });
    expect(setsDone(s)).toBe(before + 1);
    expect(s.results.map((x) => [x.who, x.reps])).toEqual([['me', 12], ['partner', 12]]);
    // you-go-I-go push-ups record each person's own max
    s.index = steps.findIndex((x) => x.move === 4);
    s = r(s, { type: 'setDone', now: 0, reps: { me: 9 } });
    s = r(s, { type: 'setDone', now: 0, reps: { partner: 6 } });
    expect(s.results.slice(-2).map((x) => [x.who, x.reps])).toEqual([['me', 9], ['partner', 6]]);
    // together move records both
    s = r({ ...initialState(c, true), phase: 'work' }, { type: 'setDone', now: 0 });
    expect(s.results.map((x) => x.who)).toEqual(['me', 'partner']);
    expect(s.phase).toBe('rest');
  });
});

describe('progression', () => {
  const routine = resolveRoutine('men', null, 1);
  const set = (move: number, slug: string, reps: number) => [1, 2, 3].map((n) => ({ who: 'me' as const, move, slug, set: n, level: 0, reps, holdSeconds: null }));
  it('moves push-ups to a lower surface at 15 clean reps', () => {
    const s = suggestProgressions(routine, [...set(0, 'incline-push-up', 15)], 'me', 4);
    expect(s).toEqual([expect.objectContaining({ kind: 'level', from: 0, to: 1, message: expect.stringContaining('hands on a chair seat') })]);
    expect(suggestProgressions(routine, set(0, 'incline-push-up', 14), 'me', 1)).toEqual([]);
  });
  it('adds 5 reps when 15 felt easy, never when it was hard or a set was missed', () => {
    const results = [...set(1, 'squat', 15), ...set(3, 'glute-bridge', 15)];
    expect(suggestProgressions(routine, results, 'me', 2).map((x) => [x.slug, x.to])).toEqual([['squat', 20], ['glute-bridge', 20]]);
    expect(suggestProgressions(routine, results, 'me', 4)).toEqual([]);
    expect(suggestProgressions(routine, results.slice(1), 'me', 1).map((x) => x.slug)).toEqual(['glute-bridge']);
    expect(suggestProgressions(routine, set(2, 'reverse-lunge', 10), 'me', 1)).toEqual([]); // only moves done at 15
  });
  it('applies to the stored choices', () => {
    const next = applySuggestions(defaultChoices('men'), suggestProgressions(routine, [...set(0, 'incline-push-up', 16), ...set(1, 'squat', 15)], 'me', 1));
    expect(next[0]).toMatchObject({ level: 1 });
    expect(next[1]).toMatchObject({ target: 20 });
  });
});

describe('session rows', () => {
  let n = 0;
  const newId = () => `id-${++n}`;
  const base = { date: '2026-11-19', programmeWeek: 1, startedAt: Date.parse('2026-11-19T13:00:00Z'), finishedAt: Date.parse('2026-11-19T13:27:30Z'), newId };
  const results = [
    { who: 'me' as const, move: 4, slug: 'you-go-i-go-push-ups', set: 1, level: 0, reps: 9, holdSeconds: null },
    { who: 'partner' as const, move: 4, slug: 'you-go-i-go-push-ups', set: 1, level: 0, reps: 6, holdSeconds: null },
  ];
  it('solo: one session, one participant, the sets, best push-up set and duration', () => {
    const rows = buildSessionRows({ ...base, track: 'men', results: [{ who: 'me', move: 0, slug: 'incline-push-up', set: 1, level: 0, reps: 7, holdSeconds: null }, { who: 'me', move: 0, slug: 'incline-push-up', set: 2, level: 0, reps: 9, holdSeconds: null }], me: { userId: 'me', difficulty: 3 }, partner: null });
    expect(rows.map((r) => r.table)).toEqual(['workout_sessions', 'session_participants', 'exercise_sets', 'exercise_sets']);
    expect(rows[0]!.data).toMatchObject({ user_id: 'me', track_slug: 'men', is_couples: false, couple_group_id: null, duration_s: 1650, track_id: TRACKS.men.id });
    expect(rows[1]!.data).toMatchObject({ difficulty: 3, best_pushup_set: 9 });
    expect(rows[2]!.data).toMatchObject({ exercise_id: EXERCISE_BY_SLUG['incline-push-up']!.id, reps: 7, level: 0 });
  });
  it('guest: everything stays in the owner\'s account', () => {
    const rows = buildSessionRows({ ...base, track: 'couples', results, me: { userId: 'me', difficulty: 3 }, partner: { kind: 'guest', name: 'Asha', difficulty: 4 } });
    expect(rows.every((r) => r.data.user_id === 'me')).toBe(true);
    expect(rows.filter((r) => r.table === 'session_participants').map((r) => [r.data.is_guest, r.data.guest_name, r.data.difficulty, r.data.best_pushup_set])).toEqual([[false, null, 3, 9], [true, 'Asha', 4, 6]]);
  });
  it('linked partner: written to both accounts with their own reps and rating', () => {
    const rows = buildSessionRows({ ...base, track: 'couples', results, me: { userId: 'me', difficulty: 3 }, partner: { kind: 'linked', userId: 'them', name: 'Asha', difficulty: 5 } });
    const sessions = rows.filter((r) => r.table === 'workout_sessions');
    expect(sessions.map((r) => r.data.user_id)).toEqual(['me', 'them']);
    expect(sessions[0]!.data.couple_group_id).toBe(sessions[1]!.data.couple_group_id);
    expect(sessions[0]!.data.couple_group_id).not.toBeNull();
    const theirSets = rows.filter((r) => r.table === 'exercise_sets' && r.data.user_id === 'them');
    expect(theirSets.map((r) => [r.data.reps, r.data.session_id])).toEqual([[6, sessions[1]!.data.id]]);
    expect(rows.find((r) => r.table === 'session_participants' && r.data.user_id === 'them')!.data).toMatchObject({ difficulty: 5, best_pushup_set: 6 });
    // the partner's session is written before its participant and sets (the server checks in that order)
    const order = rows.map((r) => `${r.table}:${r.data.user_id}`);
    expect(order.indexOf('workout_sessions:them')).toBeLessThan(order.indexOf('session_participants:them'));
  });
});

describe('poses', () => {
  const dist = (f: number[], a: string, b: string) => {
    const i = JOINTS.indexOf(a as never) * 2; const j = JOINTS.indexOf(b as never) * 2;
    return Math.hypot(f[i]! - f[j]!, f[i + 1]! - f[j + 1]!);
  };
  it('IK keeps limb lengths for every keyframe of every demo', () => {
    for (const d of Object.values(DEMOS)) {
      for (const fig of d.figures) {
        expect(fig.length).toBe(d.segments.length);
        for (const f of fig) {
          expect(f).toHaveLength(JOINTS.length * 2);
          expect(dist(f, 'hip', 'kneeN')).toBeCloseTo(LEN.thigh, 1);
          expect(dist(f, 'kneeF', 'footF')).toBeCloseTo(LEN.shin, 1);
          expect(dist(f, 'shoulder', 'elbowN')).toBeCloseTo(LEN.upper, 1);
          expect(dist(f, 'elbowF', 'handF')).toBeCloseTo(LEN.fore, 1);
          expect(f.every(Number.isFinite)).toBe(true);
        }
      }
    }
  });
  it('reaches a target in range and goes straight toward one out of range', () => {
    const [, end] = solveLimb([0, 0], { to: [0, 40], bend: 1 }, 30, 30);
    expect(end).toEqual([0, 40]);
    const [mid, far] = solveLimb([0, 0], { to: [0, 200], bend: 1 }, 30, 30);
    expect(far[1]).toBeCloseTo(60, 1);
    expect(Math.abs(mid[0])).toBeLessThan(1);
    expect(solve({ hip: [100, 80], torso: 180, handN: { to: [103, 83], bend: 1 }, handF: { to: [98, 83], bend: 1 }, footN: { to: [101, 140], bend: -1 }, footF: { to: [97, 140], bend: -1 } })).toHaveLength(26);
  });
});

describe('partner state', () => {
  const link = (over: Partial<PartnerLink>): PartnerLink => ({ id: 'l1', requester_id: 'me', addressee_id: 'them', invite_code: 'ABC', invite_expires_at: '', status: 'accepted', requester_shares: ['weight'], addressee_shares: [], requester_name: 'Chaitanya', addressee_name: 'Asha', ...over });
  it('describes the link from either side', () => {
    expect(describeLinks([link({})], 'me').linked).toEqual({ linkId: 'l1', partnerId: 'them', partnerName: 'Asha', myShares: ['weight'], theirShares: [] });
    expect(describeLinks([link({})], 'them').linked).toMatchObject({ partnerId: 'me', partnerName: 'Chaitanya', myShares: [], theirShares: ['weight'] });
  });
  it('shows my own open invite only', () => {
    expect(describeLinks([link({ status: 'pending', addressee_id: null })], 'me')).toEqual({ linked: null, invite: { linkId: 'l1', code: 'ABC', expiresAt: '' } });
    expect(describeLinks([link({ status: 'pending', requester_id: 'other', addressee_id: null })], 'me')).toEqual({ linked: null, invite: null });
  });
});
