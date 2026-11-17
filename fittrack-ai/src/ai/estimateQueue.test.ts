import type { MealEstimate } from '../../supabase/functions/_shared/ai/estimate.ts';
import { MemoryStore } from '../data/local/memoryStore';
import { saveRows } from '../data/repo';
import type { MealEntryRow } from '../data/tables';
import { applyEstimate, differsFromEstimate, localPhotoKey, MAX_ATTEMPTS, PHOTO_PLACEHOLDER, processEstimates, retryEstimate, type EstimateDeps } from './estimateQueue';
import type { FnResult } from './functions';

const U = '11111111-1111-4111-8111-111111111111';
const EST: MealEstimate = {
  name: 'Poha with peanuts', items: [{ name: 'poha', qty: '1 plate', kcal: 270, protein_g: 5, carbs_g: 45, fat_g: 8, fibre_g: 3 }],
  kcal: 270, protein_g: 5, carbs_g: 45, fat_g: 8, fibre_g: 3, sugar_g: null, sodium_mg: 400, junk: false, confidence: 'medium', assumption: 'One plate.',
};

function entry(id: string, over: Partial<MealEntryRow> = {}): MealEntryRow {
  return {
    id, user_id: U, date: '2026-11-24', slot: 'breakfast', source: 'home', logged_at: `2026-11-24T02:0${id.length % 10}:00.000Z`,
    text: 'poha', photo_path: null, name: 'poha', kcal: null, protein_g: null, carbs_g: null, fat_g: null, fibre_g: null,
    sugar_g: null, sodium_mg: null, junk: false, ai_estimate: null, estimate_status: 'pending', confidence: null, assumption: null,
    edited: false, deleted_at: null, updated_at: '', created_at: '', ...over,
  } as MealEntryRow;
}

function setup(responses: FnResult<{ estimate: MealEstimate; model: string }>[], upload: EstimateDeps['upload'] = async () => ({ ok: true })) {
  const store = new MemoryStore();
  const calls: { text: string; photo_path: string | null }[] = [];
  const uploads: string[] = [];
  const deps: EstimateDeps = {
    store, userId: U,
    save: (rows) => saveRows(store, rows),
    upload: async (path, uri) => { uploads.push(`${path}<-${uri}`); return upload(path, uri); },
    estimate: async (body) => { calls.push(body); return responses.shift() ?? { ok: true, data: { estimate: EST, model: 'gemini:x' } }; },
  };
  const get = async (id: string) => (await store.getRow('meal_entries', id))?.data as MealEntryRow;
  return { store, deps, calls, uploads, get };
}
const net = { ok: false as const, status: null, error: 'network', message: 'offline', retryable: true };

describe('applyEstimate', () => {
  it('fills empty numbers from the estimate and keeps the original estimate', () => {
    const out = applyEstimate(entry('a', { name: PHOTO_PLACEHOLDER, text: '' }), EST, 'gemini:x');
    expect(out).toMatchObject({ name: 'Poha with peanuts', kcal: 270, protein_g: 5, sodium_mg: 400, confidence: 'medium', assumption: 'One plate.', estimate_status: 'done', edited: false });
    expect(out.ai_estimate).toMatchObject({ kcal: 270, model: 'gemini:x', items: EST.items });
  });
  it('never overwrites numbers the user typed while it was pending', () => {
    const out = applyEstimate(entry('a', { kcal: 300, protein_g: 6, carbs_g: 45, fat_g: 8, fibre_g: 3, name: 'My poha' }), EST, 'gemini:x');
    expect(out).toMatchObject({ kcal: 300, protein_g: 6, name: 'My poha', edited: true, estimate_status: 'done' });
    expect(out.ai_estimate?.kcal).toBe(270);
  });
  it('detects when numbers differ from the estimate', () => {
    const ai = { ...EST, model: 'x' };
    expect(differsFromEstimate({ kcal: 270, protein_g: 5, carbs_g: 45, fat_g: 8, fibre_g: 3 }, ai)).toBe(false);
    expect(differsFromEstimate({ kcal: 280, protein_g: 5, carbs_g: 45, fat_g: 8, fibre_g: 3 }, ai)).toBe(true);
    expect(differsFromEstimate({ kcal: 280 }, null)).toBe(false);
  });
});

