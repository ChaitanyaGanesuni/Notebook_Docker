/**
 * Poses for the illustrated exercise demos. A pose is authored as a hip
 * position, a torso direction and targets for hands and feet; elbows and
 * knees are solved with two-bone IK so limb lengths never change. Each
 * exercise is a loop of keyframes with a tempo label per segment.
 *
 * Coordinates: viewBox 240 x 150, y down, ground at y = 140, figure faces right.
 * Directions are degrees with 0 = straight down, 90 = forward (right),
 * 180 = straight up, -90 = back (left).
 */

export type Pt = [number, number];

export const GROUND = 140;
export const LEN = { torso: 38, neck: 15, thigh: 30, shin: 30, upper: 22, fore: 20, foot: 9 } as const;

/** A limb goal: a target point plus which side the middle joint bends to (+1 or -1). */
export interface LimbGoal { to: Pt; bend: 1 | -1 }

export interface PoseSpec {
  hip: Pt;
  /** Direction from hip to shoulders (180 = upright). */
  torso: number;
  /** Extra head tilt relative to the torso. */
  neck?: number;
  handN: LimbGoal;
  handF: LimbGoal;
  footN: LimbGoal;
  footF: LimbGoal;
  /** Foot direction relative to the shin (default 90: toes forward). Use for lying or tiptoe poses. */
  toeN?: number;
  toeF?: number;
}

/** Solved joint positions, flattened in this order. */
export const JOINTS = ['head', 'shoulder', 'hip', 'elbowN', 'handN', 'elbowF', 'handF', 'kneeN', 'footN', 'kneeF', 'footF', 'toeN', 'toeF'] as const;
export type Joint = (typeof JOINTS)[number];
export type Frame = number[]; // JOINTS.length * 2 numbers

const rad = (d: number) => (d * Math.PI) / 180;
export const dirPt = (from: Pt, deg: number, len: number): Pt => [from[0] + len * Math.sin(rad(deg)), from[1] + len * Math.cos(rad(deg))];
const angleOf = (from: Pt, to: Pt) => (Math.atan2(to[0] - from[0], to[1] - from[1]) * 180) / Math.PI;

/** Two-bone IK. Returns [middle joint, end point]; an unreachable target leaves the limb straight toward it. */
export function solveLimb(root: Pt, goal: LimbGoal, l1: number, l2: number): [Pt, Pt] {
  const dx = goal.to[0] - root[0];
  const dy = goal.to[1] - root[1];
  const dist = Math.hypot(dx, dy) || 0.0001;
  const d = Math.min(Math.max(dist, Math.abs(l1 - l2) + 0.01), l1 + l2 - 0.01);
  const ux = dx / dist;
  const uy = dy / dist;
  const end: Pt = [root[0] + ux * d, root[1] + uy * d];
  const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  const px = root[0] + ux * a;
  const py = root[1] + uy * a;
  // perpendicular (screen coords): rotate (ux, uy) by +90 degrees
  const mid: Pt = [px - uy * h * goal.bend, py + ux * h * goal.bend];
  return [mid, end];
}

export function solve(p: PoseSpec): Frame {
  const hip = p.hip;
  const shoulder = dirPt(hip, p.torso, LEN.torso);
  const head = dirPt(shoulder, p.torso + (p.neck ?? 0), LEN.neck);
  const [elbowN, handN] = solveLimb(shoulder, p.handN, LEN.upper, LEN.fore);
  const [elbowF, handF] = solveLimb(shoulder, p.handF, LEN.upper, LEN.fore);
  const [kneeN, footN] = solveLimb(hip, p.footN, LEN.thigh, LEN.shin);
  const [kneeF, footF] = solveLimb(hip, p.footF, LEN.thigh, LEN.shin);
  const toeN = dirPt(footN, angleOf(kneeN, footN) + (p.toeN ?? 90), LEN.foot);
  const toeF = dirPt(footF, angleOf(kneeF, footF) + (p.toeF ?? 90), LEN.foot);
  return [head, shoulder, hip, elbowN, handN, elbowF, handF, kneeN, footN, kneeF, footF, toeN, toeF].flat();
}

/** Mirror a solved frame around the centre line (for the partner facing the other way). */
export function mirror(f: Frame, centre = 120): Frame {
  return f.map((v, i) => (i % 2 === 0 ? 2 * centre - v : v));
}


