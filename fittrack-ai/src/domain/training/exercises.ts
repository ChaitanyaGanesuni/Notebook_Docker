/**
 * The exercise library and the three tracks (brief section 8). Bundled so the
 * Train tab works offline; the same rows are seeded into `exercises`,
 * `workout_tracks` and `track_exercises` with these fixed ids.
 */

export type ExerciseKind = 'reps' | 'reps_per_side' | 'max_reps' | 'timed' | 'rounds';
export type Presenter = 'female' | 'male' | 'pair';

/**
 * A licensed demo asset (image, looping video or Lottie) for one presenter.
 * None ship today: every move falls back to the illustrated figure. Drop files
 * into assets/demos and register them in src/assets/demos.ts.
 */
export interface DemoAsset { kind: 'image' | 'video' | 'lottie'; source: number }
export interface DemoVariants { female: DemoAsset | null; male: DemoAsset | null; pair: DemoAsset | null }

export interface Exercise {
  id: string;
  slug: string;
  name: string;
  kind: ExerciseKind;
  /** Base target: reps (per side for reps_per_side), seconds for timed, rounds for rounds, null for max. */
  target: number | null;
  /** What the number counts, for labels: "per leg", "per hand", "each". */
  per?: string;
  pair: boolean;
  /** Couples moves: done at the same time ("together") or taking turns ("alternate"). */
  pairMode?: 'together' | 'alternate';
  focus: string;
  cues: string[];
  progression: string;
  /** Difficulty ladder, easiest first. Users can pick any level. */
  levels: string[];
  /** The level a routine starts at (the brief's prescription); 0 when omitted. */
  defaultLevel?: number;
  /** Illustrated fallback animation key (see poses.ts), optionally per level. */
  demo: string;
  demoByLevel?: Record<number, string>;
  /** Exercises this one can be swapped for. */
  group: 'push' | 'legs' | 'hinge' | 'core' | 'pair';
  videoQuery: string;
}