describe('processEstimates', () => {
  it('uploads the photo first, then estimates with its path', async () => {
    const { store, deps, calls, uploads, get } = setup([]);
    await saveRows(store, [{ table: 'meal_entries', data: entry('a', { text: '', name: PHOTO_PLACEHOLDER }) }]);
    await store.setMeta(localPhotoKey('a'), 'file:///photos/a.jpg');
    const run = await processEstimates(deps);
    expect(run).toEqual({ applied: 1, failed: 0, removed: [], stopped: false });
    expect(uploads).toEqual([`${U}/a.jpg<-file:///photos/a.jpg`]);
    expect(calls).toEqual([{ text: '', photo_path: `${U}/a.jpg` }]);
    expect(await get('a')).toMatchObject({ photo_path: `${U}/a.jpg`, kcal: 270, estimate_status: 'done' });
  });
  it('keeps everything pending while offline, and finishes when back online', async () => {
    const { store, deps, get } = setup([net]);
    await saveRows(store, [{ table: 'meal_entries', data: entry('a') }, { table: 'meal_entries', data: entry('bb') }]);
    expect(await processEstimates(deps)).toMatchObject({ applied: 0, stopped: true });
    expect((await get('a')).estimate_status).toBe('pending');
    expect((await get('bb')).estimate_status).toBe('pending');
    expect(await processEstimates(deps)).toMatchObject({ applied: 2, stopped: false });
  });
  it('stops at a failed upload without calling the AI', async () => {
    const { store, deps, calls } = setup([], async () => ({ ok: false, retryable: true, message: 'offline' }));
    await saveRows(store, [{ table: 'meal_entries', data: entry('a') }]);
    await store.setMeta(localPhotoKey('a'), 'file:///a.jpg');
    expect(await processEstimates(deps)).toMatchObject({ stopped: true });
    expect(calls).toHaveLength(0);
  });
  it('removes a placeholder entry when there is no food, but keeps one the user filled in', async () => {
    const noFood = { ok: false as const, status: 422, error: 'no_food', message: 'No food is visible in the photo.', retryable: false };
    const { store, deps, get } = setup([noFood, noFood]);
    await saveRows(store, [{ table: 'meal_entries', data: entry('a') }, { table: 'meal_entries', data: entry('bb', { kcal: 200 }) }]);
    const run = await processEstimates(deps);
    expect(run.removed).toEqual(['No food is visible in the photo.']);
    expect((await get('a')).deleted_at).not.toBeNull();
    expect(await get('bb')).toMatchObject({ deleted_at: null, kcal: 200, estimate_status: 'failed' });
  });
  it('gives up after repeated failures and can be retried', async () => {
    const bad = { ok: false as const, status: 502, error: 'invalid_ai_response', message: 'bad', retryable: true };
    const { store, deps, get } = setup(Array(MAX_ATTEMPTS).fill(bad));
    await saveRows(store, [{ table: 'meal_entries', data: entry('a') }]);
    for (let i = 0; i < MAX_ATTEMPTS; i++) await processEstimates(deps);
    expect(await processEstimates(deps)).toMatchObject({ failed: 1 });
    expect((await get('a')).estimate_status).toBe('failed');
    await retryEstimate(store, deps.save, await get('a'));
    expect(await processEstimates(deps)).toMatchObject({ applied: 1 });
    expect(await get('a')).toMatchObject({ estimate_status: 'done', kcal: 270 });
  });
  it('marks a permanent rejection as failed straight away', async () => {
    const { store, deps, get } = setup([{ ok: false, status: 400, error: 'bad_request', message: 'too long', retryable: false }]);
    await saveRows(store, [{ table: 'meal_entries', data: entry('a') }]);
    expect(await processEstimates(deps)).toMatchObject({ failed: 1 });
    expect((await get('a')).estimate_status).toBe('failed');
  });
  it('skips entries deleted or already estimated, and queues every change for sync', async () => {
    const { store, deps, calls } = setup([]);
    await saveRows(store, [
      { table: 'meal_entries', data: entry('a', { deleted_at: '2026-11-24T03:00:00Z' }) },
      { table: 'meal_entries', data: entry('bb', { estimate_status: 'done' }) },
      { table: 'meal_entries', data: entry('ccc') },
    ]);
    await store.retryFailed(U);
    const before = (await store.counts(U)).pending;
    await processEstimates(deps);
    expect(calls).toHaveLength(1);
    expect((await store.counts(U)).pending).toBe(before); // the update folds into the queued insert
  });
});
