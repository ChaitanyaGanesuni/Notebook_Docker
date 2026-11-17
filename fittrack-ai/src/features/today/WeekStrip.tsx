import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { addDays, formatLocalDate, weekDates, type LocalDate } from '../../domain/dates';
import { PressableScale } from '../../ui/motion';
import { fonts, motion, radius, space, useTheme } from '../../ui/theme';

const LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

function ScoreRing({ fraction, color, track, size = 36 }: { fraction: number; color: string; track: string; size?: number }) {
  const r = size / 2 - 2.5;
  const length = 2 * Math.PI * r;
  return (
    <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
      <Circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={3} fill="none" />
      {fraction > 0 ? (
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={3} fill="none" strokeLinecap="round"
          strokeDasharray={`${length * fraction} ${length}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      ) : null}
    </Svg>
  );
}

/** Monday-to-Sunday strip. Each day shows its score ring (how many of the six daily targets were met). */
export function WeekStrip({ selected, today, scores, onSelect }: {
  selected: LocalDate; today: LocalDate; scores: Record<string, { met: number; of: number }>; onSelect: (d: LocalDate) => void;
}) {
  const { c, lift, dark } = useTheme();
  const days = weekDates(selected);
  const index = days.indexOf(selected);
  const [width, setWidth] = useState(0);
  const cell = width > 0 ? (width - PAD * 2) / 7 : 0;
  const x = useSharedValue(0);
  useEffect(() => {
    x.set(withSpring(index * cell, motion.spring));
  }, [index, cell, x]);
  const slide = useAnimatedStyle(() => ({ transform: [{ translateX: x.get() }] }));
  const nextWeekStart = addDays(days[0]!, 7);

  return (
    <View style={{ gap: space.sm }}>
      <View style={styles.head}>
        <PressableScale accessibilityRole="button" accessibilityLabel="Previous week" style={styles.arrow} onPress={() => onSelect(addDays(selected, -7))}>
          <Ionicons name="chevron-back" size={20} color={c.muted} />
        </PressableScale>
        <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 13, color: c.muted }}>
          {days.includes(today) ? 'This week' : `${formatLocalDate(days[0]!).slice(4, -5)} to ${formatLocalDate(days[6]!).slice(4)}`}
        </Text>
        <PressableScale accessibilityRole="button" accessibilityLabel="Next week" disabled={nextWeekStart > today}
          style={[styles.arrow, { opacity: nextWeekStart > today ? 0.3 : 1 }]}
          onPress={() => onSelect(addDays(selected, 7) > today ? today : addDays(selected, 7))}>
          <Ionicons name="chevron-forward" size={20} color={c.muted} />
        </PressableScale>
      </View>
      <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        style={[styles.strip, lift, { backgroundColor: c.surface, borderColor: dark ? c.hairline : 'transparent' }]}>
        {cell > 0 ? <Animated.View style={[styles.selection, { width: cell, backgroundColor: c.sunken }, slide]} /> : null}
        {days.map((d, i) => {
          const future = d > today;
          const score = scores[d];
          const on = d === selected;
          return (
            <PressableScale key={d} haptic disabled={future} onPress={() => onSelect(d)} style={[styles.day, { opacity: future ? 0.35 : 1 }]}
              accessibilityRole="button" accessibilityState={{ selected: on, disabled: future }}
              accessibilityLabel={`${formatLocalDate(d)}${score ? `, ${score.met} of ${score.of} targets met` : ''}${d === today ? ', today' : ''}`}>
              <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 11, color: d === today ? c.accent : c.muted }}>{LETTERS[i]}</Text>
              <View style={styles.ring}>
                <ScoreRing fraction={score ? score.met / score.of : 0} color={c.accent} track={c.hairline} />
                <Text style={{ fontFamily: fonts.heading, fontSize: 16, color: on || d === today ? c.text : c.muted, fontVariant: ['tabular-nums'] }}>{Number(d.slice(8))}</Text>
              </View>
            </PressableScale>
          );
        })}
      </View>
    </View>
  );
}

const PAD = 6;
const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  arrow: { width: 44, height: 36, alignItems: 'center', justifyContent: 'center' },
  strip: { flexDirection: 'row', borderRadius: radius.lg, padding: PAD, borderWidth: StyleSheet.hairlineWidth },
  selection: { position: 'absolute', top: PAD, bottom: PAD, left: PAD, borderRadius: radius.md },
  day: { flex: 1, alignItems: 'center', gap: 6, paddingVertical: space.sm, minHeight: 68 },
  ring: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
});
