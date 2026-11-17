import Ionicons from '@expo/vector-icons/Ionicons';
import { useAudioPlayer } from 'expo-audio';
import * as Crypto from 'expo-crypto';
import * as Haptics from 'expo-haptics';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useReducer, useRef, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeInUp } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useActiveProgramme, useProfile } from '../data/DataProvider';
import { usePartner } from '../data/partnerHooks';
import { useSaveTrackChoices, useSaveWorkout, useSessions, useTrackChoices } from '../data/trainingHooks';
import { localDateOf } from '../domain/dates';
import { demoKey, TRACKS, type TrackSlug } from '../domain/training/exercises';
import { defaultChoices, resolveRoutine, type MoveChoice, type RoutineMove } from '../domain/training/plan';
import { initialState, makeReducer, remainingMs, setsDone, totalSets, type Who } from '../domain/training/player';
import type { PartnerState } from '../data/partnerHooks';
import { programmeProgress } from '../domain/programme';
import { applySuggestions, suggestProgressions } from '../domain/training/progression';
import { PUSH_UP_SLUGS } from '../domain/training/sessionRows';
import { Countdown } from '../features/train/Countdown';
import { ExerciseFigure } from '../features/train/ExerciseFigure';
import { Banner, Body, Bullet, Button, Card, Eyebrow, Heading, Muted, StateView, Title } from '../ui/components';
import { PressableScale } from '../ui/motion';
import { fonts, radius, space, TOUCH, useTheme } from '../ui/theme';

const CHIME = require('../../assets/sounds/chime.wav');

function Stepper({ value, onChange, label }: { value: number; onChange: (n: number) => void; label: string }) {
  const { c } = useTheme();
  const btn = (delta: number, icon: 'remove' | 'add') => (
    <PressableScale haptic onPress={() => onChange(Math.max(0, Math.min(200, value + delta)))} accessibilityRole="button"
      accessibilityLabel={`${delta > 0 ? 'More' : 'Fewer'} reps`} style={[styles.stepBtn, { backgroundColor: c.sunken }]}>
      <Ionicons name={icon} size={26} color={c.text} />
    </PressableScale>
  );
  return (
    <View style={{ alignItems: 'center', gap: 4 }}>
      <Muted>{label}</Muted>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.lg }} accessible accessibilityRole="adjustable" accessibilityLabel={`${label}: ${value}`}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(e) => onChange(Math.max(0, value + (e.nativeEvent.actionName === 'increment' ? 1 : -1)))}>
        {btn(-1, 'remove')}
        <Text style={{ fontFamily: fonts.headingBold, fontSize: 56, lineHeight: 60, minWidth: 80, textAlign: 'center', color: c.text, fontVariant: ['tabular-nums'] }}>{value}</Text>
        {btn(1, 'add')}
      </View>
    </View>
  );
}

function Rating({ value, onChange, who }: { value: number | null; onChange: (n: number) => void; who: string }) {
  const { c } = useTheme();
  const words = ['', 'Very easy', 'Easy', 'Just right', 'Hard', 'Very hard'];
  return (
    <View style={{ gap: space.sm }}>
      <Body style={{ fontFamily: fonts.bodySemiBold }}>How hard was it{who ? ` for ${who}` : ''}?</Body>
      <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', gap: space.sm }}>
        {[1, 2, 3, 4, 5].map((n) => {
          const on = value === n;
          return (
            <PressableScale key={n} haptic onPress={() => onChange(n)} accessibilityRole="radio" accessibilityState={{ selected: on }} accessibilityLabel={`${n}, ${words[n]}`}
              style={[styles.rate, { backgroundColor: on ? c.primary : c.sunken }]}>
              <Text style={{ fontFamily: fonts.headingBold, fontSize: 22, color: on ? c.onPrimary : c.text }}>{n}</Text>
            </PressableScale>
          );
        })}
      </View>
      <Muted>{value ? words[value] : '1 very easy · 5 very hard'}</Muted>
    </View>
  );
}

