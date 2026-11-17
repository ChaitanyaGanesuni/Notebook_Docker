/**
 * Turns pending meal entries into estimates once there is a connection.
 * A meal is saved first (with empty numbers if need be) and estimated later,
 * so nothing is ever lost to a bad signal. Pure apart from the injected calls.
 */
import type { MealEstimate } from '../../supabase/functions/_shared/ai/estimate.ts';
import type { LocalStore } from '../data/local/store';
import type { RowInput } from '../data/repo';
import type { MealEntryRow } from '../data/tables';
import type { FnResult, UploadResult } from './functions';

export const PHOTO_PLACEHOLDER = 'Meal photo';
export const MAX_ATTEMPTS = 4;

export const localPhotoKey = (entryId: string) => `local-photo:${entryId}`;
const attemptsKey = (entryId: string) => `estimate-attempts:${entryId}`;

export interface EstimateDeps {
  store: LocalStore;
  userId: string;
  save: (rows: RowInput[]) => Promise<unknown>;
  upload: (path: string, localUri: string) => Promise<UploadResult>;
  estimate: (body: { text: string; photo_path: string | null }) => Promise<FnResult<{ estimate: MealEstimate; model: string }>>;
}

export interface EstimateRun {
  applied: number;
  failed: number;
  /** Entries removed because there was no food in them. */
  removed: string[];
  /** True when the run stopped early because the network or service was unavailable. */
  stopped: boolean;
}

const NUMBERS = ['kcal', 'protein_g', 'carbs_g', 'fat_g', 'fibre_g'] as const;

/** True when the entry's numbers differ from the AI estimate it carries. */
export function differsFromEstimate(values: Partial<Record<(typeof NUMBERS)[number], number | null>>, ai: MealEntryRow['ai_estimate']): boolean {
  if (!ai || ai.kcal == null) return false;
  return NUMBERS.some((k) => (values[k] == null ? null : Number(values[k])) !== (ai[k] == null ? null : Number(ai[k])));
}

/**
 * Applies an estimate to an entry. The AI estimate is always stored as it came.
 * If the user typed numbers while it was pending, theirs are kept and the entry
 * is marked as "Your numbers"; nothing the user entered is ever overwritten.
 */
export function applyEstimate(entry: MealEntryRow, est: MealEstimate, model: string): MealEntryRow {
  const userNumbers = entry.kcal != null;
  const placeholderName = !entry.name.trim() || entry.name === PHOTO_PLACEHOLDER || entry.name === entry.text;
  const ai_estimate = { ...est, model };
  return {
    ...entry,
    name: placeholderName ? est.name : entry.name,
    ai_estimate,
    estimate_status: 'done',
    confidence: est.confidence,
    assumption: est.assumption,
    ...(userNumbers
      ? { edited: differsFromEstimate(entry, ai_estimate) }
      : {
          kcal: est.kcal, protein_g: est.protein_g, carbs_g: est.carbs_g, fat_g: est.fat_g, fibre_g: est.fibre_g,
          sugar_g: est.sugar_g, sodium_mg: est.sodium_mg, junk: est.junk, edited: false,
        }),
  };
}

export async function processEstimates(d: EstimateDeps): Promise<EstimateRun> {
  const run: EstimateRun = { applied: 0, failed: 0, removed: [], stopped: false };
  const rows = await d.store.listRows('meal_entries', d.userId);
  const pending = rows.map((r) => r.data as MealEntryRow).filter((e) => e.estimate_status === 'pending')
    .sort((a, b) => a.logged_at.localeCompare(b.logged_at));

  for (const original of pending) {
    // Re-read: the user may have edited or deleted the entry while earlier ones ran.
    const fresh = (await d.store.getRow('meal_entries', original.id))?.data as MealEntryRow | undefined;
    if (!fresh || fresh.deleted_at || fresh.estimate_status !== 'pending') continue;
    let entry = fresh;

    const attempts = Number((await d.store.getMeta(attemptsKey(entry.id))) ?? 0);
    const giveUp = async () => {
      await d.save([{ table: 'meal_entries', data: { ...entry, estimate_status: 'failed' } }]);
      run.failed += 1;
    };
    if (attempts >= MAX_ATTEMPTS) { await giveUp(); continue; }

    const localUri = await d.store.getMeta(localPhotoKey(entry.id));
    if (localUri && !entry.photo_path) {
      const path = `${d.userId}/${entry.id}.jpg`;
      const up = await d.upload(path, localUri);
      if (!up.ok) {
        if (up.retryable) { run.stopped = true; break; }
        await giveUp();
        continue;
      }
      entry = { ...entry, photo_path: path };
      await d.save([{ table: 'meal_entries', data: entry }]);
    }
    if (!entry.text.trim() && !entry.photo_path) { await giveUp(); continue; }

    const res = await d.estimate({ text: entry.text, photo_path: entry.photo_path });
    if (res.ok) {
      await d.save([{ table: 'meal_entries', data: applyEstimate(entry, res.data.estimate, res.data.model) }]);
      run.applied += 1;
      continue;
    }
    if (res.error === 'no_food') {
      if (entry.kcal != null) {
        await d.save([{ table: 'meal_entries', data: { ...entry, estimate_status: 'failed', ai_estimate: { error: res.message } } }]);
        run.failed += 1;
      } else {
        // "If there is no food, add nothing": take back the placeholder entry.
        await d.save([{ table: 'meal_entries', data: { ...entry, estimate_status: 'failed', ai_estimate: { error: res.message }, deleted_at: new Date().toISOString() } }]);
        run.removed.push(res.message);
      }
      continue;
    }
    await d.store.setMeta(attemptsKey(entry.id), String(attempts + 1));
    if (res.retryable) { run.stopped = true; break; }
    await giveUp();
  }
  return run;
}

/** Puts a failed entry back in the queue (the Retry button). */
export async function retryEstimate(store: LocalStore, save: EstimateDeps['save'], entry: MealEntryRow): Promise<void> {
  await store.setMeta(attemptsKey(entry.id), '0');
  await save([{ table: 'meal_entries', data: { ...entry, estimate_status: 'pending', ai_estimate: entry.ai_estimate?.error ? null : entry.ai_estimate } }]);
}
