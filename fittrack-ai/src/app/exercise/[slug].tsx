import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useActiveProgramme, useProfile } from '../../data/DataProvider';
import { useSaveTrackChoices, useTrackChoices } from '../../data/trainingHooks';
import { localDateOf } from '../../domain/dates';
import { programmeProgress } from '../../domain/programme';
import { demoKey, EXERCISE_BY_SLUG, formVideoUrl, swapOptions, type TrackSlug } from '../../domain/training/exercises';
import { defaultChoices, resolveRoutine } from '../../domain/training/plan';
import { ExerciseFigure, type Build } from '../../features/train/ExerciseFigure';
import { Banner, Bullet, Card, Eyebrow, Muted, SectionHeader, Segmented, StateView, Title } from '../../ui/components';
import { PressableScale } from '../../ui/motion';
import { fonts, radius, space, TOUCH, useTheme } from '../../ui/theme';

export default function ExerciseDetail() {
  const { c } = useTheme();
  const params = useLocalSearchParams<{ slug: string; track?: string; position?: string }>();
  const exercise = EXERCISE_BY_SLUG[params.slug ?? ''];
  const track = (params.track === 'men' || params.track === 'women' || params.track === 'couples' ? params.track : null) as TrackSlug | null;
  const position = params.position !== undefined ? Number(params.position) : null;
  const inRoutine = track !== null && position !== null && Number.isInteger(position);
  const profile = useProfile();
  const programme = useActiveProgramme();
  const choices = useTrackChoices(track ?? 'men');
  const saveChoices = useSaveTrackChoices();
  const [preview, setPreview] = useState<Build | null>(null);
  const [error, setError] = useState<string | null>(null);
  const close = () => (router.canGoBack() ? router.back() : router.replace('/train'));

  if (!exercise) return <SafeAreaView style={{ flex: 1, backgroundColor: c.background }}><StateView kind="error" title="Exercise not found" action={{ label: 'Close', onPress: close }} /></SafeAreaView>;

  const build: Build = preview ?? (profile.data?.demo_presenter === 'female' ? 'female' : 'male');
  const today = localDateOf(new Date(), profile.data?.timezone ?? undefined);
  const pr = programme.data ? programmeProgress({ startDate: programme.data.start_date, weeks: programme.data.weeks }, today) : null;
  const week = pr?.status === 'active' ? pr.week : null;
  const current = inRoutine ? (choices.data ?? defaultChoices(track!))[position!] : undefined;
  const routineMove = inRoutine ? resolveRoutine(track!, choices.data ?? null, week)[position!] : undefined;
  const level = current?.slug === exercise.slug ? current.level : exercise.defaultLevel ?? 0;

  async function update(change: { slug?: string; level?: number; target?: number | null }) {
    if (!inRoutine) return;
    const list = [...(choices.data ?? defaultChoices(track!))];
    const prev = list[position!]!;
    const slug = change.slug ?? prev.slug;
    list[position!] = change.slug && change.slug !== prev.slug
      ? { slug, level: EXERCISE_BY_SLUG[slug]!.defaultLevel ?? 0, target: EXERCISE_BY_SLUG[slug]!.target }
      : { ...prev, ...('level' in change ? { level: change.level! } : {}), ...('target' in change ? { target: change.target! } : {}) };
    try {
      await saveChoices(track!, list);
      setError(null);
      if (change.slug && change.slug !== prev.slug) router.setParams({ slug });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save.');
    }
  }

  const adjustable = inRoutine && routineMove && (exercise.kind === 'reps' || exercise.kind === 'reps_per_side' || (exercise.kind === 'timed' && exercise.slug !== 'plank'));
  const step = exercise.kind === 'timed' ? 10 : 5;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.background }} edges={['top', 'bottom']}>
      <View style={styles.head}>
        <PressableScale onPress={close} accessibilityRole="button" accessibilityLabel="Close" style={[styles.round, { backgroundColor: c.sunken }]}>
          <Ionicons name="close" size={22} color={c.text} />
        </PressableScale>
      </View>
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <ExerciseFigure demoKey={demoKey(exercise, level)} build={build} height={230} showTempo label={`${exercise.name} demonstration`} />
        {!exercise.pair ? (
          <Segmented hideLabel label="Demo presenter" value={build} onChange={setPreview} options={[{ value: 'female', label: 'Female presenter' }, { value: 'male', label: 'Male presenter' }]} />
        ) : null}
        <View>
          <Eyebrow>{exercise.focus}</Eyebrow>
          <Title>{exercise.name}</Title>
          {routineMove ? <Text style={{ fontFamily: fonts.heading, fontSize: 22, color: c.accent }}>{routineMove.prescription}</Text> : null}
        </View>
        <PressableScale onPress={() => void Linking.openURL(formVideoUrl(exercise))} accessibilityRole="link" accessibilityLabel={`Watch form videos for ${exercise.name}`}
          style={[styles.video, { backgroundColor: c.surface, borderColor: c.hairline }]}>
          <Ionicons name="logo-youtube" size={22} color="#E53935" />
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: fonts.bodySemiBold, fontSize: 15, color: c.text }}>Watch form video</Text>
            <Muted>Opens a YouTube search. Videos are not stored in the app.</Muted>
          </View>
          <Ionicons name="open-outline" size={18} color={c.muted} />
        </PressableScale>
        <Card>
          <SectionHeader icon="checkmark-done-outline" title="How to do it" />
          {exercise.cues.map((cue) => <Bullet key={cue}>{cue}</Bullet>)}
        </Card>
        <Card>
          <SectionHeader icon="trending-up" title="Progression" tint={c.protein} soft={c.proteinSoft} />
          <Muted style={{ fontSize: 14, lineHeight: 20 }}>{exercise.progression}</Muted>
          {exercise.levels.length > 1 ? (
            <View style={{ gap: 6 }}>
              {exercise.levels.map((l, i) => {
                const on = inRoutine && i === level;
                return (
                  <PressableScale key={l} haptic disabled={!inRoutine} onPress={() => void update({ level: i })} accessibilityRole={inRoutine ? 'radio' : 'text'}
                    accessibilityState={{ selected: on }} style={[styles.level, { backgroundColor: on ? c.accentSoft : c.sunken, borderColor: on ? c.accent : 'transparent' }]}>
                    <Text style={{ fontFamily: fonts.heading, fontSize: 16, color: c.muted, width: 22 }}>{i + 1}</Text>
                    <Text style={{ flex: 1, fontFamily: on ? fonts.bodySemiBold : fonts.body, fontSize: 14.5, color: c.text }}>{l}</Text>
                    {on ? <Ionicons name="checkmark-circle" size={20} color={c.accent} /> : null}
                  </PressableScale>
                );
              })}
              {inRoutine ? <Muted>Pick any level. It is not tied to your profile.</Muted> : null}
            </View>
          ) : null}
        </Card>
        {adjustable && routineMove ? (
          <Card style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: fonts.bodySemiBold, fontSize: 15, color: c.text }}>Target per set</Text>
              <Muted>{exercise.kind === 'timed' ? 'Seconds held' : `Reps${exercise.per ? ` ${exercise.per}` : ''}`}</Muted>
            </View>
            <PressableScale haptic onPress={() => void update({ target: Math.max(step, (routineMove.target ?? 0) - step) })} accessibilityRole="button" accessibilityLabel="Lower target" style={[styles.round, { backgroundColor: c.sunken }]}>
              <Ionicons name="remove" size={22} color={c.text} />
            </PressableScale>
            <Text style={{ fontFamily: fonts.headingBold, fontSize: 28, minWidth: 44, textAlign: 'center', color: c.text }}>{routineMove.target}</Text>
            <PressableScale haptic onPress={() => void update({ target: Math.min(exercise.kind === 'timed' ? 180 : 60, (routineMove.target ?? 0) + step) })} accessibilityRole="button" accessibilityLabel="Raise target" style={[styles.round, { backgroundColor: c.sunken }]}>
              <Ionicons name="add" size={22} color={c.text} />
            </PressableScale>
          </Card>
        ) : null}
        {exercise.slug === 'plank' && routineMove ? <Muted>Plank time follows the programme week: {routineMove.target} seconds this week.</Muted> : null}
        {inRoutine ? (
          <Card>
            <SectionHeader icon="swap-horizontal" title="Swap this move" />
            {swapOptions(exercise.slug).map((e) => (
              <PressableScale key={e.slug} haptic onPress={() => void update({ slug: e.slug })} accessibilityRole="button" accessibilityLabel={`Swap for ${e.name}`}
                style={[styles.swap, { borderColor: c.hairline }]}>
                <View style={{ width: 84 }}><ExerciseFigure demoKey={e.demo} build={build} height={54} playing={false} label={e.name} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: fonts.bodySemiBold, fontSize: 14.5, color: c.text }}>{e.name}</Text>
                  <Muted>{e.focus}</Muted>
                </View>
              </PressableScale>
            ))}
          </Card>
        ) : null}
        {error ? <Banner tone="warning">{error}</Banner> : null}
        <Muted style={{ textAlign: 'center' }}>Demo: illustrated figure drawn by the app. No licensed demo video is bundled yet.</Muted>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: space.lg, paddingTop: space.sm, width: '100%', maxWidth: 560, alignSelf: 'center' },
  body: { padding: space.lg, paddingTop: space.sm, gap: space.lg, paddingBottom: space.xxl, width: '100%', maxWidth: 560, alignSelf: 'center' },
  round: { width: TOUCH, height: TOUCH, borderRadius: TOUCH / 2, alignItems: 'center', justifyContent: 'center' },
  video: { flexDirection: 'row', alignItems: 'center', gap: space.md, borderWidth: 1, borderRadius: radius.md, padding: space.md, minHeight: TOUCH + 12 },
  level: { flexDirection: 'row', alignItems: 'center', gap: space.sm, borderRadius: radius.md, borderWidth: 1.5, paddingHorizontal: space.md, minHeight: TOUCH },
  swap: { flexDirection: 'row', alignItems: 'center', gap: space.md, borderWidth: 1, borderRadius: radius.md, padding: space.sm },
});
