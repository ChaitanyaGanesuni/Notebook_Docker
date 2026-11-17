import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { buildReportData, type DailyReportData, type ReportNarrative, type WeeklyReportData } from '../../../supabase/functions/_shared/reports.ts';
import type { UserHistory } from '../../../supabase/functions/_shared/types.ts';
import { useStoredReports, useWriteReport } from '../../data/coachHooks';
import type { ReportRow } from '../../data/tables';
import { addDays, formatLocalDate } from '../../domain/dates';
import { Banner, Bullet, Button, Card, Eyebrow, Muted, Segmented, SectionHeader } from '../../ui/components';
import { Appear } from '../../ui/motion';
import { fonts, radius, space, useTheme } from '../../ui/theme';

const g = (n: number | null | undefined, unit = '') => (n == null ? '–' : `${Math.round(n).toLocaleString('en-IN')}${unit}`);

function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'good' | 'warn' }) {
  const { c } = useTheme();
  return (
    <View style={[styles.stat, { backgroundColor: c.sunken }]} accessible accessibilityLabel={`${label}: ${value}${sub ? `, ${sub}` : ''}`}>
      <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 11.5, color: c.muted }}>{label}</Text>
      <Text style={{ fontFamily: fonts.headingBold, fontSize: 24, lineHeight: 26, color: tone === 'good' ? c.accent : tone === 'warn' ? c.warning : c.text, fontVariant: ['tabular-nums'] }}>{value}</Text>
      {sub ? <Text style={{ fontFamily: fonts.body, fontSize: 11, color: c.muted }}>{sub}</Text> : null}
    </View>
  );
}

