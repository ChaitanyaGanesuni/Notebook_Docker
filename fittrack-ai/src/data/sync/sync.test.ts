import { DEFAULT_STARTING_WEIGHT } from '../../domain/defaults';
import { naturalId } from '../ids';
import { MemoryStore } from '../local/memoryStore';
import { saveRows, stampRow } from '../repo';
import { FakeRemote } from '../testing/fakeRemote';
import { pullTables } from './pull';
import { pushOutbox } from './push';

const U1 = '11111111-1111-4111-8111-111111111111';
const U2 = '22222222-2222-4222-8222-222222222222';
const weightRow = (date: string, kg: number, user = U1) => ({
  table: 'weight_logs' as const,
  data: { id: naturalId(user, 'weight_logs', date), user_id: user, date, weight_kg: kg, deleted_at: null },
});

let store: MemoryStore;
let remote: FakeRemote;
beforeEach(() => {
  store = new MemoryStore();
  remote = new FakeRemote();
});

describe('saving while offline', () => {
  it('keeps the entry on the device and sends it once the connection returns', async () => {
    remote.online = false;
    await saveRows(store, [weightRow(DEFAULT_STARTING_WEIGHT.date, DEFAULT_STARTING_WEIGHT.weight_kg)], new Date('2026-11-12T02:00:00Z'));

    // readable immediately, with no network
    const local = await store.listRows('weight_logs', U1);
    expect(local.map((r) => [r.date, r.data.weight_kg])).toEqual([['2026-11-12', 73]]);

    expect(await pushOutbox(store, remote, U1)).toMatchObject({ sent: 0, interrupted: true });
    expect(await store.counts(U1)).toEqual({ pending: 1, failed: 0 });
    expect(remote.rows('weight_logs')).toHaveLength(0);

    remote.online = true;
    expect(await pushOutbox(store, remote, U1)).toEqual({ sent: 1, rejected: 0, interrupted: false, error: null });
    expect(await store.counts(U1)).toEqual({ pending: 0, failed: 0 });
    expect(remote.rows('weight_logs')[0]).toMatchObject({ date: '2026-11-12', weight_kg: 73, updated_at: '2026-11-12T02:00:00.000Z' });
  });

  it('sends changes in the order they were made and stops at the first network failure', async () => {
    await saveRows(store, [{ table: 'profiles', data: { user_id: U1, display_name: 'C' } }]);
    await saveRows(store, [weightRow('2026-11-12', 73), weightRow('2026-11-13', 72.8)]);
    let n = 0;
    remote.onUpsert = async () => { if (++n === 2) remote.online = false; };
    const first = await pushOutbox(store, remote, U1);
    expect(first).toMatchObject({ sent: 2, interrupted: true });
    expect(remote.calls.map((c) => c.table)).toEqual(['profiles', 'weight_logs', 'weight_logs']);
    remote.online = true;
    remote.onUpsert = null;
    expect(await pushOutbox(store, remote, U1)).toMatchObject({ sent: 1, interrupted: false });
  });

  it('parks a change the server rejects, keeps it, and carries on with the rest', async () => {
    await saveRows(store, [weightRow('2026-11-12', 730), weightRow('2026-11-13', 72.8)]);
    remote.reject = (_t, row) => (Number(row.weight_kg) > 300 ? 'violates check constraint' : null);
    expect(await pushOutbox(store, remote, U1)).toEqual({ sent: 1, rejected: 1, interrupted: false, error: 'violates check constraint' });
    expect(await store.counts(U1)).toEqual({ pending: 0, failed: 1 });
    expect(await store.listRows('weight_logs', U1)).toHaveLength(2); // still on the device
  });

  it('treats a thrown error as a network failure, not a rejection', async () => {
    await saveRows(store, [weightRow('2026-11-12', 73)]);
    remote.upsert = async () => { throw new Error('socket hang up'); };
    expect(await pushOutbox(store, remote, U1)).toMatchObject({ interrupted: true, rejected: 0 });
    expect(await store.counts(U1)).toEqual({ pending: 1, failed: 0 });
  });

  it('only ever sends the signed-in user\'s queue', async () => {
    await saveRows(store, [weightRow('2026-11-12', 73, U1), weightRow('2026-11-12', 60, U2)]);
    await pushOutbox(store, remote, U1);
    expect(remote.rows('weight_logs').map((r) => r.user_id)).toEqual([U1]);
    expect(await store.counts(U2)).toEqual({ pending: 1, failed: 0 });
  });
});

