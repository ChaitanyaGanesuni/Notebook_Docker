import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';
import { useCallback, useMemo } from 'react';
import { DEFAULT_SOURCE, type Slot, type Source } from '../domain/meals';
import { useData, useSaveRows } from './DataProvider';
import { naturalId } from './ids';
import type { DayLogRow, MealEntryRow, MeasurementRow, SavedMealRow } from './tables';

export interface RangeData {
  logs: DayLogRow[];
  meals: MealEntryRow[];
  measurements: MeasurementRow[];
}

/** Day logs, meals and measurements between two local dates (inclusive), read from the device. */
export function useRangeData(from: string, to: string) {
  const { store, userId } = useData();
  return useQuery({
    queryKey: ['local', 'range', userId, from, to],
    enabled: !!store && !!userId,
    queryFn: async (): Promise<RangeData> => {
      const [logs, meals, measurements] = await Promise.all([
        store!.listRows('day_logs', userId!, { from, to }),
        store!.listRows('meal_entries', userId!, { from, to }),
        store!.listRows('body_measurements', userId!, { from, to }),
      ]);
      return {
        logs: logs.map((r) => r.data as DayLogRow),
        meals: meals.map((r) => r.data as MealEntryRow).sort((a, b) => a.logged_at.localeCompare(b.logged_at)),
        measurements: measurements.map((r) => r.data as MeasurementRow),
      };
    },
  });
}

export function useSavedMeals() {
  const { store, userId } = useData();
  return useQuery({
    queryKey: ['local', 'saved_meals', userId],
    enabled: !!store && !!userId,
    queryFn: async () => (await store!.listRows('saved_meals', userId!)).map((r) => r.data as SavedMealRow),
  });
}

type SlotSources = Record<Slot, Source>;

/** The source tag last used for each slot (Home, Canteen, Ordered), remembered on the device. */
export function useSlotSources(): { sources: SlotSources; setSource: (slot: Slot, source: Source) => Promise<void> } {
  const { store, userId } = useData();
  const queryClient = useQueryClient();
  const key = `slot-sources:${userId}`;
  const q = useQuery({
    queryKey: ['local', 'meta', key],
    enabled: !!store && !!userId,
    queryFn: async () => JSON.parse((await store!.getMeta(key)) ?? '{}') as Partial<SlotSources>,
  });
  const sources = useMemo(() => ({ ...DEFAULT_SOURCE, ...q.data }), [q.data]);
  const setSource = useCallback(async (slot: Slot, source: Source) => {
    if (!store) return;
    await store.setMeta(key, JSON.stringify({ ...sources, [slot]: source }));
    await queryClient.invalidateQueries({ queryKey: ['local', 'meta', key] });
  }, [store, key, sources, queryClient]);
  return { sources, setSource };
}

export interface MealDraft {
  name: string;
  text?: string;
  kcal: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  fibre_g: number | null;
  junk: boolean;
}

/** Every way the Today screen changes a day. Each one saves on the device first and syncs later. */
export function useDayActions(date: string, log: DayLogRow | null) {
  const { userId } = useData();
  const save = useSaveRows();

  return useMemo(() => {
    const uid = userId ?? '';
    const baseLog = (): Record<string, unknown> => log ?? {
      id: naturalId(uid, 'day_logs', date), user_id: uid, date, water_ml: 0, steps: null, steps_source: null,
      badminton: false, workout_done: false, in_bed_on_time: false, chai_sugar: null, note: '',
    };
    const mealRow = (slot: Slot, source: Source, d: MealDraft): Record<string, unknown> => ({
      id: Crypto.randomUUID(), user_id: uid, date, slot, source, logged_at: new Date().toISOString(),
      text: d.text ?? '', photo_path: null, name: d.name,
      kcal: d.kcal, protein_g: d.protein_g, carbs_g: d.carbs_g, fat_g: d.fat_g, fibre_g: d.fibre_g,
      sugar_g: null, sodium_mg: null, junk: d.junk, ai_estimate: null, estimate_status: 'none',
      confidence: null, assumption: null, edited: false, deleted_at: null,
    });
    return {
      patchLog: (patch: Partial<DayLogRow>) => save([{ table: 'day_logs', data: { ...baseLog(), ...patch } }]),
      addMeal: (slot: Slot, source: Source, draft: MealDraft) => save([{ table: 'meal_entries', data: mealRow(slot, source, draft) }]),
      /** Copies entries into this day (used by "Same as yesterday"). */
      copyMeals: (entries: MealEntryRow[]) => save(entries.map((e) => ({
        table: 'meal_entries' as const,
        data: { ...mealRow(e.slot, e.source, e), text: e.text, ai_estimate: e.ai_estimate, confidence: e.confidence, assumption: e.assumption, edited: e.edited, estimate_status: e.estimate_status },
      }))),
      updateMeal: (entry: MealEntryRow, patch: Partial<MealEntryRow>) => save([{ table: 'meal_entries', data: { ...entry, ...patch } }]),
      deleteMeal: (entry: MealEntryRow) => save([{ table: 'meal_entries', data: { ...entry, deleted_at: new Date().toISOString() } }]),
      setWeight: (kg: number) => save([{
        table: 'weight_logs', data: { id: naturalId(uid, 'weight_logs', date), user_id: uid, date, weight_kg: kg, deleted_at: null },
      }]),
      setWaist: (cm: number, existing: MeasurementRow | null) => save([{
        table: 'body_measurements',
        data: { hip_cm: null, ...existing, id: naturalId(uid, 'body_measurements', date), user_id: uid, date, waist_cm: cm, deleted_at: null },
      }]),
      saveFavourite: (e: MealDraft & { slot: Slot; source: Source }) => save([{
        table: 'saved_meals',
        data: {
          id: naturalId(uid, 'saved_meals', e.name.trim().toLowerCase()), user_id: uid, name: e.name.trim(), slot: e.slot, source: e.source,
          kcal: e.kcal, protein_g: e.protein_g, carbs_g: e.carbs_g, fat_g: e.fat_g, fibre_g: e.fibre_g, junk: e.junk, items: [], deleted_at: null,
        },
      }]),
      removeFavourite: (m: SavedMealRow) => save([{ table: 'saved_meals', data: { ...m, deleted_at: new Date().toISOString() } }]),
    };
  }, [userId, date, log, save]);
}
