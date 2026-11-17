import * as Crypto from 'expo-crypto';
import * as Network from 'expo-network';
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { differsFromEstimate, localPhotoKey, PHOTO_PLACEHOLDER, retryEstimate } from '../../ai/estimateQueue';
import { useEstimateNotices } from '../../ai/notices';
import { keepPhoto } from '../../ai/photos';
import { useActiveProgramme, useData, useProfile, useSaveRows, useTargets, useWeightLogs } from '../../data/DataProvider';
import { useDayActions, useRangeData, useSavedMeals, useSlotSources, type MealDraft } from '../../data/dayHooks';
import type { MealEntryRow } from '../../data/tables';
import { addDays, formatLocalDate, localDateOf, weekDates } from '../../domain/dates';
import { summariseDay } from '../../domain/day';
import { chai, nextSource, plannedChaiSugar, SLOTS, WHEY_SCOOP, type Slot } from '../../domain/meals';
import { programmeProgress } from '../../domain/programme';
import { SyncNotice } from '../../features/SyncNotice';
import { DayLogging } from '../../features/today/DayLogging';
import { EntryEditor, type EditorTarget } from '../../features/today/EntryEditor';
import { HeroCard } from '../../features/today/HeroCard';
import { MealSlot } from '../../features/today/MealSlot';
import { WeekStrip } from '../../features/today/WeekStrip';
import { Banner, Button, Eyebrow, Screen, StateView, Title } from '../../ui/components';
import { Appear } from '../../ui/motion';

const EMPTY_DRAFT: MealDraft = { name: '', kcal: null, protein_g: null, carbs_g: null, fat_g: null, fibre_g: null, junk: false };

