import { useEffect } from 'react';
import { Text, View } from 'react-native';
import Animated, { Easing, useAnimatedProps, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { fonts, useTheme } from '../../ui/theme';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/** A ring that drains smoothly to the end time, with the seconds left in the middle. */
export function Countdown({ endsAt, totalMs, remainingMs, label, color, size = 220 }: {
  endsAt: number | null; totalMs: number; remainingMs: number; label: string; color: string; size?: number;
}) {
  const { c } = useTheme();
  const stroke = 14;
  const r = (size - stroke) / 2;
  const len = 2 * Math.PI * r;
  const frac = useSharedValue(totalMs > 0 ? remainingMs / totalMs : 0);
  useEffect(() => {
    if (endsAt === null || totalMs <= 0) return;
    const left = Math.max(0, endsAt - Date.now());
    frac.set(left / totalMs);
    frac.set(withTiming(0, { duration: left, easing: Easing.linear }));
  }, [endsAt, totalMs, frac]);
  const props = useAnimatedProps(() => ({ strokeDashoffset: len * (1 - frac.get()) }));
  const secs = Math.ceil(remainingMs / 1000);
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }} accessible accessibilityRole="timer" accessibilityLabel={`${label}, ${secs} seconds left`}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={c.sunken} strokeWidth={stroke} fill="none" />
        <AnimatedCircle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} fill="none" strokeLinecap="round"
          strokeDasharray={`${len} ${len}`} animatedProps={props} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      </Svg>
      <Text style={{ fontFamily: fonts.headingBold, fontSize: size * 0.32, lineHeight: size * 0.34, color: c.text, fontVariant: ['tabular-nums'] }}>{secs}</Text>
      <Text style={{ fontFamily: fonts.bodySemiBold, fontSize: 12, letterSpacing: 1.4, color: c.muted }}>{label.toUpperCase()}</Text>
    </View>
  );
}
