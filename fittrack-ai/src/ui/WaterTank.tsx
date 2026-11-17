import { useEffect } from 'react';
import Animated, { Easing, useAnimatedProps, useReducedMotion, useSharedValue, withRepeat, withSpring, withTiming } from 'react-native-reanimated';
import Svg, { ClipPath, Defs, G, Path, Rect } from 'react-native-svg';

const AnimatedPath = Animated.createAnimatedComponent(Path);

/** A tank that fills toward the water target, with a moving wave on the surface. */
export function WaterTank({ fraction, width = 76, height = 112, color, track }: {
  fraction: number; width?: number; height?: number; color: string; track: string;
}) {
  const reduced = useReducedMotion();
  const level = useSharedValue(0);
  const phase = useSharedValue(0);

  useEffect(() => {
    level.set(withSpring(Math.max(0, Math.min(1, fraction)), { damping: 14, stiffness: 90 }));
  }, [fraction, level]);
  useEffect(() => {
    if (reduced) return;
    phase.set(withRepeat(withTiming(Math.PI * 2, { duration: 2600, easing: Easing.linear }), -1, false));
  }, [reduced, phase]);

  const wave = useAnimatedProps(() => {
    const l = level.get();
    const amp = l <= 0.001 || l >= 0.999 ? 0 : 3;
    const y = height - l * height;
    let d = `M 0 ${height} L 0 ${y}`;
    for (let x = 0; x <= width; x += 4) {
      d += ` L ${x} ${y + amp * Math.sin((x / width) * Math.PI * 2 + phase.get())}`;
    }
    return { d: `${d} L ${width} ${height} Z` };
  });

  return (
    <Svg width={width} height={height} accessibilityLabel={`Water tank ${Math.round(Math.min(1, fraction) * 100)} percent full`}>
      <Defs>
        <ClipPath id="tank"><Rect x={0} y={0} width={width} height={height} rx={20} ry={20} /></ClipPath>
      </Defs>
      <G clipPath="url(#tank)">
        <Rect x={0} y={0} width={width} height={height} fill={track} />
        <AnimatedPath animatedProps={wave} fill={color} />
        {[0.25, 0.5, 0.75].map((m) => (
          <Rect key={m} x={width - 14} y={height - m * height} width={8} height={1.5} rx={1} fill="rgba(127,127,127,0.45)" />
        ))}
      </G>
    </Svg>
  );
}