export default function Workout() {
  const { c } = useTheme();
  const params = useLocalSearchParams<{ track?: string; partner?: string; guest?: string }>();
  const track: TrackSlug = params.track === 'women' || params.track === 'couples' ? params.track : 'men';
  const profile = useProfile();
  const programme = useActiveProgramme();
  const choices = useTrackChoices(track);
  const partner = usePartner();
  const sessions = useSessions();

  // The player starts only once the user's own routine has loaded, so its steps match it.
  if (choices.isPending || profile.isPending || programme.isPending || sessions.isPending || (params.partner === 'linked' && partner.isPending)) {
    return <SafeAreaView style={{ flex: 1, backgroundColor: c.background }}><StateView kind="loading" title="Getting your workout ready" /></SafeAreaView>;
  }
  const today = localDateOf(new Date(), profile.data?.timezone ?? undefined);
  const pr = programme.data ? programmeProgress({ startDate: programme.data.start_date, weeks: programme.data.weeks }, today) : null;
  const week = pr?.status === 'active' ? pr.week : pr?.status === 'finished' ? 99 : null;
  const routine = resolveRoutine(track, choices.data ?? null, week);
  const bests: Record<string, number> = {};
  for (const x of (sessions.data ?? []).flatMap((ss) => ss.sets)) {
    if (x.reps != null) bests[x.exercise_slug] = Math.max(bests[x.exercise_slug] ?? 0, Number(x.reps));
  }
  return (
    <Player track={track} routine={routine} choices={choices.data ?? null} week={week} today={today} bests={bests}
      build={profile.data?.demo_presenter === 'female' ? 'female' : 'male'}
      linked={TRACKS[track].couples && params.partner === 'linked' ? partner.data?.linked ?? null : null}
      guestName={TRACKS[track].couples && params.partner !== 'linked' ? (params.guest?.trim() || 'Guest') : null} />
  );
}

