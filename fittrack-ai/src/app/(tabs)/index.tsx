import { StyleSheet, Text, View } from 'react-native';
import { useActiveProgramme, useProfile, useTargets, useWeightLogs } from '../../data/DataProvider';
import { SyncNotice } from '../../features/SyncNotice';
import { formatLocalDate, localDateOf } from '../../domain/dates';
import { daysUntil, programmeProgress } from '../../domain/programme';
import { Card, Heading, Muted, Num, Row, Screen, StateView, Title } from '../../ui/components';
import { fonts, hero, radius, space, useTheme } from '../../ui/theme';

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

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
  const p = programme.data;
  const progress = p ? programmeProgress({ startDate: p.start_date, weeks: p.weeks }, today) : null;
  const toCheckpoint = p?.checkpoint_date ? daysUntil(p.checkpoint_date, today) : null;
  const latestWeight = weights.data?.[weights.data.length - 1];
  const t = targets.data;

  return (
    <Screen>
      <View>
        <Muted>{formatLocalDate(today)}</Muted>
        <Title>Hi {profile.data?.display_name ?? 'there'}</Title>
      </View>
      <SyncNotice />

      <View style={[styles.hero, { backgroundColor: c.court }]} accessible
        accessibilityLabel={progress?.status === 'active' ? `Week ${progress.week} of ${progress.totalWeeks}, day ${progress.day} of ${progress.totalDays}` : 'Programme'}>
        {/* faint badminton-court markings */}
        <View pointerEvents="none" style={[styles.courtLine, { left: '50%', top: 0, bottom: 0, width: 1 }]} />
        <View pointerEvents="none" style={[styles.courtLine, { left: 0, right: 0, top: '32%', height: 1 }]} />
        <View pointerEvents="none" style={[styles.courtBorder]} />
        {!p || !progress ? (
          <Text style={styles.heroBody}>No programme set. Add one from the Plan tab.</Text>
        ) : progress.status === 'active' ? (
          <>
            <Text style={styles.heroLabel}>{p.name || 'Programme'}</Text>
            <Text style={styles.heroNumber}>WEEK {progress.week} <Text style={styles.heroOf}>OF {progress.totalWeeks}</Text></Text>
            <Text style={styles.heroBody}>Day {progress.day} of {progress.totalDays}</Text>
          </>
        ) : progress.status === 'upcoming' ? (
          <>
            <Text style={styles.heroLabel}>{p.name || 'Programme'}</Text>
            <Text style={styles.heroNumber}>STARTS IN {progress.daysToStart}</Text>
            <Text style={styles.heroBody}>{plural(progress.daysToStart, 'day')} to go, starting {formatLocalDate(p.start_date)}</Text>
          </>
        ) : (
          <>
            <Text style={styles.heroLabel}>{p.name || 'Programme'}</Text>
            <Text style={styles.heroNumber}>COMPLETE</Text>
            <Text style={styles.heroBody}>All {progress.totalWeeks} weeks done</Text>
          </>
        )}
        {p?.checkpoint_date && toCheckpoint !== null ? (
          <Text style={styles.heroFoot}>
            {toCheckpoint > 0 ? `${plural(toCheckpoint, 'day')} to the ${formatLocalDate(p.checkpoint_date)} checkpoint`
              : toCheckpoint === 0 ? 'Checkpoint day' : `Checkpoint was ${formatLocalDate(p.checkpoint_date)}`}
          </Text>
        ) : null}
      </View>

      {t ? (
        <Card>
          <Heading>Daily targets</Heading>
          <View style={styles.stats}>
            <View style={styles.stat}><Num>{t.kcal_target.toLocaleString('en-IN')}</Num><Muted>kcal</Muted></View>
            <View style={styles.stat}><Num color={c.protein}>{t.protein_target_g}</Num><Muted>g protein</Muted></View>
            <View style={styles.stat}><Num color={c.water}>{t.water_ml / 1000}</Num><Muted>L water</Muted></View>
            <View style={styles.stat}><Num>{t.steps.toLocaleString('en-IN')}</Num><Muted>steps</Muted></View>
          </View>
        </Card>
      ) : null}

      <Card>
        <Heading>Weight</Heading>
        {weights.isPending ? <Muted>Loading…</Muted>
          : latestWeight ? <Row label={`Latest, ${formatLocalDate(latestWeight.date)}`} value={`${Number(latestWeight.weight_kg).toFixed(1)} kg`} />
          : <Muted>No weigh-in logged yet.</Muted>}
      </Card>

      <Card>
        <Heading>Meals and daily logging</Heading>
        <Muted>Meal slots, the deficit verdict, water, steps and the rest of the day&apos;s logging are built in phase 2.</Muted>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { borderRadius: radius.lg, padding: space.xl, gap: space.xs, overflow: 'hidden' },
  courtLine: { position: 'absolute', backgroundColor: hero.line },
  courtBorder: { position: 'absolute', left: 10, right: 10, top: 10, bottom: 10, borderWidth: 1, borderColor: hero.line, borderRadius: radius.md },
  heroLabel: { fontFamily: fonts.bodyMedium, fontSize: 13, color: hero.textMuted },
  heroNumber: { fontFamily: fonts.headingBold, fontSize: 48, lineHeight: 52, color: hero.text, fontVariant: ['tabular-nums'] },
  heroOf: { fontFamily: fonts.heading, fontSize: 28, color: hero.textMuted },
  heroBody: { fontFamily: fonts.heading, fontSize: 20, color: hero.text, fontVariant: ['tabular-nums'] },
  heroFoot: { fontFamily: fonts.body, fontSize: 13, color: hero.textMuted, marginTop: space.sm },
  stats: { flexDirection: 'row', flexWrap: 'wrap', rowGap: space.md },
  stat: { width: '50%' },
});