const id = (n: number) => `e1000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

export const EXERCISES: readonly Exercise[] = [
  {
    id: id(1), slug: 'incline-push-up', name: 'Incline push-up', kind: 'max_reps', target: null, pair: false, group: 'push',
    focus: 'Chest, shoulders, triceps',
    cues: ['Hands on a table, wider than shoulders.', 'Head to heels in one line.', 'Lower for 2 seconds, press for 1.'],
    progression: 'At 15 clean reps, move your hands lower: chair seat, then floor on knees, then full push-ups.',
    levels: ['Hands on a table', 'Hands on a chair seat', 'Knees on the floor', 'Full push-up'],
    demo: 'incline-push-up', videoQuery: 'incline push up proper form',
  },
  {
    id: id(2), slug: 'squat', name: 'Squat', kind: 'reps', target: 15, pair: false, group: 'legs',
    focus: 'Thighs and glutes',
    cues: ['Feet shoulder-width, toes slightly out.', 'Sit back, chest up.', 'Push through the whole foot.'],
    progression: 'Add 5 reps when 15 feels easy. Then slow the lowering to 3 seconds, then pause at the bottom.',
    levels: ['Bodyweight squat', 'Slow 3-second lowering', 'Pause squat'],
    demo: 'squat', demoByLevel: { 1: 'slow-squat' }, videoQuery: 'bodyweight squat proper form',
  },
  {
    id: id(3), slug: 'reverse-lunge', name: 'Reverse lunge', kind: 'reps_per_side', target: 10, per: 'per leg', pair: false, group: 'legs',
    focus: 'Thighs, glutes, balance',
    cues: ['Long step back, lower straight down.', 'Front heel planted.', 'Hold a wall if needed.'],
    progression: 'Let go of the wall, then add a knee drive at the top.',
    levels: ['Holding a wall', 'Free-standing', 'With knee drive'],
    demo: 'reverse-lunge', videoQuery: 'reverse lunge proper form',
  },
  {
    id: id(4), slug: 'glute-bridge', name: 'Glute bridge', kind: 'reps', target: 15, pair: false, group: 'hinge',
    focus: 'Glutes and hamstrings',
    cues: ['Heels close to hips.', 'Squeeze and hold 2 seconds at the top.', 'Do not arch the back.'],
    progression: 'Add 5 reps when 15 feels easy, then single-leg bridges, 3 × 10 per leg.',
    levels: ['Both legs', 'Single leg'],
    demo: 'glute-bridge', videoQuery: 'glute bridge proper form',
  },
  {
    id: id(5), slug: 'plank', name: 'Plank', kind: 'timed', target: 20, pair: false, group: 'core',
    focus: 'Whole core',
    cues: ['Elbows under shoulders.', 'Squeeze glutes, ribs down.', 'Stop when hips sag.'],
    progression: '20 seconds in week 1, 5 seconds more each week, up to 40 seconds.',
    levels: ['Forearm plank'],
    demo: 'plank', videoQuery: 'forearm plank proper form',
  },
  {
    id: id(6), slug: 'dead-bug', name: 'Dead bug', kind: 'reps', target: 10, pair: false, group: 'core',
    focus: 'Deep core, lower-back control',
    cues: ['Lower back pressed down.', 'Opposite arm and leg extend slowly.', 'Breathe out as you extend.'],
    progression: 'Start with legs only if the back lifts; then opposite arm and leg.',
    levels: ['Legs only', 'Opposite arm and leg'], defaultLevel: 1,
    demo: 'dead-bug', videoQuery: 'dead bug exercise proper form',
  },
  {
    id: id(7), slug: 'bird-dog', name: 'Bird dog', kind: 'reps_per_side', target: 10, per: 'per side', pair: false, group: 'core',
    focus: 'Core, back, balance',
    cues: ['Hands under shoulders, knees under hips.', 'Reach opposite arm and leg long.', 'Keep hips level.'],
    progression: 'Add a 2-second hold at full extension.',
    levels: ['Reach and return', 'With 2-second hold'],
    demo: 'bird-dog', videoQuery: 'bird dog exercise proper form',
  },
  {
    id: id(8), slug: 'wall-sit', name: 'Wall sit', kind: 'timed', target: 30, pair: false, group: 'legs',
    focus: 'Thighs',
    cues: ['Back flat on the wall.', 'Knees over ankles, thighs level.', 'Breathe steadily.'],
    progression: 'Add 10 seconds when the full hold feels easy.',
    levels: ['Thighs level'],
    demo: 'wall-sit', videoQuery: 'wall sit proper form',
  },
  {
    id: id(9), slug: 'calf-raise', name: 'Calf raise', kind: 'reps', target: 15, pair: false, group: 'legs',
    focus: 'Calves, ankles',
    cues: ['Rise high onto the balls of the feet.', 'Pause at the top.', 'Lower slowly.'],
    progression: 'Add 5 reps, then single-leg raises holding a wall.',
    levels: ['Both feet', 'Single leg'],
    demo: 'calf-raise', videoQuery: 'calf raise proper form',
  },
  // ------------------------------------------------------------------ couples
  {
    id: id(21), slug: 'mirror-squats', name: 'Mirror squats', kind: 'reps', target: 15, pair: true, pairMode: 'together', group: 'pair',
    focus: 'Thighs and glutes',
    cues: ['Face each other.', 'Squat in time, same depth.', 'Chests up, push through the whole foot.'],
    progression: 'Add 5 reps when 15 feels easy, then slow the lowering together.',
    levels: ['Together'], demo: 'mirror-squats', videoQuery: 'partner squat workout',
  },
  {
    id: id(22), slug: 'hand-hold-lunges', name: 'Hand-hold reverse lunges', kind: 'reps_per_side', target: 10, per: 'per leg', pair: true, pairMode: 'together', group: 'pair',
    focus: 'Thighs, glutes, balance',
    cues: ['Hold hands for balance.', 'Step back together.', 'Front heels planted.'],
    progression: 'Let go of each other’s hands when balance is solid.',
    levels: ['Holding hands'], demo: 'hand-hold-lunges', videoQuery: 'partner lunges workout',
  },
  {
    id: id(23), slug: 'plank-high-fives', name: 'Plank high-fives', kind: 'reps_per_side', target: 10, per: 'per hand', pair: true, pairMode: 'together', group: 'pair',
    focus: 'Core and shoulders',
    cues: ['High planks facing each other.', 'Alternate high-fives.', 'Keep hips still as you lift a hand.'],
    progression: 'Move slightly further apart so you reach more.',
    levels: ['High plank'], demo: 'plank-high-fives', videoQuery: 'partner plank high five',
  },
  {
    id: id(24), slug: 'anchored-sit-ups', name: 'Anchored sit-ups', kind: 'reps', target: 12, per: 'each', pair: true, pairMode: 'alternate', group: 'pair',
    focus: 'Abs',
    cues: ['One holds the other’s feet.', 'Curl up slowly, lower with control.', 'Swap after each set.'],
    progression: 'Add 3 reps each when 12 feels easy.',
    levels: ['Feet held'], demo: 'anchored-sit-ups', videoQuery: 'partner sit ups feet held',
  },
  {
    id: id(25), slug: 'you-go-i-go-push-ups', name: 'You-go-I-go push-ups', kind: 'max_reps', target: null, per: 'each', pair: true, pairMode: 'alternate', group: 'pair',
    focus: 'Chest, shoulders, triceps',
    cues: ['Take turns to a clean max.', 'Each uses a suitable incline.', 'The resting partner counts.'],
    progression: 'Each moves to a lower surface at 15 clean reps.',
    levels: ['Own incline each'], demo: 'you-go-i-go-push-ups', videoQuery: 'partner push up workout',
  },
  {
    id: id(26), slug: 'back-to-back-sit', name: 'Back-to-back sit', kind: 'timed', target: 30, pair: true, pairMode: 'together', group: 'pair',
    focus: 'Thighs',
    cues: ['Backs together, arms linked if you like.', 'Lower to a seated position.', 'Hold, pushing evenly into each other.'],
    progression: 'Add 10 seconds when the hold feels easy.',
    levels: ['Seated hold'], demo: 'back-to-back-sit', videoQuery: 'partner back to back wall sit',
  },
];

export const EXERCISE_BY_SLUG: Record<string, Exercise> = Object.fromEntries(EXERCISES.map((e) => [e.slug, e]));

export type TrackSlug = 'men' | 'women' | 'couples';

export interface TrackDef {
  id: string;
  slug: TrackSlug;
  name: string;
  description: string;
  setsPerMove: number;
  restSeconds: number;
  couples: boolean;
  moves: string[];
}

export const TRACKS: Record<TrackSlug, TrackDef> = {
  men: {
    id: 'e2000000-0000-4000-8000-000000000001', slug: 'men', name: 'Men', couples: false, setsPerMove: 3, restSeconds: 60,
    description: 'Six moves, three sets, 60 seconds rest. About 25 to 30 minutes.',
    moves: ['incline-push-up', 'squat', 'reverse-lunge', 'glute-bridge', 'plank', 'dead-bug'],
  },
  women: {
    id: 'e2000000-0000-4000-8000-000000000002', slug: 'women', name: 'Women', couples: false, setsPerMove: 3, restSeconds: 60,
    description: 'More lower-body and glute work, an easier upper-body start. About 25 to 30 minutes.',
    moves: ['squat', 'glute-bridge', 'reverse-lunge', 'incline-push-up', 'bird-dog', 'plank'],
  },
  couples: {
    id: 'e2000000-0000-4000-8000-000000000003', slug: 'couples', name: 'Couples', couples: true, setsPerMove: 3, restSeconds: 60,
    description: 'Two people, one phone. You rest while your partner works, so it stays near 30 minutes.',
    moves: ['mirror-squats', 'hand-hold-lunges', 'plank-high-fives', 'anchored-sit-ups', 'you-go-i-go-push-ups', 'back-to-back-sit'],
  },
};

/** Fixed id of a shared track_exercises row. */
export const trackExerciseId = (track: TrackSlug, position: number) =>
  `e3000000-0000-4000-8000-${String((Object.keys(TRACKS).indexOf(track) + 1) * 100 + position).padStart(12, '0')}`;

export function swapOptions(slug: string): Exercise[] {
  const e = EXERCISE_BY_SLUG[slug];
  if (!e) return [];
  return EXERCISES.filter((x) => x.slug !== slug && x.pair === e.pair);
}

export function demoKey(e: Exercise, level: number): string {
  return e.demoByLevel?.[level] ?? e.demo;
}

export function formVideoUrl(e: Exercise): string {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(e.videoQuery)}`;
}