// ------------------------------------------------------------------ props

export type Prop =
  | { kind: 'table'; x: number; width: number; top: number }
  | { kind: 'mat'; x: number; width: number }
  | { kind: 'wall'; x: number };

// ------------------------------------------------------------- animations

export interface Segment {
  /** Tempo cue shown while moving into the next keyframe ("Lower", "Press"). */
  label: string;
  /** Milliseconds to move from this keyframe to the next. */
  ms: number;
}

export interface Demo {
  /** viewBox width (height is always 150). Pairs need more room. */
  width: number;
  /** One loop of keyframes per figure; a pair has two figures moving on the same clock. */
  figures: Frame[][];
  segments: Segment[];
  props: Prop[];
}

const g = (x: number, y: number, bend: 1 | -1): LimbGoal => ({ to: [x, y], bend });
const G = GROUND;

// Knees bend forward (-1 for a leg hanging down from a hip facing right); elbows bend back (+1).
const standing = (x: number, arms: 'down' | 'forward' | 'hips' = 'down'): PoseSpec => ({
  hip: [x, G - 60], torso: 180,
  handN: arms === 'forward' ? g(x + 40, G - 98, 1) : arms === 'hips' ? g(x + 2, G - 62, 1) : g(x + 3, G - 57, 1),
  handF: arms === 'forward' ? g(x + 38, G - 97, 1) : arms === 'hips' ? g(x - 3, G - 62, 1) : g(x - 2, G - 57, 1),
  footN: g(x + 1, G, -1), footF: g(x - 3, G, -1),
});

const squatBottom = (x: number): PoseSpec => ({
  hip: [x - 20, G - 34], torso: 142,
  handN: g(x + 34, G - 64, 1), handF: g(x + 32, G - 63, 1),
  footN: g(x + 1, G, -1), footF: g(x - 3, G, -1),
});

const lungeBottom = (x: number, reachN?: Pt): PoseSpec => ({
  hip: [x - 10, G - 38], torso: 178,
  handN: reachN ? g(reachN[0], reachN[1], 1) : g(x - 7, G - 38, 1), handF: g(x - 12, G - 38, 1),
  footN: g(x + 10, G, -1), footF: g(x - 42, G, -1), toeF: 150,
});

/** Lying on the back, head to the left, knees bent with feet flat. */
const bridgeDown = (x: number): PoseSpec => ({
  hip: [x, G - 7], torso: -88, neck: 0,
  handN: g(x - 14, G - 2, -1), handF: g(x - 18, G - 2, -1),
  footN: g(x + 34, G, -1), footF: g(x + 31, G, -1), toeN: 90, toeF: 90,
});
const bridgeUp = (x: number): PoseSpec => ({
  hip: [x + 4, G - 32], torso: -62, neck: -18,
  handN: g(x - 14, G - 2, -1), handF: g(x - 18, G - 2, -1),
  footN: g(x + 34, G, -1), footF: g(x + 31, G, -1), toeN: 90, toeF: 90,
});

const forearmPlank = (x: number, lift = 0): PoseSpec => ({
  hip: [x, G - 22 - lift], torso: 97, neck: -8,
  handN: g(x + 52, G - 1, 1), handF: g(x + 50, G - 1, 1),
  footN: g(x - 58, G - 4, 1), footF: g(x - 57, G - 4, 1), toeN: 150, toeF: 150,
});

const highPlank = (x: number, raise = false): PoseSpec => ({
  hip: [x, G - 32], torso: 106, neck: -10,
  handN: raise ? g(x + 68, G - 62, 1) : g(x + 38, G, 1), handF: g(x + 36, G, 1),
  footN: g(x - 58, G - 4, 1), footF: g(x - 57, G - 4, 1), toeN: 150, toeF: 150,
});

/** Dead bug: on the back, arms to the ceiling, knees over hips. */
const deadBug = (x: number, extend: boolean): PoseSpec => ({
  hip: [x, G - 8], torso: -90, neck: 0,
  handN: g(x - 38, G - 46, 1), handF: extend ? g(x - 74, G - 8, 1) : g(x - 38, G - 46, 1),
  footN: extend ? g(x + 58, G - 12, 1) : g(x + 30, G - 30, -1), footF: g(x + 30, G - 30, -1),
  toeN: extend ? 90 : 180, toeF: 180,
});

