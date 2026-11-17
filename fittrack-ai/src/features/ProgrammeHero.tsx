import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import type { ProgrammeRow } from '../data/tables';
import { formatLocalDate, type LocalDate } from '../domain/dates';
import { daysUntil, programmeProgress } from '../domain/programme';
import { CountUp } from '../ui/motion';
import { fonts, hero, radius, space } from '../ui/theme';

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
const pad2 = (n: number) => String(Math.round(n)).padStart(2, '0');

/** One block per programme week. Past weeks are filled, the current one fills by day and breathes. */
function WeekSegment({ state, fill, index }: { state: 'done' | 'current' | 'todo'; fill: number; index: number }) {
  const grow = useSharedValue(0);
  const pulse = useSharedValue(1);
  useEffect(() => {
    grow.set(withDelay(250 + index * 45, withTiming(state === 'done' ? 1 : state === 'current' ? fill : 0, { duration: 500 })));
    if (state === 'current') {
      pulse.set(withDelay(1200, withRepeat(withSequence(withTiming(0.55, { duration: 900 }), withTiming(1, { duration: 900 })), -1)));
    }
  }, [state, fill, index, grow, pulse]);
  const style = useAnimatedStyle(() => ({ width: `${grow.get() * 100}%`, opacity: pulse.get() }));
  return (
    <View style={styles.segment}>
      <Animated.View style={[styles.segmentFill, style]} />
    </View>
  );
}

/** The scoreboard at the top of Today: programme week and day, progress by week, checkpoint countdown. */
export function ProgrammeHero({ programme, today }: { programme: ProgrammeRow | null; today: LocalDate }) {
  const p = programme;
  const progress = p ? programmeProgress({ startDate: p.start_date, weeks: p.weeks }, today) : null;
  const toCheckpoint = p?.checkpoint_date ? daysUntil(p.checkpoint_date, today) : null;
  const week = progress?.status === 'active' ? progress.week : 0;
  const label = !p || !progress ? 'No programme set'
    : progress.status === 'active' ? `Week ${progress.week} of ${progress.totalWeeks}, day ${progress.day} of ${progress.totalDays}`
    : progress.status === 'upcoming' ? `Programme starts in ${plural(progress.daysToStart, 'day')}`
    : 'Programme complete';

  return (
    <LinearGradient colors={hero.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero} accessible accessibilityLabel={label}>
      {/* oversized ghost numeral, like a scoreboard behind glass */}
      {progress?.status === 'active' ? <Text style={styles.ghost} importantForAccessibility="no" aria-hidden>{pad2(progress.week)}</Text> : null}

      <View style={styles.topRow}>
        <Text style={styles.eyebrow}>{p?.name || 'Programme'}</Text>
        {progress?.status === 'active' ? (
          <View style={styles.pill}><Text style={styles.pillText}>DAY {progress.day} / {progress.totalDays}</Text></View>
        ) : null}
      </View>

      {!p || !progress ? (
        <Text style={styles.body}>No programme set. Add one from the Plan tab.</Text>
      ) : progress.status === 'active' ? (
        <View style={styles.bigRow}>
          <Text style={styles.bigLabel}>WEEK</Text>
          <CountUp value={progress.week} format={pad2} style={styles.bigNumber} />
          <Text style={styles.of}>/ {progress.totalWeeks}</Text>
        </View>
      ) : progress.status === 'upcoming' ? (
        <View style={styles.bigRow}>
          <Text style={styles.bigLabel}>STARTS IN</Text>
          <CountUp value={progress.daysToStart} style={styles.bigNumber} />
          <Text style={styles.of}>{progress.daysToStart === 1 ? 'day' : 'days'}</Text>
        </View>
      ) : (
        <View style={styles.bigRow}><Text style={styles.bigNumber}>COMPLETE</Text></View>
      )}

      {p && progress ? (
        <View style={styles.segments}>
          {Array.from({ length: progress.totalWeeks }, (_, i) => {
            const n = i + 1;
            const state = progress.status === 'finished' || n < week ? 'done' : n === week ? 'current' : 'todo';
            const fill = progress.status === 'active' ? (((progress.day - 1) % 7) + 1) / 7 : 0;
            return <WeekSegment key={n} index={i} state={state} fill={fill} />;
          })}
        </View>
      ) : null}

      {p?.checkpoint_date && toCheckpoint !== null ? (
        <View style={styles.foot}>
          <Ionicons name="flag" size={14} color={hero.lime} />
          <Text style={styles.footText}>
            {toCheckpoint > 0 ? `${plural(toCheckpoint, 'day')} to the ${formatLocalDate(p.checkpoint_date)} checkpoint`
              : toCheckpoint === 0 ? 'Checkpoint day' : `Checkpoint was ${formatLocalDate(p.checkpoint_date)}`}
          </Text>
        </View>
      ) : null}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  hero: { borderRadius: 28, padding: space.xl, gap: space.md, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(200,245,60,0.16)' },
  ghost: { position: 'absolute', right: -6, top: -34, fontFamily: fonts.headingBold, fontSize: 210, lineHeight: 220, color: hero.ghost },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  eyebrow: { fontFamily: fonts.bodySemiBold, fontSize: 11, letterSpacing: 1.4, textTransform: 'uppercase', color: hero.textMuted },
  pill: { backgroundColor: 'rgba(200,245,60,0.14)', borderRadius: radius.pill, paddingHorizontal: space.md, paddingVertical: 5 },
  pillText: { fontFamily: fonts.heading, fontSize: 15, letterSpacing: 0.6, color: hero.lime, fontVariant: ['tabular-nums'] },
  bigRow: { flexDirection: 'row', alignItems: 'baseline', gap: space.sm, marginTop: space.xs },
  bigLabel: { fontFamily: fonts.heading, fontSize: 22, letterSpacing: 1.5, color: hero.textMuted },
  bigNumber: { fontFamily: fonts.headingBold, fontSize: 76, lineHeight: 76, color: hero.lime, fontVariant: ['tabular-nums'] },
  of: { fontFamily: fonts.heading, fontSize: 26, color: hero.textMuted },
  body: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22, color: hero.text },
  segments: { flexDirection: 'row', gap: 4 },
  segment: { flex: 1, height: 7, borderRadius: 4, backgroundColor: hero.track, overflow: 'hidden' },
  segmentFill: { height: '100%', borderRadius: 4, backgroundColor: hero.lime },
  foot: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.xs },
  footText: { fontFamily: fonts.bodyMedium, fontSize: 13, color: hero.text },
});