function Narrative({ report, onRegenerate, busy }: { report: ReportRow; onRegenerate: () => void; busy: boolean }) {
  const { c } = useTheme();
  const n = (report.content as { narrative?: ReportNarrative }).narrative;
  if (!n) return null;
  const written = new Date(report.updated_at);
  return (
    <Animated.View entering={FadeIn.duration(400)} style={[styles.narrative, { backgroundColor: c.accentSoft }]}>
      <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'flex-start' }}>
        <Ionicons name="sparkles" size={16} color={c.accent} style={{ marginTop: 3 }} />
        <Text style={{ flex: 1, fontFamily: fonts.heading, fontSize: 19, lineHeight: 23, color: c.text }}>{n.headline}</Text>
      </View>
      {n.went_well.length ? <View style={{ gap: 6 }}><Eyebrow>What went well</Eyebrow>{n.went_well.map((x) => <Bullet key={x}>{x}</Bullet>)}</View> : null}
      {n.improve.length ? <View style={{ gap: 6 }}><Eyebrow>What to improve</Eyebrow>{n.improve.map((x) => <Bullet key={x} icon="arrow-up" tint={c.protein}>{x}</Bullet>)}</View> : null}
      {n.suggestions.length ? <View style={{ gap: 6 }}><Eyebrow>Next</Eyebrow>{n.suggestions.map((x) => <Bullet key={x} icon="arrow-forward" tint={c.water}>{x}</Bullet>)}</View> : null}
      {n.weight_comment ? <Muted>{n.weight_comment}</Muted> : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Muted style={{ fontSize: 11 }}>Written {Number.isNaN(written.getTime()) ? '' : written.toLocaleString([], { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</Muted>
        <Button variant="quiet" icon="refresh" label="Rewrite" loading={busy} onPress={onRegenerate} />
      </View>
    </Animated.View>
  );
}

function WriteBlock({ kind, date, stored }: { kind: 'daily' | 'weekly'; date: string; stored: ReportRow | undefined }) {
  const write = useWriteReport();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function go(force: boolean) {
    setBusy(true);
    setError(null);
    const r = await write(kind, date, force);
    setBusy(false);
    if (!r.ok) setError(r.error === 'network' ? 'Writing a report needs a connection. The numbers above are already up to date.' : r.message);
  }
  return (
    <>
      {stored ? <Narrative report={stored} busy={busy} onRegenerate={() => void go(true)} />
        : <Button icon="sparkles" label={kind === 'daily' ? 'Write the daily report' : 'Write the weekly report'} loading={busy} onPress={() => void go(false)} />}
      {error ? <Banner tone="warning">{error}</Banner> : null}
    </>
  );
}

function Daily({ data, stored }: { data: DailyReportData; stored: ReportRow | undefined }) {
  const f = data.day;
  const t = data.targets;
  return (
    <>
      <View style={styles.grid}>
        <Stat label="Calories (est.)" value={g(f.kcal)} sub={`target ${g(t.kcal)}`} />
        <Stat label="Protein" value={g(f.protein_g, ' g')} sub={`target ${t.protein_g} g`} tone={f.protein_g >= t.protein_g ? 'good' : undefined} />
        <Stat label="Burn (est.)" value={g(f.burn_estimate)} sub={f.verdict ?? 'no verdict'} />
        <Stat label="Fibre" value={g(f.fibre_g, ' g')} sub={`aim ${t.fibre_min_g} g+`} />
        <Stat label="Water" value={f.water_ml == null ? '–' : `${(f.water_ml / 1000).toFixed(1)} L`} sub={`target ${t.water_ml / 1000} L`} tone={(f.water_ml ?? 0) >= t.water_ml ? 'good' : undefined} />
        <Stat label="Steps" value={g(f.steps)} sub={f.steps == null ? 'not logged' : `target ${g(t.steps)}`} />
        <Stat label="Exercise" value={[f.badminton && 'Badminton', f.workout && 'Workout'].filter(Boolean).join(' + ') || 'None'} sub="logged" />
        <Stat label="Weight, 7-day avg" value={data.weight_avg_7d == null ? '–' : `${data.weight_avg_7d} kg`} sub={data.weight_avg_prev_7d == null ? 'measured' : `week before ${data.weight_avg_prev_7d} kg`} />
      </View>
      <Muted>{f.mainMeals} of 3 main meals logged. Day score {f.score} of 6.{f.verdict_note ? ` ${f.verdict_note}` : ''}</Muted>
      <WriteBlock kind="daily" date={data.date} stored={stored} />
    </>
  );
}

function Weekly({ data, stored }: { data: WeeklyReportData; stored: ReportRow | undefined }) {
  const w = data.week;
  const t = data.targets;
  const change = w.weight_change;
  return (
    <>
      <View style={styles.grid}>
        <Stat label="Avg calories (est.)" value={g(w.avg_kcal)} sub={`${w.daysWithMeals} of 7 days logged`} />
        <Stat label="Avg protein" value={g(w.avg_protein_g, ' g')} sub={`target ${t.protein_g} g`} />
        <Stat label="Avg steps" value={g(w.avg_steps)} sub={`${w.daysWithSteps} days logged`} />
        <Stat label="Avg water" value={w.avg_water_ml == null ? '–' : `${(w.avg_water_ml / 1000).toFixed(1)} L`} sub={`target ${t.water_ml / 1000} L`} />
        <Stat label="Workouts" value={`${w.workouts} / ${t.workouts_per_week}`} sub={`${w.badmintonDays} badminton days`} tone={w.workouts >= t.workouts_per_week ? 'good' : undefined} />
        <Stat label="Weight, 7-day avg" value={w.weight_avg == null ? '–' : `${w.weight_avg} kg`}
          sub={change == null ? 'need two weeks of weigh-ins' : `${change > 0 ? '+' : ''}${change} kg vs week before`} tone={change != null && change < 0 ? 'good' : undefined} />
      </View>
      <Muted>Days on target: deficit {w.deficitDays}, protein {w.proteinDays}, water {w.waterDays}, steps {w.stepDays}, junk-free {w.junkFreeDays}, in bed on time {w.bedDays}.</Muted>
      <WriteBlock kind="weekly" date={data.end} stored={stored} />
    </>
  );
}

export function Reports({ history, today }: { history: UserHistory; today: string }) {
  const stored = useStoredReports();
  const [day, setDay] = useState<'today' | 'yesterday'>('today');
  const dailyDate = day === 'today' ? today : addDays(today, -1);
  const weekEnd = addDays(today, -1);
  const daily = buildReportData(history, 'daily', dailyDate) as DailyReportData;
  const weekly = buildReportData(history, 'weekly', weekEnd) as WeeklyReportData;
  const find = (kind: 'daily' | 'weekly', start: string) => stored.data?.find((r) => r.kind === kind && r.period_start === start);

  return (
    <>
      <Appear>
        <Card>
          <SectionHeader icon="today-outline" title="Daily report" />
          <Segmented hideLabel label="Report day" value={day} onChange={setDay} options={[{ value: 'today', label: 'Today' }, { value: 'yesterday', label: 'Yesterday' }]} />
          <Muted>{formatLocalDate(dailyDate)}{day === 'today' ? ' · still in progress' : ''}</Muted>
          <Daily data={daily} stored={find('daily', dailyDate)} />
        </Card>
      </Appear>
      <Appear index={1}>
        <Card>
          <SectionHeader icon="calendar-outline" title="Weekly report" tint={useTheme().c.water} soft={useTheme().c.waterSoft} />
          <Muted>Last 7 complete days · {formatLocalDate(weekly.start).slice(4, -5)} to {formatLocalDate(weekly.end).slice(4)}{weekly.programme_week ? ` · programme week ${weekly.programme_week}` : ''}</Muted>
          <Weekly data={weekly} stored={find('weekly', weekly.start)} />
        </Card>
      </Appear>
      <Muted style={{ textAlign: 'center' }}>Numbers are worked out on your phone from what you logged. The AI only writes the commentary.</Muted>
    </>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  stat: { flexGrow: 1, flexBasis: '46%', borderRadius: radius.md, padding: space.md, gap: 3 },
  narrative: { borderRadius: radius.md, padding: space.lg, gap: space.md },
});