/** Bird dog: on hands and knees, then reach the near arm forward and the far leg back. */
const birdDog = (x: number, reach: boolean): PoseSpec => ({
  hip: [x, G - 32], torso: 92, neck: -6,
  handN: reach ? g(x + 80, G - 34, 1) : g(x + 38, G, 1), handF: g(x + 37, G, 1),
  footN: g(x - 30, G - 2, -1), footF: reach ? g(x - 58, G - 32, 1) : g(x - 31, G - 2, -1),
  toeN: 0, toeF: 0,
});

/** Hands on a table top at G - 49, body straight from the feet. */
const inclinePush = (x: number, down: boolean): PoseSpec => down
  ? { hip: [x - 28, G - 38.6], torso: 130, neck: -6, handN: g(x + 20, G - 49, -1), handF: g(x + 18, G - 49, -1), footN: g(x - 74, G, 1), footF: g(x - 73, G, 1), toeN: 150, toeF: 150 }
  : { hip: [x - 33.4, G - 46], torso: 140, neck: -6, handN: g(x + 20, G - 49, -1), handF: g(x + 18, G - 49, -1), footN: g(x - 74, G, 1), footF: g(x - 73, G, 1), toeN: 150, toeF: 150 };
const table = (x: number): Prop => ({ kind: 'table', x: x + 6, width: 44, top: G - 49 });

const wallSit = (x: number): PoseSpec => ({
  hip: [x, G - 30], torso: 180,
  handN: g(x + 28, G - 32, 1), handF: g(x + 26, G - 32, 1),
  footN: g(x + 30, G, -1), footF: g(x + 27, G, -1),
});

const calfRaise = (x: number, up: boolean): PoseSpec => ({
  ...standing(x, 'hips'),
  hip: [x, G - 60 - (up ? 7 : 0)],
  footN: g(x + 1, G - (up ? 7 : 0), -1), footF: g(x - 3, G - (up ? 7 : 0), -1),
  toeN: up ? 140 : 90, toeF: up ? 140 : 90,
});

const sitUp = (x: number, up: boolean): PoseSpec => ({
  hip: [x, G - 7], torso: up ? 165 : -88, neck: up ? 10 : 0,
  handN: up ? g(x + 22, G - 50, 1) : g(x - 40, G - 14, 1), handF: up ? g(x + 20, G - 50, 1) : g(x - 42, G - 14, 1),
  footN: g(x + 34, G, -1), footF: g(x + 31, G, -1),
});

/** Kneeling, leaning in to hold the partner's feet down. */
const kneelHold = (x: number): PoseSpec => ({
  hip: [x, G - 33], torso: 120, neck: -10,
  handN: g(x + 38, G - 10, -1), handF: g(x + 36, G - 10, -1),
  footN: g(x - 30, G - 2, -1), footF: g(x - 31, G - 2, -1), toeN: 0, toeF: 0,
});

const P = (spec: PoseSpec) => solve(spec);
const loop = (...specs: PoseSpec[]) => specs.map(P);

