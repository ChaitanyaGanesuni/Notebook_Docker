import { useEffect, type ReactNode } from 'react';
import { View } from 'react-native';
import Animated, { Easing, useAnimatedProps, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export interface RingSpec { progress: number; color: string }

function Ring({ center, radius, stroke, progress, color, track, delay }: {
  center: number; radius: number; stroke: number; progress: number; color: string; track: string; delay: number;
}) {
  const length = 2 * Math.PI * radius;
  const shown = useSharedValue(0);
  useEffect(() => {
    const target = Math.max(0, Math.min(1, Number.isFinite(progress) ? progress : 0));
    shown.set(withDelay(delay, withTiming(target, { duration: 900, easing: Easing.out(Easing.cubic) })));
  }, [progress, delay, shown]);
  const animated = useAnimatedProps(() => ({ strokeDashoffset: length * (1 - shown.get()) }));
  return (
    <>
      <Circle cx={center} cy={center} r={radius} stroke={track} strokeWidth={stroke} fill="none" />
      <AnimatedCircle cx={center} cy={center} r={radius} stroke={color} strokeWidth={stroke} fill="none"
        strokeLinecap="round" strokeDasharray={`${length} ${length}`} animatedProps={animated}
        transform={`rotate(-90 ${center} ${center})`} />
    </>
  );
}

/** Concentric progress rings, outermost first. Each ring draws in when its value changes. */
export function Rings({ size, stroke, gap = 4, rings, track, children, label }: {
  size: number; stroke: number; gap?: number; rings: RingSpec[]; track: string; children?: ReactNode; label?: string;
}) {
  const center = size / 2;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }} accessible={!!label} accessibilityLabel={label}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        {rings.map((r, i) => (
          <Ring key={i} center={center} radius={center - stroke / 2 - i * (stroke + gap)} stroke={stroke}
            progress={r.progress} color={r.color} track={track} delay={i * 120} />
        ))}
      </Svg>
      {children}
    </View>
  );
}