export default function Today() {
  const profile = useProfile();
  const targets = useTargets();
  const programme = useActiveProgramme();
  const weights = useWeightLogs();
  const saved = useSavedMeals();
  const { sources, setSource } = useSlotSources();
  const { store, engine } = useData();
  const save = useSaveRows();
  const notices = useEstimateNotices();

  const today = localDateOf(new Date(), profile.data?.timezone ?? undefined);
  const [picked, setPicked] = useState<string | null>(null);
  const date = picked && picked <= today ? picked : today;
  const week = weekDates(date);
  const yesterday = addDays(date, -1);
  const range = useRangeData(addDays(week[0]!, -1), week[6]!);

  const log = range.data?.logs.find((l) => l.date === date) ?? null;
  const actions = useDayActions(date, log);
  const [editor, setEditor] = useState<(EditorTarget & { entry: MealEntryRow | null; entryId?: string }) | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  async function estimate(slot: Slot, text: string, photoUri: string | null) {
    const id = Crypto.randomUUID();
    if (photoUri && store) await store.setMeta(localPhotoKey(id), await keepPhoto(id, photoUri));
    await actions.addPendingMeal(id, slot, sources[slot], text, PHOTO_PLACEHOLDER);
    // With no connection, open the editor so numbers can be typed now; the estimate still runs later.
    const net = await Network.getNetworkStateAsync().catch(() => null);
    if (net && net.isConnected === false) {
      setEditor({ slot, source: sources[slot], existing: true, estimating: true, entry: null, entryId: id, draft: { ...EMPTY_DRAFT, name: text || PHOTO_PLACEHOLDER, text } });
    }
  }
  const run = (p: Promise<void>) => { p.then(() => setActionError(null)).catch((e: unknown) => setActionError(e instanceof Error ? e.message : 'Could not save.')); };

  const summaries = useMemo(() => {
    if (!profile.data || !targets.data || !range.data) return null;
    const out: Record<string, ReturnType<typeof summariseDay>> = {};
    for (const d of week) {
      if (d > today) continue;
      out[d] = summariseDay({
        date: d, today, profile: profile.data, targets: targets.data,
        log: range.data.logs.find((l) => l.date === d) ?? null,
        meals: range.data.meals.filter((m) => m.date === d),
        weights: weights.data ?? [],
      });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `week` is derived from `date`
  }, [profile.data, targets.data, range.data, weights.data, date, today]);

  if (profile.isPending || targets.isPending || range.isPending || weights.isPending) {
    return <Screen scroll={false}><StateView kind="loading" title="Loading your day" /></Screen>;
  }
  const summary = summaries?.[date];
  if (profile.isError || targets.isError || range.isError || !profile.data || !targets.data || !range.data || !summary) {
    return (
      <Screen scroll={false}>
        <StateView kind="error" title="Could not load this day" message="Your data is still on this phone."
          action={{ label: 'Try again', onPress: () => { void profile.refetch(); void targets.refetch(); void range.refetch(); } }} />
      </Screen>
    );
  }

  const isToday = date === today;
  const meals = range.data.meals.filter((m) => m.date === date);
  const yesterdayMeals = range.data.meals.filter((m) => m.date === yesterday);
  const p = programme.data ? programmeProgress({ startDate: programme.data.start_date, weeks: programme.data.weeks }, date) : null;
  const chaiSugar = log?.chai_sugar ?? plannedChaiSugar(p?.status === 'active' ? p.week : p?.status === 'finished' ? 99 : null);
  const weightToday = weights.data?.find((w) => w.date === date)?.weight_kg ?? null;
  const measurement = range.data.measurements.find((m) => m.date === date) ?? null;
  const scores = Object.fromEntries(Object.entries(summaries ?? {}).map(([d, s]) => [d, s.score]));
  const savedMeals = saved.data ?? [];

  return (
    <Screen>
      <Appear style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <View>
          <Eyebrow>{isToday ? `Hi ${profile.data.display_name}` : 'History'}</Eyebrow>
          <Title>{isToday ? 'Today' : formatLocalDate(date).slice(0, -5)}</Title>
        </View>
        {!isToday ? <Button variant="secondary" label="Back to today" onPress={() => setPicked(null)} /> : null}
      </Appear>

      <Appear index={1}><WeekStrip selected={date} today={today} scores={scores} onSelect={setPicked} /></Appear>
      <SyncNotice />
      {actionError ? <Banner tone="warning">{actionError}</Banner> : null}
      {notices.notices.map((n, i) => <Banner key={i} tone="warning" action={{ label: 'OK', onPress: notices.dismiss }}>{n}</Banner>)}

      <Appear index={2}>
        <HeroCard summary={summary} waterMl={log?.water_ml ?? 0} targets={targets.data} programme={programme.data ?? null} date={date} isToday={isToday} />
      </Appear>

      {SLOTS.map((slot: Slot, i) => (
        <Appear key={slot} index={3 + i}>
          <MealSlot slot={slot} source={sources[slot]} saved={savedMeals}
            entries={meals.filter((m) => m.slot === slot)}
            yesterday={yesterdayMeals.filter((m) => m.slot === slot)}
            quickAdds={slot === 'snacks' ? [WHEY_SCOOP, chai(chaiSugar)] : []}
            onCycleSource={() => void setSource(slot, nextSource(sources[slot]))}
            onAdd={(draft) => run(actions.addMeal(slot, sources[slot], draft))}
            onCopyYesterday={() => run(actions.copyMeals(yesterdayMeals.filter((m) => m.slot === slot)))}
            onCycleEntrySource={(e) => run(actions.updateMeal(e, { source: nextSource(e.source) }))}
            onEstimate={(text, photo) => run(estimate(slot, text, photo))}
            onRetry={(e) => { if (store) run(retryEstimate(store, save, e).then(() => engine?.sync())); }}
            onManual={(name) => setEditor({ slot, source: sources[slot], existing: false, entry: null, draft: { ...EMPTY_DRAFT, name, text: name } })}
            onOpen={(e) => setEditor({ slot, source: e.source, existing: true, entry: e, ai: e.ai_estimate, estimating: e.estimate_status === 'pending', draft: { name: e.name, text: e.text, kcal: e.kcal, protein_g: e.protein_g, carbs_g: e.carbs_g, fat_g: e.fat_g, fibre_g: e.fibre_g, junk: e.junk } })} />
        </Appear>
      ))}

      <DayLogging key={date} date={date} log={log} waterTarget={targets.data.water_ml} stepsTarget={targets.data.steps}
        weight={weightToday === null ? null : Number(weightToday)} measurement={measurement} chaiSugar={chaiSugar}
        bedtime={String(targets.data.bedtime_target).slice(0, 5)}
        onPatch={(patch) => run(actions.patchLog(patch))}
        onWeight={(kg) => run(actions.setWeight(kg))}
        onWaist={(cm) => run(actions.setWaist(cm, measurement))} />

      {editor ? (
        <EntryEditor target={editor} onClose={() => setEditor(null)}
          onSave={async (draft, source) => {
            // An entry opened straight after an offline add is read fresh, so the estimate queue's view stays current.
            const e = editor.entry ?? (editor.entryId && store ? ((await store.getRow('meal_entries', editor.entryId))?.data as MealEntryRow | undefined) : undefined);
            if (!e) return actions.addMeal(editor.slot, source, draft);
            // The original AI estimate is kept; the entry shows "Your numbers" whenever they differ from it.
            return actions.updateMeal(e, { ...draft, source, edited: differsFromEstimate(draft, e.ai_estimate) });
          }}
          onFavourite={(draft, source) => actions.saveFavourite({ ...draft, slot: editor.slot, source })}
          onDelete={editor.entry ? () => actions.deleteMeal(editor.entry!) : undefined} />
      ) : null}
    </Screen>
  );
}