describe('pulling from the server', () => {
  it('loads an existing account onto a new device and remembers where it got to', async () => {
    await remote.upsert('profiles', { user_id: U1, display_name: 'Chaitanya', updated_at: '2026-11-17T03:00:00+00:00' }, 'user_id');
    await remote.upsert('weight_logs', { id: 'w', user_id: U1, date: '2026-11-12', weight_kg: 73, updated_at: '2026-11-12T02:00:00+00:00', deleted_at: null }, 'id');
    const first = await pullTables(store, remote, U1, ['profiles', 'weight_logs']);
    expect(first).toEqual({ applied: 2, ok: true, error: null });
    expect((await store.getRow('profiles', U1))?.data.display_name).toBe('Chaitanya');
    expect(await store.counts(U1)).toEqual({ pending: 0, failed: 0 }); // pulled rows are not re-queued
    expect((await pullTables(store, remote, U1, ['profiles', 'weight_logs'])).applied).toBe(0);
  });

  it('reports failure when offline and leaves local data alone', async () => {
    await saveRows(store, [weightRow('2026-11-12', 73)]);
    remote.online = false;
    expect(await pullTables(store, remote, U1, ['weight_logs'])).toMatchObject({ ok: false, applied: 0 });
    expect(await store.listRows('weight_logs', U1)).toHaveLength(1);
  });

  it('discards rows for any other user even if the server returns them', async () => {
    remote.fetchSince = async () => ({ ok: true, rows: [{ id: 'x', user_id: U2, date: '2026-11-12', weight_kg: 60, updated_at: '2026-11-12T00:00:00Z' }] });
    expect((await pullTables(store, remote, U1, ['weight_logs'])).applied).toBe(0);
    expect(await store.getRow('weight_logs', 'x')).toBeNull();
  });

  it('hides rows the server marks as deleted', async () => {
    await remote.upsert('weight_logs', { id: 'w', user_id: U1, date: '2026-11-12', weight_kg: 73, updated_at: '2026-11-12T02:00:00Z', deleted_at: '2026-11-12T02:00:00Z' }, 'id');
    await pullTables(store, remote, U1, ['weight_logs']);
    expect(await store.listRows('weight_logs', U1)).toHaveLength(0);
    expect(await store.listRows('weight_logs', U1, { includeDeleted: true })).toHaveLength(1);
  });
});

describe('row helpers', () => {
  it('stamps the change time and keeps the original creation time', () => {
    const a = stampRow(weightRow('2026-11-12', 73), new Date('2026-11-12T02:00:00Z'));
    expect(a).toMatchObject({ date: '2026-11-12', updated_at: '2026-11-12T02:00:00.000Z', deleted: false });
    const b = stampRow({ table: 'weight_logs', data: { ...a.data, weight_kg: 72 } }, new Date('2026-11-13T02:00:00Z'));
    expect(b.data).toMatchObject({ created_at: '2026-11-12T02:00:00.000Z', updated_at: '2026-11-13T02:00:00.000Z' });
  });
  it('refuses a row without its key or owner', () => {
    expect(() => stampRow({ table: 'weight_logs', data: { user_id: U1 } }, new Date())).toThrow();
    expect(() => stampRow({ table: 'weight_logs', data: { id: 'x' } }, new Date())).toThrow();
  });
  it('derives the same id for the same user, table and date on any device', () => {
    const id = naturalId(U1, 'weight_logs', '2026-11-12');
    expect(id).toBe(naturalId(U1, 'weight_logs', '2026-11-12'));
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-8[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    const others = [naturalId(U2, 'weight_logs', '2026-11-12'), naturalId(U1, 'day_logs', '2026-11-12'), naturalId(U1, 'weight_logs', '2026-11-13')];
    expect(new Set([id, ...others]).size).toBe(4);
  });
});