export const DEMOS: Record<string, Demo> = {
  'incline-push-up': {
    width: 240,
    figures: [loop(inclinePush(110, false), inclinePush(110, true))],
    segments: [{ label: 'Lower', ms: 2000 }, { label: 'Press', ms: 1000 }],
    props: [table(110)],
  },
  squat: {
    width: 240,
    figures: [loop(standing(120, 'down'), squatBottom(120))],
    segments: [{ label: 'Sit back', ms: 1600 }, { label: 'Stand', ms: 1100 }],
    props: [],
  },
  'slow-squat': {
    width: 240,
    figures: [loop(standing(120, 'down'), squatBottom(120))],
    segments: [{ label: 'Lower, 3 seconds', ms: 3000 }, { label: 'Stand', ms: 1100 }],
    props: [],
  },
  'reverse-lunge': {
    width: 240,
    figures: [loop(standing(130, 'hips'), lungeBottom(130))],
    segments: [{ label: 'Step back', ms: 1400 }, { label: 'Return', ms: 1100 }],
    props: [],
  },
  'glute-bridge': {
    width: 240,
    figures: [loop(bridgeDown(100), bridgeUp(100), bridgeUp(100))],
    segments: [{ label: 'Lift', ms: 1000 }, { label: 'Squeeze 2 seconds', ms: 2000 }, { label: 'Lower', ms: 1200 }],
    props: [{ kind: 'mat', x: 34, width: 170 }],
  },
  plank: {
    width: 240,
    figures: [loop(forearmPlank(110), forearmPlank(110, 1.5))],
    segments: [{ label: 'Hold', ms: 1800 }, { label: 'Hold', ms: 1800 }],
    props: [{ kind: 'mat', x: 40, width: 160 }],
  },
  'dead-bug': {
    width: 240,
    figures: [loop(deadBug(130, false), deadBug(130, true))],
    segments: [{ label: 'Extend, breathe out', ms: 1600 }, { label: 'Return', ms: 1200 }],
    props: [{ kind: 'mat', x: 40, width: 170 }],
  },
  'bird-dog': {
    width: 240,
    figures: [loop(birdDog(100, false), birdDog(100, true), birdDog(100, true))],
    segments: [{ label: 'Reach', ms: 1200 }, { label: 'Hold 2 seconds', ms: 2000 }, { label: 'Return', ms: 1100 }],
    props: [{ kind: 'mat', x: 30, width: 180 }],
  },
  'wall-sit': {
    width: 240,
    figures: [loop(wallSit(84), { ...wallSit(84), hip: [84, G - 31] })],
    segments: [{ label: 'Hold', ms: 1800 }, { label: 'Hold', ms: 1800 }],
    props: [{ kind: 'wall', x: 74 }],
  },
  'calf-raise': {
    width: 240,
    figures: [loop(calfRaise(120, false), calfRaise(120, true), calfRaise(120, true))],
    segments: [{ label: 'Rise', ms: 900 }, { label: 'Pause', ms: 700 }, { label: 'Lower', ms: 1300 }],
    props: [],
  },
  // ------------------------------------------------------------ couples
  'mirror-squats': {
    width: 240,
    figures: [loop(standing(76), squatBottom(76)), loop(standing(76), squatBottom(76)).map((f) => mirror(f))],
    segments: [{ label: 'Sit back together', ms: 1600 }, { label: 'Stand', ms: 1100 }],
    props: [],
  },
  'hand-hold-lunges': {
    width: 240,
    figures: [
      loop({ ...standing(84), handN: g(118, G - 64, 1) }, lungeBottom(90, [118, G - 44])),
      loop({ ...standing(84), handN: g(118, G - 64, 1) }, lungeBottom(90, [118, G - 44])).map((f) => mirror(f)),
    ],
    segments: [{ label: 'Step back together', ms: 1400 }, { label: 'Return', ms: 1100 }],
    props: [],
  },
  'plank-high-fives': {
    width: 300,
    figures: [
      loop(highPlank(80), highPlank(80, true), highPlank(80), highPlank(80)),
      loop(highPlank(80), highPlank(80), highPlank(80), highPlank(80, true)).map((f) => mirror(f, 150)),
    ],
    segments: [{ label: 'High five', ms: 800 }, { label: 'Back down', ms: 800 }, { label: 'Partner’s turn', ms: 800 }, { label: 'Back down', ms: 800 }],
    props: [{ kind: 'mat', x: 14, width: 272 }],
  },
  'anchored-sit-ups': {
    width: 240,
    figures: [loop(sitUp(70, false), sitUp(70, true)), loop(kneelHold(100), kneelHold(100)).map((f) => mirror(f))],
    segments: [{ label: 'Curl up', ms: 1300 }, { label: 'Lower', ms: 1300 }],
    props: [{ kind: 'mat', x: 14, width: 210 }],
  },
  'you-go-i-go-push-ups': {
    width: 240,
    figures: [loop(inclinePush(96, false), inclinePush(96, true)), loop(standing(30, 'hips'), standing(30, 'hips')).map((f) => mirror(f))],
    segments: [{ label: 'Lower', ms: 2000 }, { label: 'Press', ms: 1000 }],
    props: [table(96)],
  },
  'back-to-back-sit': {
    width: 240,
    figures: [loop(wallSit(128), { ...wallSit(128), hip: [128, G - 31] }), loop(wallSit(128), { ...wallSit(128), hip: [128, G - 31] }).map((f) => mirror(f))],
    segments: [{ label: 'Hold, backs together', ms: 1800 }, { label: 'Hold', ms: 1800 }],
    props: [],
  },
};
