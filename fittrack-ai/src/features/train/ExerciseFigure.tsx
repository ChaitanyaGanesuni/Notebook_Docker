import { useEffect, useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import Animated, { Easing, useAnimatedProps, useAnimatedReaction, useReducedMotion, useSharedValue, withRepeat, withTiming, type SharedValue } from 'react-native-reanimated';
import Svg, { Circle, Defs, Ellipse, G as SvgG, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { scheduleOnRN } from 'react-native-worklets';
import { DEMOS, GROUND, JOINTS, type Demo, type Frame, type Prop } from '../../domain/training/poses';
import { fonts, LIME, radius, useTheme } from '../../ui/theme';

/** Presenter builds. Proportions come from the shared pose; the build sets outfit, hair and line weights. */
export type Build = 'male' | 'female';

const SKIN = '#B9805A';
const SKIN_FAR = '#9C6644';
const HAIR = '#231A14';
const STYLE: Record<Build, { top: string; topFar: string; bottom: string; bottomFar: string; shinNear: string; shinFar: string; torso: number; limb: number; hairLong: boolean }> = {
  male: { top: '#2F80C8', topFar: '#286CA8', bottom: '#2A2F38', bottomFar: '#20242B', shinNear: SKIN, shinFar: SKIN_FAR, torso: 17, limb: 10.5, hairLong: false },
  female: { top: '#EE7B3C', topFar: '#CF6630', bottom: '#2E3440', bottomFar: '#232830', shinNear: '#2E3440', shinFar: '#232830', torso: 15, limb: 9.5, hairLong: true },
};

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedEllipse = Animated.createAnimatedComponent(Ellipse);

const J = Object.fromEntries(JOINTS.map((j, i) => [j, i])) as Record<(typeof JOINTS)[number], number>;

/** Clock position (ms into the loop) to keyframe index and eased progress. */
function locate(t: number, durations: number[]): { k: number; e: number } {
  'worklet';
  let acc = 0;
  for (let i = 0; i < durations.length; i++) {
    const d = durations[i]!;
    if (t < acc + d || i === durations.length - 1) {
      const x = Math.min(1, Math.max(0, (t - acc) / d));
      return { k: i, e: x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2 };
    }
    acc += d;
  }
  return { k: 0, e: 0 };
}

function point(frames: Frame[], durations: number[], t: number, joint: number): [number, number] {
  'worklet';
  const { k, e } = locate(t, durations);
  const a = frames[k]!;
  const b = frames[(k + 1) % frames.length]!;
  return [a[joint * 2]! + (b[joint * 2]! - a[joint * 2]!) * e, a[joint * 2 + 1]! + (b[joint * 2 + 1]! - a[joint * 2 + 1]!) * e];
}

type Clock = SharedValue<number>;

/** Animated path through 2 to 4 joints, or a partial segment between two fractions of a bone. */
function useSegment(frames: Frame[], durations: number[], clock: Clock, a: number, b: number, c?: number, d?: number, along?: [number, number]) {
  return useAnimatedProps(() => {
    const t = clock.get();
    const p1 = point(frames, durations, t, a);
    const p2 = point(frames, durations, t, b);
    if (along) {
      const s0 = [p1[0] + (p2[0] - p1[0]) * along[0], p1[1] + (p2[1] - p1[1]) * along[0]];
      const s1 = [p1[0] + (p2[0] - p1[0]) * along[1], p1[1] + (p2[1] - p1[1]) * along[1]];
      return { d: `M${s0[0]} ${s0[1]} L${s1[0]} ${s1[1]}` };
    }
    let path = `M${p1[0]} ${p1[1]} L${p2[0]} ${p2[1]}`;
    if (c !== undefined) { const p3 = point(frames, durations, t, c); path += ` L${p3[0]} ${p3[1]}`; }
    if (d !== undefined) { const p4 = point(frames, durations, t, d); path += ` L${p4[0]} ${p4[1]}`; }
    return { d: path };
  });
}

/** Hair sits on the back-top of the head: offset against the facing direction (perpendicular to the torso). */
function useHair(frames: Frame[], durations: number[], clock: Clock, dist: number, back: number, r: number) {
  return useAnimatedProps(() => {
    const t = clock.get();
    const sh = point(frames, durations, t, J.shoulder);
    const h = point(frames, durations, t, J.head);
    const ux = (h[0] - sh[0]) / 15; const uy = (h[1] - sh[1]) / 15;
    const fx = -uy; const fy = ux;
    return { cx: h[0] + ux * dist - fx * back, cy: h[1] + uy * dist - fy * back, r };
  });
}

function Figure({ frames, durations, clock, build }: { frames: Frame[]; durations: number[]; clock: Clock; build: Build }) {
  const st = STYLE[build];
  const f = [frames, durations, clock] as const;
  const armF = useSegment(...f, J.shoulder, J.elbowF, J.handF);
  const sleeveF = useSegment(...f, J.shoulder, J.elbowF, undefined, undefined, [0, 0.55]);
  const thighF = useSegment(...f, J.hip, J.kneeF);
  const shinF = useSegment(...f, J.kneeF, J.footF);
  const shoeF = useSegment(...f, J.footF, J.toeF);
  const torso = useSegment(...f, J.hip, J.shoulder);
  const neck = useSegment(...f, J.shoulder, J.head, undefined, undefined, [0, 0.6]);
  const thighN = useSegment(...f, J.hip, J.kneeN);
  const shinN = useSegment(...f, J.kneeN, J.footN);
  const shoeN = useSegment(...f, J.footN, J.toeN);
  const armN = useSegment(...f, J.shoulder, J.elbowN, J.handN);
  const sleeveN = useSegment(...f, J.shoulder, J.elbowN, undefined, undefined, [0, 0.55]);
  const head = useAnimatedProps(() => { const p = point(frames, durations, clock.get(), J.head); return { cx: p[0], cy: p[1] }; });
  const hair = useHair(...f, 1.6, 1.8, 9.6);
  const bun = useHair(...f, 1, 10, 5.2);
  const hips = useAnimatedProps(() => { const p = point(frames, durations, clock.get(), J.hip); return { cx: p[0], cy: p[1] }; });

  const line = { fill: 'none', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  return (
    <SvgG>
      <AnimatedPath animatedProps={armF} stroke={SKIN_FAR} strokeWidth={st.limb - 1} {...line} />
      <AnimatedPath animatedProps={sleeveF} stroke={st.topFar} strokeWidth={st.limb + 1} {...line} />
      <AnimatedPath animatedProps={thighF} stroke={st.bottomFar} strokeWidth={st.limb + 2} {...line} />
      <AnimatedPath animatedProps={shinF} stroke={st.shinFar} strokeWidth={st.limb} {...line} />
      <AnimatedPath animatedProps={shoeF} stroke="#D9DDE3" strokeWidth={7} {...line} />
      {st.hairLong ? <AnimatedCircle animatedProps={bun} fill={HAIR} /> : null}
      <AnimatedPath animatedProps={neck} stroke={SKIN} strokeWidth={7} {...line} />
      <AnimatedPath animatedProps={torso} stroke={st.top} strokeWidth={st.torso} {...line} />
      <AnimatedCircle animatedProps={hips} r={st.torso / 2 + 0.5} fill={st.bottom} />
      <AnimatedCircle animatedProps={hair} fill={HAIR} />
      <AnimatedCircle animatedProps={head} r={8.6} fill={SKIN} />
      <AnimatedPath animatedProps={thighN} stroke={st.bottom} strokeWidth={st.limb + 2} {...line} />
      <AnimatedPath animatedProps={shinN} stroke={st.shinNear} strokeWidth={st.limb} {...line} />
      <AnimatedPath animatedProps={shoeN} stroke="#F4F5F7" strokeWidth={7} {...line} />
      <AnimatedPath animatedProps={armN} stroke={SKIN} strokeWidth={st.limb - 1} {...line} />
      <AnimatedPath animatedProps={sleeveN} stroke={st.top} strokeWidth={st.limb + 1} {...line} />
    </SvgG>
  );
}

function Shadow({ frames, durations, clock }: { frames: Frame[]; durations: number[]; clock: SharedValue<number> }) {
  const props = useAnimatedProps(() => {
    const t = clock.get();
    const h = point(frames, durations, t, J.hip);
    const f = point(frames, durations, t, J.footN);
    const s = point(frames, durations, t, J.shoulder);
    const minX = Math.min(h[0], f[0], s[0]); const maxX = Math.max(h[0], f[0], s[0]);
    return { cx: (minX + maxX) / 2, rx: Math.max(22, (maxX - minX) / 2 + 16) };
  });
  return <AnimatedEllipse animatedProps={props} cy={GROUND + 1} ry={4} fill="rgba(0,0,0,0.13)" />;
}

function Props({ props, dark }: { props: Prop[]; dark: boolean }) {
  return (
    <>
      {props.map((p, i) => p.kind === 'table' ? (
        <SvgG key={i}>
          <Rect x={p.x} y={p.top} width={p.width} height={6} rx={2} fill={dark ? '#8A6A4C' : '#A07A55'} />
          <Rect x={p.x + 4} y={p.top + 5} width={4.5} height={GROUND - p.top - 5} fill={dark ? '#6E5440' : '#86644A'} />
          <Rect x={p.x + p.width - 8.5} y={p.top + 5} width={4.5} height={GROUND - p.top - 5} fill={dark ? '#6E5440' : '#86644A'} />
        </SvgG>
      ) : p.kind === 'mat' ? (
        <Rect key={i} x={p.x} y={GROUND - 2.5} width={p.width} height={5} rx={2.5} fill={dark ? '#3B4A22' : '#CFE59A'} />
      ) : (
        <Rect key={i} x={p.x - 8} y={14} width={8} height={GROUND - 14} rx={2} fill={dark ? '#2E3440' : '#DCD8CE'} />
      ))}
    </>
  );
}

/**
 * Illustrated exercise demo. Used for every move until licensed demo media is
 * added (see src/assets/demos.ts). A pair demo shows both builds.
 */
export function ExerciseFigure({ demoKey, build, height = 190, playing = true, showTempo = false, label }: {
  demoKey: string; build: Build; height?: number; playing?: boolean; showTempo?: boolean; label?: string;
}) {
  const { dark } = useTheme();
  const reduced = useReducedMotion();
  const demo: Demo | undefined = DEMOS[demoKey];
  const durations = useMemo(() => demo?.segments.map((s) => s.ms) ?? [1000], [demo]);
  const total = durations.reduce((a, b) => a + b, 0);
  const clock = useSharedValue(0);
  const [segment, setSegment] = useState(0);
  const animate = playing && !reduced;

  useEffect(() => {
    if (!animate) {
      // Still image: the working position, which shows the move best.
      clock.set(durations.length > 1 ? durations[0]! : 0);
      return;
    }
    clock.set(0);
    clock.set(withRepeat(withTiming(total, { duration: total, easing: Easing.linear }), -1, false));
  }, [animate, total, durations, clock]);

  useAnimatedReaction(() => locate(clock.get(), durations).k, (k, prev) => {
    if (showTempo && k !== prev) scheduleOnRN(setSegment, k);
  }, [showTempo, durations]);

  if (!demo) return null;
  const builds: Build[] = demo.figures.length > 1 ? [build, build === 'male' ? 'female' : 'male'] : [build];
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={label ?? 'Exercise demonstration'}>
      <View style={{ borderRadius: radius.md, overflow: 'hidden' }}>
        <Svg width="100%" height={height} viewBox={`0 0 ${demo.width} 150`} preserveAspectRatio="xMidYMid meet">
          <Defs>
            <LinearGradient id="stage" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={dark ? '#1C2129' : '#F6F4EE'} />
              <Stop offset="1" stopColor={dark ? '#252B35' : '#E9E5DA'} />
            </LinearGradient>
          </Defs>
          <Rect x={0} y={0} width={demo.width} height={150} fill="url(#stage)" />
          <Rect x={0} y={GROUND} width={demo.width} height={10} fill={dark ? '#2B323D' : '#DDD8CB'} />
          <Props props={demo.props} dark={dark} />
          {demo.figures.map((frames, i) => <Shadow key={`s${i}`} frames={frames} durations={durations} clock={clock} />)}
          {demo.figures.map((frames, i) => <Figure key={i} frames={frames} durations={durations} clock={clock} build={builds[i]!} />)}
        </Svg>
      </View>
      {showTempo ? (
        <View style={{ position: 'absolute', left: 10, top: 10, backgroundColor: 'rgba(11,13,17,0.78)', borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 5 }}>
          <Text accessibilityLiveRegion="polite" style={{ fontFamily: fonts.heading, fontSize: 16, letterSpacing: 0.6, color: LIME }}>{(demo.segments[segment]?.label ?? '').toUpperCase()}</Text>
        </View>
      ) : null}
    </View>
  );
}