function Player({ track, routine, choices, week, today, bests, build, linked, guestName }: {
  track: TrackSlug; routine: RoutineMove[]; choices: MoveChoice[] | null; week: number | null; today: string;
  bests: Record<string, number>; build: 'male' | 'female'; linked: PartnerState['linked']; guestName: string | null;
}) {
  const { c } = useTheme();
  const def = TRACKS[track];
  const saveWorkout = useSaveWorkout();
  const saveChoices = useSaveTrackChoices();
  const partnerName = linked?.partnerName ?? guestName ?? '';
  const [reducer] = useState(() => makeReducer(routine, def.couples));
  const [state, dispatch] = useReducer(reducer, null, () => initialState(routine, def.couples));
  const [now, setNow] = useState(() => Date.now());
  // Reps typed per step, so going back and forth never loses a number.
  const [repsByStep, setRepsByStep] = useState<Record<number, Partial<Record<Who, number>>>>({});
  const [ratings, setRatings] = useState<Partial<Record<Who, number>>>({});
  const [applyProgress, setApplyProgress] = useState(true);
  const [confirmExit, setConfirmExit] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const chime = useAudioPlayer(CHIME);
  const fired = useRef<number | null>(null);

  // Keep the screen awake for the whole session.
  useEffect(() => {
    void activateKeepAwakeAsync('workout').catch(() => undefined);
    return () => { void Promise.resolve(deactivateKeepAwake('workout')).catch(() => undefined); };
  }, []);

  // Tick while the session runs (timers and the elapsed clock); at zero, chime, buzz and move on.
  useEffect(() => {
    if (state.phase === 'ready' || state.phase === 'done') return;
    const id = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(id);
  }, [state.phase]);
  useEffect(() => {
    if ((state.phase === 'rest' || state.phase === 'hold') && state.endsAt !== null && now >= state.endsAt && fired.current !== state.endsAt) {
      fired.current = state.endsAt;
      try { void chime.seekTo(0); chime.play(); } catch { /* sound is a nicety */ }
      if (Platform.OS !== 'web') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      dispatch(state.phase === 'rest' ? { type: 'restDone', now } : { type: 'holdDone', now });
    }
  }, [now, state.phase, state.endsAt, chime]);

  const step = state.steps[state.index];
  const move = step ? routine[step.move] : undefined;
  const lastBest = move ? bests[move.exercise.slug] ?? null : null;
  // Rep stepper defaults: this session's previous set, else the best on record, else 8.
  const previousSet = (who: Who) => [...state.results].reverse().find((r) => r.who === who && r.slug === move?.exercise.slug)?.reps ?? null;
  const reps: Partial<Record<Who, number>> = {
    me: repsByStep[state.index]?.me ?? previousSet('me') ?? lastBest ?? 8,
    partner: repsByStep[state.index]?.partner ?? previousSet('partner') ?? 8,
  };
  const setReps = (who: Who, n: number) => setRepsByStep((r) => ({ ...r, [state.index]: { ...reps, ...r[state.index], [who]: n } }));

  const done = setsDone(state);
  const total = totalSets(routine);
  const elapsed = state.startedAt ? Math.max(0, Math.round(((state.finishedAt ?? now) - state.startedAt) / 1000)) : 0;
  const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  const close = () => (router.canGoBack() ? router.back() : router.replace('/train'));
  const turnName = (t: Who | 'both') => (t === 'both' ? 'Together' : t === 'me' ? 'Your turn' : `${partnerName}’s turn`);

  const suggestions = state.phase === 'done' ? suggestProgressions(routine, state.results, 'me', ratings.me ?? null) : [];

  async function save() {
    if (!state.startedAt) return close();
    setSaving(true);
    setSaveError(null);
    try {
      await saveWorkout({
        date: today, track, programmeWeek: week, startedAt: state.startedAt, finishedAt: state.finishedAt ?? now, results: state.results,
        difficulty: ratings.me ?? null, newId: () => Crypto.randomUUID(),
        partner: !def.couples ? null : linked ? { kind: 'linked', userId: linked.partnerId, name: linked.partnerName, difficulty: ratings.partner ?? null }
          : { kind: 'guest', name: guestName ?? 'Guest', difficulty: ratings.partner ?? null },
      });
      if (applyProgress && suggestions.length) await saveChoices(track, applySuggestions(choices ?? defaultChoices(track), suggestions));
      close();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Could not save the workout.');
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.background }} edges={['top', 'bottom']}>
      <View style={styles.top}>
        <PressableScale onPress={() => (state.phase === 'ready' || state.phase === 'done' ? close() : setConfirmExit(true))} accessibilityRole="button"
          accessibilityLabel="Close workout" style={[styles.close, { backgroundColor: c.sunken }]}>
          <Ionicons name="close" size={22} color={c.text} />
        </PressableScale>
        <View style={{ flex: 1, gap: 6 }}>
          <View style={styles.bar} accessibilityRole="progressbar" accessibilityLabel={`${done} of ${total} sets done`} accessibilityValue={{ min: 0, max: total, now: done }}>
            {Array.from({ length: total }, (_, i) => (
              <View key={i} style={[styles.barSeg, { backgroundColor: i < done ? c.accent : c.hairline }]} />
            ))}
          </View>
          <Muted style={{ fontSize: 12 }}>{done} of {total} sets{state.startedAt ? ` · ${mmss(elapsed)}` : ''}</Muted>
        </View>
      </View>
      {confirmExit ? (
        <View style={{ paddingHorizontal: space.lg }}>
          <Banner tone="warning" action={{ label: 'End', onPress: close }}>End this workout? Sets so far will not be saved.</Banner>
          <Button variant="quiet" label="Keep going" onPress={() => setConfirmExit(false)} />
        </View>
      ) : null}

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        {state.phase === 'ready' ? (
          <Animated.View entering={FadeIn.duration(300)} style={{ gap: space.lg }}>
            <View><Eyebrow>{def.name} track{partnerName ? ` · with ${partnerName}` : ''}</Eyebrow><Title>Ready?</Title></View>
            <Body color={c.muted}>{def.description}</Body>
            <Card>
              {routine.map((m, i) => (
                <View key={i} style={styles.readyRow}>
                  <Text style={{ fontFamily: fonts.heading, fontSize: 18, width: 22, color: c.muted }}>{i + 1}</Text>
                  <Body style={{ flex: 1, fontFamily: fonts.bodyMedium }}>{m.exercise.name}</Body>
                  <Text style={{ fontFamily: fonts.heading, fontSize: 17, color: c.text }}>{m.prescription}</Text>
                </View>
              ))}
              <Muted>{def.couples ? 'Turn-taking moves have no rest timer: you rest while your partner works.' : `${def.restSeconds} seconds rest between sets.`}</Muted>
            </Card>
            <Button label="Start" icon="play" onPress={() => dispatch({ type: 'start', now: Date.now() })} />
          </Animated.View>
        ) : null}

        {(state.phase === 'work' || state.phase === 'hold') && step && move ? (
          <Animated.View key={state.index} entering={FadeInUp.duration(280)} style={{ gap: space.md }}>
            <ExerciseFigure demoKey={demoKey(move.exercise, move.level)} build={build} height={210} showTempo label={`${move.exercise.name} demonstration`} />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
              <View style={{ flex: 1 }}>
                <Eyebrow>Move {step.move + 1} of {routine.length} · Set {step.set} of {move.sets}</Eyebrow>
                <Title style={{ fontSize: 32, lineHeight: 34 }}>{move.exercise.name}</Title>
                <Muted>{move.exercise.levels.length > 1 ? move.exercise.levels[move.level] : move.exercise.focus}</Muted>
              </View>
              {def.couples ? (
                <View style={[styles.turn, { backgroundColor: step.turn === 'partner' ? c.proteinSoft : c.accentSoft }]}>
                  <Text style={{ fontFamily: fonts.bodySemiBold, fontSize: 13, color: step.turn === 'partner' ? c.protein : c.accent }}>{turnName(step.turn)}</Text>
                </View>
              ) : null}
            </View>

            {state.phase === 'hold' ? (
              <View style={{ alignItems: 'center', gap: space.md }}>
                <Countdown endsAt={state.endsAt} totalMs={(move.target ?? 30) * 1000} remainingMs={remainingMs(state, now)} label="Hold" color={c.accent} />
                <Button variant="secondary" label="Stop early" icon="stop" onPress={() => dispatch({ type: 'holdDone', now: Date.now() })} />
              </View>
            ) : move.exercise.kind === 'max_reps' ? (
              <View style={{ gap: space.md }}>
                <Stepper label={step.turn === 'partner' ? `${partnerName}’s clean reps` : 'Clean reps'} value={reps[step.turn === 'partner' ? 'partner' : 'me'] ?? 8}
                  onChange={(n) => setReps(step.turn === 'partner' ? 'partner' : 'me', n)} />
                {lastBest !== null && step.turn !== 'partner' ? <Muted style={{ textAlign: 'center' }}>Your best set so far: {lastBest}</Muted> : null}
                <Button label="Set done" icon="checkmark" onPress={() => dispatch({ type: 'setDone', now: Date.now(), reps })} />
              </View>
            ) : (
              <View style={{ gap: space.md }}>
                <View style={{ alignItems: 'center' }}>
                  <Text style={{ fontFamily: fonts.headingBold, fontSize: 64, lineHeight: 66, color: c.text, fontVariant: ['tabular-nums'] }}>{move.target}</Text>
                  <Muted>{move.exercise.kind === 'timed' ? 'second hold' : move.exercise.per ? `reps ${move.exercise.per}` : 'reps'}</Muted>
                </View>
                {move.exercise.kind === 'timed'
                  ? <Button label="Start hold" icon="timer-outline" onPress={() => dispatch({ type: 'startHold', now: Date.now() })} />
                  : <Button label="Set done" icon="checkmark" onPress={() => dispatch({ type: 'setDone', now: Date.now() })} />}
              </View>
            )}
            <Card style={{ gap: 8 }}>{move.exercise.cues.map((cue) => <Bullet key={cue}>{cue}</Bullet>)}</Card>
          </Animated.View>
        ) : null}

        {state.phase === 'rest' && step ? (
          <Animated.View entering={FadeIn.duration(250)} style={{ alignItems: 'center', gap: space.lg }}>
            <Countdown endsAt={state.endsAt} totalMs={(routine[step.move]?.restSeconds ?? 60) * 1000} remainingMs={remainingMs(state, now)} label="Rest" color={c.water} />
            {(() => {
              const next = state.steps[state.index + 1];
              const nm = next ? routine[next.move] : undefined;
              return nm && next ? (
                <Card style={{ width: '100%', flexDirection: 'row', alignItems: 'center', gap: space.md }}>
                  <View style={{ width: 120 }}><ExerciseFigure demoKey={demoKey(nm.exercise, nm.level)} build={build} height={80} playing={false} /></View>
                  <View style={{ flex: 1 }}>
                    <Eyebrow>Next up</Eyebrow>
                    <Heading>{nm.exercise.name}</Heading>
                    <Muted>Set {next.set} of {nm.sets} · {nm.prescription.replace(/^\d+ × /, '')}</Muted>
                  </View>
                </Card>
              ) : null;
            })()}
            <Button variant="secondary" label="Skip rest" icon="play-skip-forward" onPress={() => dispatch({ type: 'restDone', now: Date.now() })} />
          </Animated.View>
        ) : null}

        {state.phase === 'done' ? (
          <Animated.View entering={FadeInDown.duration(350)} style={{ gap: space.lg }}>
            <View style={{ alignItems: 'center', gap: space.sm }}>
              <View style={[styles.trophy, { backgroundColor: c.accentSoft }]}><Ionicons name="trophy" size={34} color={c.accent} /></View>
              <Title>Workout done</Title>
              <Muted>{done} of {total} sets · {mmss(elapsed)}</Muted>
            </View>
            <Card>
              <Rating who={def.couples ? 'you' : ''} value={ratings.me ?? null} onChange={(n) => setRatings((r) => ({ ...r, me: n }))} />
              {def.couples ? <Rating who={partnerName} value={ratings.partner ?? null} onChange={(n) => setRatings((r) => ({ ...r, partner: n }))} /> : null}
            </Card>
            {(() => {
              const best = state.results.filter((r) => r.who === 'me' && PUSH_UP_SLUGS.includes(r.slug) && r.reps !== null).map((r) => r.reps as number);
              return best.length ? <Muted style={{ textAlign: 'center' }}>Best push-up set today: {Math.max(...best)}</Muted> : null;
            })()}
            {suggestions.length ? (
              <Card>
                <Heading>Progression</Heading>
                {suggestions.map((s) => <Bullet key={`${s.position}-${s.kind}`} icon="trending-up">{s.message}</Bullet>)}
                <PressableScale haptic onPress={() => setApplyProgress((v) => !v)} accessibilityRole="checkbox" accessibilityState={{ checked: applyProgress }}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: TOUCH }}>
                  <Ionicons name={applyProgress ? 'checkbox' : 'square-outline'} size={22} color={c.accent} />
                  <Body>Update my routine for next time</Body>
                </PressableScale>
              </Card>
            ) : null}
            {saveError ? <Banner tone="warning">{saveError}</Banner> : null}
            <Button label="Save workout" icon="checkmark" loading={saving} onPress={() => void save()} />
            <Muted style={{ textAlign: 'center' }}>{linked ? `Saved to your account and ${linked.partnerName}’s, each with your own reps and rating.` : guestName ? `Saved to your account only. ${guestName}’s sets are kept with it.` : 'Saves on this phone now and syncs when online.'}</Muted>
          </Animated.View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.sm, width: '100%', maxWidth: 560, alignSelf: 'center' },
  close: { width: TOUCH, height: TOUCH, borderRadius: TOUCH / 2, alignItems: 'center', justifyContent: 'center' },
  bar: { flexDirection: 'row', gap: 3 },
  barSeg: { flex: 1, height: 7, borderRadius: 4 },
  body: { padding: space.lg, gap: space.lg, paddingBottom: space.xxl, width: '100%', maxWidth: 560, alignSelf: 'center' },
  readyRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 36 },
  turn: { borderRadius: radius.pill, paddingHorizontal: space.md, paddingVertical: 6 },
  stepBtn: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  rate: { flex: 1, height: 52, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  trophy: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center' },
});
