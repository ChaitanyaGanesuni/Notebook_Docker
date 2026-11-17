import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useActiveProgramme, useProfile, useSaveRows, useTargets } from '../../data/DataProvider';
import { useRangeData } from '../../data/dayHooks';
import { usePartner } from '../../data/partnerHooks';
import { useSessions, useTrackChoices } from '../../data/trainingHooks';
import { formatLocalDate, localDateOf, weekDates } from '../../domain/dates';
import { programmeProgress } from '../../domain/programme';
import { demoKey, EXERCISES, TRACKS, type TrackSlug } from '../../domain/training/exercises';
import { estimatedMinutes, resolveRoutine } from '../../domain/training/plan';
import { PartnerCard, type TrainWith } from '../../features/train/PartnerCard';
import { ExerciseFigure } from '../../features/train/ExerciseFigure';
import { Banner, Bullet, Button, Card, Eyebrow, Muted, Screen, SectionHeader, Segmented, StateView, Title } from '../../ui/components';
import { Appear, PressableScale } from '../../ui/motion';
import { fonts, radius, space, useTheme } from '../../ui/theme';

const LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const mmss = (s: number | null) => (s == null ? '–' : `${Math.round(s / 60)} min`);

export default function Train() {
  const { c } = useTheme();
  const profile = useProfile();
  const programme = useActiveProgramme();
  const save = useSaveRows();
  const targetsQ = useTargets();
  const sessions = useSessions();
  const partner = usePartner();
  const [picked, setPicked] = useState<TrackSlug | null>(null);
  const [withWho, setWithWho] = useState<TrainWith>({ kind: 'guest', name: '' });
  const [openSession, setOpenSession] = useState<string | null>(null);

  const track: TrackSlug = picked ?? (profile.data?.default_track ?? 'men');
  const choices = useTrackChoices(track);
  const today = localDateOf(new Date(), profile.data?.timezone ?? undefined);
  const days = weekDates(today);
  const range = useRangeData(days[0]!, days[6]!);

  if (profile.isPending || choices.isPending) return <Screen scroll={false}><StateView kind="loading" title="Loading your training" /></Screen>;
  if (!profile.data) return <Screen scroll={false}><StateView kind="error" title="Finish setup first" /></Screen>;

  const def = TRACKS[track];
  const targets = targetsQ.data?.workouts_per_week ?? 3;
  const build = profile.data.demo_presenter === 'female' ? 'female' : 'male';
  const pr = programme.data ? programmeProgress({ startDate: programme.data.start_date, weeks: programme.data.weeks }, today) : null;
  const week = pr?.status === 'active' ? pr.week : null;
  const routine = resolveRoutine(track, choices.data ?? null, week);
  const trained = new Set<string>([
    ...(sessions.data ?? []).map((s) => s.session.date),
    ...(range.data?.logs ?? []).filter((l) => l.workout_done).map((l) => l.date),
  ]);
  const thisWeek = days.filter((d) => trained.has(d)).length;
  const badmintonToday = range.data?.logs.find((l) => l.date === today)?.badminton ?? false;
  const linkedReady = withWho.kind === 'linked' && !!partner.data?.linked;

  function chooseTrack(t: TrackSlug) {
    setPicked(t);
    // Remember the choice as the default track; it is never locked to profile sex.
    void save([{ table: 'profiles', data: { ...profile.data, default_track: t } }]);
  }
  function start() {
    const q = def.couples ? (linkedReady ? '&partner=linked' : `&partner=guest&guest=${encodeURIComponent(withWho.kind === 'guest' ? withWho.name : '')}`) : '';
    router.push(`/workout?track=${track}${q}`);
  }

  return (
    <Screen>
      <Appear><Eyebrow>{`${def.setsPerMove} sets · ${def.restSeconds} s rest · home, no equipment`}</Eyebrow><Title>Train</Title></Appear>
      <Appear index={1}>
        <Segmented hideLabel label="Workout track" value={track} onChange={chooseTrack}
          options={[{ value: 'men', label: 'Men' }, { value: 'women', label: 'Women' }, { value: 'couples', label: 'Couples' }]} />
      </Appear>

      <Appear index={2}>
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View>
              <Eyebrow>This week</Eyebrow>
              <Text style={{ fontFamily: fonts.headingBold, fontSize: 30, color: c.text }}>{thisWeek} <Text style={{ fontSize: 20, color: c.muted }}>of {targets} workouts</Text></Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 6 }} accessibilityLabel={`Trained on ${thisWeek} days this week`}>
              {days.map((d, i) => (
                <View key={d} style={{ alignItems: 'center', gap: 3 }}>
                  <View style={[styles.dot, { backgroundColor: trained.has(d) ? c.accent : d === today ? c.sunken : c.hairline, borderColor: d === today ? c.accent : 'transparent' }]}>
                    {trained.has(d) ? <Ionicons name="checkmark" size={13} color={c.surface} /> : null}
                  </View>
                  <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 10, color: c.muted }}>{LETTERS[i]}</Text>
                </View>
              ))}
            </View>
          </View>
          {badmintonToday ? <Banner>Badminton is logged today. Strength days work best on non-badminton days, but any day beats none.</Banner> : null}
        </Card>
      </Appear>

      {def.couples ? <Appear index={3}><PartnerCard value={withWho} onChange={setWithWho} /></Appear> : null}

      <Appear index={4}>
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
            <View>
              <Eyebrow>{def.name} track</Eyebrow>
              <Text style={{ fontFamily: fonts.heading, fontSize: 22, color: c.text }}>Today’s workout</Text>
            </View>
            <Muted>about {estimatedMinutes(routine, def.couples)} min</Muted>
          </View>
          {routine.map((m) => (
            <PressableScale key={m.position} onPress={() => router.push(`/exercise/${m.exercise.slug}?track=${track}&position=${m.position}`)} accessibilityRole="button"
              accessibilityLabel={`${m.exercise.name}, ${m.prescription}, ${m.exercise.levels[m.level]}. Open details`} style={[styles.move, { backgroundColor: c.sunken }]}>
              <View style={styles.thumb}><ExerciseFigure demoKey={demoKey(m.exercise, m.level)} build={build} height={58} playing={false} label={m.exercise.name} /></View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={{ fontFamily: fonts.bodySemiBold, fontSize: 15, color: c.text }}>{m.exercise.name}</Text>
                <Muted>{m.exercise.levels.length > 1 ? m.exercise.levels[m.level] : m.exercise.focus}</Muted>
              </View>
              <Text style={{ fontFamily: fonts.heading, fontSize: 17, color: c.text, textAlign: 'right' }}>{m.prescription}</Text>
              <Ionicons name="chevron-forward" size={18} color={c.muted} />
            </PressableScale>
          ))}
          <Button label={def.couples ? (linkedReady ? `Start with ${partner.data!.linked!.partnerName}` : 'Start couples workout') : 'Start workout'} icon="play" onPress={start} />
          <Muted style={{ textAlign: 'center' }}>Tap a move to see the demo, change its difficulty or swap it.</Muted>
        </Card>
      </Appear>

      <Appear index={5}>
        <Card>
          <SectionHeader icon="trending-up" title="How you progress" tint={c.protein} soft={c.proteinSoft} />
          <Bullet>At 15 clean incline push-ups, move your hands lower: chair seat, then floor on knees, then full push-ups.</Bullet>
          <Bullet>Add 5 reps to squats and bridges when 15 feels easy. The app suggests it after a workout you rate easy.</Bullet>
          <Bullet>Plank: 20 seconds in week 1, 5 seconds more each week, up to 40.</Bullet>
          <Muted>Targets come from your own logged sets, not from your profile.</Muted>
        </Card>
      </Appear>

      <Appear index={6}>
        <Card>
          <SectionHeader icon="time-outline" title="History" />
          {sessions.isPending ? <Muted>Loading…</Muted> : (sessions.data ?? []).length === 0 ? (
            <Muted>No workouts yet. Your first one shows up here.</Muted>
          ) : (sessions.data ?? []).slice(0, 10).map(({ session, me, guest, sets }) => (
            <View key={session.id}>
              <PressableScale onPress={() => setOpenSession(openSession === session.id ? null : session.id)} accessibilityRole="button" accessibilityState={{ expanded: openSession === session.id }}
                style={[styles.history, { borderColor: c.hairline }]}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: fonts.bodySemiBold, fontSize: 14.5, color: c.text }}>{formatLocalDate(session.date).slice(0, -5)} · {TRACKS[session.track_slug as TrackSlug]?.name ?? session.track_slug}{guest ? ` with ${guest.guest_name}` : session.couple_group_id ? ' with partner' : ''}</Text>
                  <Muted>{mmss(session.duration_s)}{me?.difficulty ? ` · difficulty ${me.difficulty}/5` : ''}{me?.best_pushup_set != null ? ` · best push-up set ${me.best_pushup_set}` : ''}</Muted>
                </View>
                <Ionicons name={openSession === session.id ? 'chevron-up' : 'chevron-down'} size={18} color={c.muted} />
              </PressableScale>
              {openSession === session.id ? (
                <Animated.View entering={FadeIn.duration(200)} style={{ paddingVertical: space.sm, gap: 4 }}>
                  {[...new Set(sets.map((s) => s.exercise_slug))].map((slug) => {
                    const ss = sets.filter((s) => s.exercise_slug === slug).sort((a, b) => a.set_number - b.set_number);
                    return <Muted key={slug}>{EXERCISES.find((e) => e.slug === slug)?.name ?? slug}: {ss.map((s) => (s.hold_seconds != null ? `${s.hold_seconds}s` : s.reps)).join(' · ')}</Muted>;
                  })}
                </Animated.View>
              ) : null}
            </View>
          ))}
        </Card>
      </Appear>

      <Appear index={7}>
        <Card>
          <SectionHeader icon="library-outline" title="Exercise library" />
          <View style={styles.library}>
            {EXERCISES.map((e) => (
              <PressableScale key={e.slug} onPress={() => router.push(`/exercise/${e.slug}`)} accessibilityRole="button" accessibilityLabel={`${e.name}. Open`}
                style={[styles.libItem, { backgroundColor: c.sunken }]}>
                <ExerciseFigure demoKey={e.demo} build={build} height={64} playing={false} label={e.name} />
                <Text numberOfLines={1} style={{ fontFamily: fonts.bodyMedium, fontSize: 12.5, color: c.text }}>{e.name}</Text>
                {e.pair ? <Text style={{ fontFamily: fonts.body, fontSize: 10.5, color: c.muted }}>Couples</Text> : null}
              </PressableScale>
            ))}
          </View>
        </Card>
      </Appear>
    </Screen>
  );
}

const styles = StyleSheet.create({
  dot: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  move: { flexDirection: 'row', alignItems: 'center', gap: space.md, borderRadius: radius.md, padding: space.sm, paddingRight: space.md },
  thumb: { width: 92 },
  history: { flexDirection: 'row', alignItems: 'center', gap: space.md, borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: space.sm, minHeight: 52 },
  library: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  libItem: { width: '31.5%', flexGrow: 1, borderRadius: radius.md, padding: 6, gap: 4 },
});
