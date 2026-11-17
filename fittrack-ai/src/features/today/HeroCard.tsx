import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';
import type { ProgrammeRow } from '../../data/tables';
import type { DaySummary } from '../../domain/day';
import { type LocalDate } from '../../domain/dates';
import { daysUntil, programmeProgress } from '../../domain/programme';
import type { VerdictKind } from '../../domain/verdict';
import { Rings } from '../../ui/Rings';
import { CountUp } from '../../ui/motion';
import { fonts, hero, radius, space } from '../../ui/theme';

const grouped = (n: number) => Math.round(n).toLocaleString('en-IN');
const litres = (ml: number) => String(Number((ml / 1000).toFixed(2)));
const VERDICT_COLOR: Record<VerdictKind, string> = {
  none: 'rgba(244,246,242,0.55)', in_progress: hero.ringWater, deficit: hero.lime,
  maintenance: hero.ringProtein, surplus: '#FF8A65', too_low: '#FF8A65',
};

function Legend({ color, value, target, unit }: { color: string; value: string; target: string; unit: string }) {
  return (
    <View style={styles.legend} accessible accessibilityLabel={`${value} of ${target} ${unit}`}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <View>
        <Text style={styles.legendValue}>{value}<Text style={styles.legendTarget}> / {target}</Text></Text>
        <Text style={styles.legendUnit}>{unit}</Text>
      </View>
    </View>
  );
}

/** The day at a glance: calorie, protein and water rings, the deficit verdict, and where the programme stands. */
export function HeroCard({ summary, waterMl, targets, programme, date, isToday }: {
  summary: DaySummary; waterMl: number;
  targets: { protein_target_g: number; water_ml: number };
  programme: ProgrammeRow | null; date: LocalDate; isToday: boolean;
}) {
  const { totals, verdict, burn, kcalTarget } = summary;
  const kind: VerdictKind = verdict?.kind ?? 'none';
  const color = VERDICT_COLOR[kind];
  const p = programme ? programmeProgress({ startDate: programme.start_date, weeks: programme.weeks }, date) : null;
  const toCheckpoint = programme?.checkpoint_date ? daysUntil(programme.checkpoint_date, date) : null;

  return (
    <LinearGradient colors={hero.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.card}>
      <View style={styles.top}>
        <Rings size={166} stroke={11} gap={4} track={hero.track}
          label={`${grouped(totals.kcal)} of ${grouped(kcalTarget)} kilocalories, ${Math.round(totals.protein_g)} of ${targets.protein_target_g} grams protein, ${(waterMl / 1000).toFixed(2)} of ${targets.water_ml / 1000} litres water`}
          rings={[
            { progress: totals.kcal / kcalTarget, color: hero.ringCalories },
            { progress: totals.protein_g / targets.protein_target_g, color: hero.ringProtein },
            { progress: waterMl / targets.water_ml, color: hero.ringWater },
          ]}>
          <CountUp value={totals.kcal} format={grouped} style={styles.kcal} />
          <Text style={styles.kcalUnit}>kcal</Text>
        </Rings>

        <View style={styles.verdict}>
          <Animated.View key={kind} entering={ZoomIn.springify().damping(14)} style={[styles.chip, { backgroundColor: `${color}22`, borderColor: `${color}55` }]}>
            <View style={[styles.dot, { backgroundColor: color }]} />
            <Text style={[styles.chipText, { color }]}>{verdict?.label ?? 'No estimate'}</Text>
          </Animated.View>
          <Text style={styles.message} accessibilityLiveRegion="polite">
            {verdict?.message ?? 'Log a weight to estimate your burn and get a verdict.'}
          </Text>
          {verdict?.note ? <Text style={styles.note}>{verdict.note}</Text> : null}
          {burn !== null ? (
            <Text style={styles.burn}>Estimated burn {isToday ? 'today' : 'that day'}: <Text style={styles.burnValue}>{grouped(burn)} kcal</Text></Text>
          ) : null}
        </View>
      </View>

      <View style={styles.legends}>
        <Legend color={hero.ringCalories} value={grouped(totals.kcal)} target={grouped(kcalTarget)} unit="kcal" />
        <Legend color={hero.ringProtein} value={String(Math.round(totals.protein_g))} target={String(targets.protein_target_g)} unit="g protein" />
        <Legend color={hero.ringWater} value={litres(waterMl)} target={String(targets.water_ml / 1000)} unit="L water" />
      </View>

      {p ? (
        <View style={styles.programme} accessible
          accessibilityLabel={p.status === 'active' ? `Week ${p.week} of ${p.totalWeeks}, day ${p.day} of ${p.totalDays}` : p.status === 'upcoming' ? `Programme starts in ${p.daysToStart} days` : 'Programme complete'}>
          <Ionicons name="flag" size={13} color={hero.lime} />
          <Text style={styles.programmeText}>
            {p.status === 'active' ? <>WEEK <Text style={styles.programmeStrong}>{p.week}</Text> OF {p.totalWeeks}  ·  DAY <Text style={styles.programmeStrong}>{p.day}</Text> OF {p.totalDays}</>
              : p.status === 'upcoming' ? `PROGRAMME STARTS IN ${p.daysToStart} ${p.daysToStart === 1 ? 'DAY' : 'DAYS'}`
              : 'PROGRAMME COMPLETE'}
          </Text>
          {toCheckpoint !== null && toCheckpoint > 0 ? <Text style={styles.checkpoint}>{toCheckpoint} days to checkpoint</Text> : null}
        </View>
      ) : null}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 28, padding: space.lg + 2, gap: space.lg, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(200,245,60,0.16)' },
  top: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  kcal: { fontFamily: fonts.headingBold, fontSize: 30, lineHeight: 32, color: hero.text, fontVariant: ['tabular-nums'] },
  kcalUnit: { fontFamily: fonts.bodyMedium, fontSize: 11, color: hero.textMuted, marginTop: -2 },
  verdict: { flex: 1, gap: space.sm, alignItems: 'flex-start' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: radius.pill, borderWidth: 1, paddingHorizontal: space.md, paddingVertical: 5 },
  chipText: { fontFamily: fonts.heading, fontSize: 17, letterSpacing: 0.6, textTransform: 'uppercase' },
  message: { fontFamily: fonts.bodyMedium, fontSize: 14, lineHeight: 20, color: hero.text },
  note: { fontFamily: fonts.body, fontSize: 12, lineHeight: 16, color: hero.ringProtein },
  burn: { fontFamily: fonts.body, fontSize: 12, lineHeight: 16, color: hero.textMuted },
  burnValue: { fontFamily: fonts.bodySemiBold, color: hero.text },
  legends: { flexDirection: 'row', justifyContent: 'space-between', gap: space.sm },
  legend: { flexDirection: 'row', gap: 7, alignItems: 'flex-start', flexShrink: 1 },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 6 },
  legendValue: { fontFamily: fonts.heading, fontSize: 19, color: hero.text, fontVariant: ['tabular-nums'] },
  legendTarget: { fontSize: 14, color: hero.textMuted },
  legendUnit: { fontFamily: fonts.body, fontSize: 11, color: hero.textMuted },
  programme: { flexDirection: 'row', alignItems: 'center', gap: space.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: hero.track, paddingTop: space.md, flexWrap: 'wrap' },
  programmeText: { fontFamily: fonts.heading, fontSize: 14, letterSpacing: 0.9, color: hero.textMuted, flexGrow: 1 },
  programmeStrong: { color: hero.lime },
  checkpoint: { fontFamily: fonts.body, fontSize: 12, color: hero.textMuted },
});
