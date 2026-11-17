import { StyleSheet, View } from 'react-native';
import { useActiveProgramme, useProfile, useTargets, useWeightLogs } from '../../data/DataProvider';
import { ProgrammeHero } from '../../features/ProgrammeHero';
import { SyncNotice } from '../../features/SyncNotice';
import { formatLocalDate, localDateOf } from '../../domain/dates';
import { Bullet, Card, Eyebrow, IconChip, Muted, Num, Screen, SectionHeader, StateView, Title, type IconName } from '../../ui/components';
import { Appear, CountUp } from '../../ui/motion';
import { fonts, radius, space, useTheme } from '../../ui/theme';

const grouped = (n: number) => Math.round(n).toLocaleString('en-IN');

function Stat({ icon, value, format, unit, tint, soft }: {
  icon: IconName; value: number; format?: (n: number) => string; unit: string; tint: string; soft: string;
}) {
  const { c } = useTheme();
  return (
    <View style={[styles.stat, { backgroundColor: c.sunken }]} accessible accessibilityLabel={`${(format ?? grouped)(value)} ${unit}`}>
      <IconChip icon={icon} tint={tint} soft={soft} size={30} />
      <CountUp value={value} format={format ?? grouped}
        style={{ fontFamily: fonts.headingBold, fontSize: 30, lineHeight: 32, color: c.text, fontVariant: ['tabular-nums'] }} />
      <Muted>{unit}</Muted>
    </View>
  );
}

export default function Today() {
  const { c } = useTheme();
  const profile = useProfile();
  const targets = useTargets();
  const programme = useActiveProgramme();
  const weights = useWeightLogs();

  if (profile.isPending || programme.isPending) {
    return <Screen scroll={false}><StateView kind="loading" title="Loading today" /></Screen>;
  }
  if (profile.isError || programme.isError) {
    return (
      <Screen scroll={false}>
        <StateView kind="error" title="Could not load today" message="Your data is still on this phone."
          action={{ label: 'Try again', onPress: () => { void profile.refetch(); void programme.refetch(); } }} />
      </Screen>
    );
  }

  const today = localDateOf(new Date(), profile.data?.timezone ?? undefined);
  const first = weights.data?.[0];
  const latest = weights.data?.[weights.data.length - 1];
  const change = first && latest && first !== latest ? Number(latest.weight_kg) - Number(first.weight_kg) : null;
  const t = targets.data;

  return (
    <Screen>
      <Appear>
        <Eyebrow>{formatLocalDate(today)}</Eyebrow>
        <Title>Hi {profile.data?.display_name ?? 'there'}</Title>
      </Appear>
      <SyncNotice />

      <Appear index={1}><ProgrammeHero programme={programme.data ?? null} today={today} /></Appear>

      {t ? (
        <Appear index={2}>
          <Card>
            <SectionHeader icon="flag-outline" title="Daily targets" />
            <View style={styles.stats}>
              <Stat icon="flame" value={t.kcal_target} unit="kcal" tint={c.accent} soft={c.accentSoft} />
              <Stat icon="fish" value={t.protein_target_g} unit="g protein" tint={c.protein} soft={c.proteinSoft} />
              <Stat icon="water" value={t.water_ml / 1000} format={(n) => (Math.round(n * 10) / 10).toString()} unit="L water" tint={c.water} soft={c.waterSoft} />
              <Stat icon="footsteps" value={t.steps} unit="steps" tint={c.text} soft={c.hairline} />
            </View>
          </Card>
        </Appear>
      ) : null}

      <Appear index={3}>
        <Card>
          <SectionHeader icon="scale-outline" title="Weight" />
          {weights.isPending ? <Muted>Loading…</Muted> : latest ? (
            <View style={styles.weightRow}>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }} accessible accessibilityLabel={`${Number(latest.weight_kg).toFixed(1)} kilograms`}>
                <Num size={52}>{Number(latest.weight_kg).toFixed(1)}</Num>
                <Num size={22} color={c.muted}>kg</Num>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 4 }}>
                <View style={[styles.tag, { backgroundColor: c.accentSoft }]}>
                  <Muted color={c.accent} style={{ fontFamily: fonts.bodySemiBold }}>
                    {change === null ? 'Starting point' : `${change > 0 ? '+' : ''}${change.toFixed(1)} kg since start`}
                  </Muted>
                </View>
                <Muted>{formatLocalDate(latest.date)}</Muted>
              </View>
            </View>
          ) : <Muted>No weigh-in logged yet.</Muted>}
        </Card>
      </Appear>

      <Appear index={4}>
        <View style={[styles.next, { borderColor: c.hairline }]}>
          <Eyebrow>Built next, in phase 2</Eyebrow>
          <Bullet icon="restaurant-outline" tint={c.muted}>Meal slots with quick adds and same-as-yesterday</Bullet>
          <Bullet icon="pulse-outline" tint={c.muted}>Deficit verdict with calorie, protein and water rings</Bullet>
          <Bullet icon="water-outline" tint={c.muted}>Water, steps, badminton, sleep, weight and waist</Bullet>
        </View>
      </Appear>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  stat: { flexGrow: 1, flexBasis: '46%', borderRadius: radius.md, padding: space.md, gap: 6 },
  weightRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: space.md },
  tag: { borderRadius: radius.pill, paddingHorizontal: space.md, paddingVertical: 4 },
  next: { borderWidth: 1.5, borderStyle: 'dashed', borderRadius: radius.lg, padding: space.lg, gap: space.md },
});
