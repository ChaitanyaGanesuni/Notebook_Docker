import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Platform, Pressable, Text, type PressableProps, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import Animated, { FadeInDown, useAnimatedStyle, useReducedMotion, useSharedValue, withSpring } from 'react-native-reanimated';
import { motion } from './theme';

/** Content rises and fades in, staggered by `index`. Skipped when the system asks for reduced motion. */
export function Appear({ index = 0, children, style }: { index?: number; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <Animated.View style={style} entering={FadeInDown.delay(index * motion.stagger).duration(motion.enter)}>
      {children}
    </Animated.View>
  );
}

/** A number that counts up to its value whenever the value changes. Shows the value at once under reduced motion. */
export function CountUp({ value, format = (n) => String(Math.round(n)), style, duration = 800 }: {
  value: number; format?: (n: number) => string; style?: StyleProp<TextStyle>; duration?: number;
}) {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(0);
  const from = useRef(0);

  useEffect(() => {
    if (reduced) return;
    const start = from.current;
    const t0 = Date.now();
    let frame = 0;
    const tick = () => {
      const p = Math.min(1, (Date.now() - t0) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      const now = start + (value - start) * eased;
      from.current = now;
      setShown(now);
      if (p < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, duration, reduced]);

  // Screen readers get the final value, not every frame.
  return <Text style={style} accessibilityLabel={format(value)}>{format(reduced ? value : shown)}</Text>;
}

export function tapHaptic() {
  if (Platform.OS !== 'web') void Haptics.selectionAsync().catch(() => undefined);
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** A pressable that dips slightly under the finger and springs back. */
export function PressableScale({ children, style, onPressIn, onPressOut, haptic = false, onPress, ...rest }: Omit<PressableProps, 'style' | 'children'> & {
  children: ReactNode; style?: StyleProp<ViewStyle>; haptic?: boolean;
}) {
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  return (
    <AnimatedPressable
      {...rest}
      onPress={(e) => { if (haptic) tapHaptic(); onPress?.(e); }}
      onPressIn={(e) => { scale.set(withSpring(0.96, motion.spring)); onPressIn?.(e); }}
      onPressOut={(e) => { scale.set(withSpring(1, motion.spring)); onPressOut?.(e); }}
      style={[style, animated]}
    >
      {children}
    </AnimatedPressable>
  );
}
