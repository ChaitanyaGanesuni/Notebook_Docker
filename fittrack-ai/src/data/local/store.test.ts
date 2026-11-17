import { nodeSqliteDriver } from '../testing/nodeSqliteDriver';
import { MemoryStore } from './memoryStore';
import { SqlStore } from './sqlStore';
import type { LocalRow, LocalStore } from './store';

const U1 = '11111111-1111-4111-8111-111111111111';
const U2 = '22222222-2222-4222-8222-222222222222';

const weight = (id: string, user: string, date: string, kg: number, updated_at: string, deleted = false): LocalRow => ({
  table: 'weight_logs', id, user_id: user, date, updated_at, deleted,
  data: { id, user_id: user, date, weight_kg: kg, updated_at, deleted_at: deleted ? updated_at : null },
});
const byId = () => 'id';

const implementations: [string, () => LocalStore][] = [
  ['SqlStore (real SQLite)', () => new SqlStore(nodeSqliteDriver())],
  ['MemoryStore', () => new MemoryStore()],
];

describe.each(implementations)('%s', (_name, make) => {
  let store: LocalStore;
  beforeEach(async () => {
    store = make();
    await store.init();
    await store.init(); // safe to run twice
  });

  it('saves a row and queues it for sync in one step', async () => {
    await store.write([weight('w1', U1, '2026-11-12', 73.0, '2026-11-12T02:00:00.000Z')], byId);
    expect((await store.getRow('weight_logs', 'w1'))?.data.weight_kg).toBe(73.0);
    const pending = await store.pendingMutations(U1, 10);
    expect(pending).toHaveLength(1);
    expect(pending[0]).toMatchObject({ table: 'weight_logs', row_id: 'w1', on_conflict: 'id', version: 1, status: 'pending' });
    expect(pending[0]!.payload.weight_kg).toBe(73.0);
    expect(await store.counts(U1)).toEqual({ pending: 1, failed: 0 });
  });

  it('writes nothing when any row in the batch is bad', async () => {
    const bad = () => { throw new Error('no conflict target'); };
    await expect(store.write([weight('w1', U1, '2026-11-12', 73, '2026-11-12T02:00:00.000Z')], bad)).rejects.toThrow();
    expect(await store.getRow('weight_logs', 'w1')).toBeNull();
    expect(await store.counts(U1)).toEqual({ pending: 0, failed: 0 });
  });

  it('keeps users apart on the same device', async () => {
    await store.write([weight('a', U1, '2026-11-12', 73, 't1'), weight('b', U2, '2026-11-12', 60, 't1')], byId);
    expect((await store.listRows('weight_logs', U1)).map((r) => r.id)).toEqual(['a']);
    expect(await store.pendingMutations(U2, 10)).toHaveLength(1);
    expect(await store.counts(U1)).toEqual({ pending: 1, failed: 0 });
  });

  it('lists by date and range, hiding deleted rows unless asked', async () => {
    await store.write([
      weight('a', U1, '2026-11-12', 73.0, '2026-11-12T02:00:00.000Z'),
      weight('b', U1, '2026-11-17', 72.6, '2026-11-17T02:00:00.000Z'),
      weight('c', U1, '2026-11-18', 72.8, '2026-11-18T02:00:00.000Z', true),
    ], byId);
    expect((await store.listRows('weight_logs', U1)).map((r) => r.id)).toEqual(['a', 'b']);
    expect((await store.listRows('weight_logs', U1, { date: '2026-11-17' })).map((r) => r.id)).toEqual(['b']);
    expect((await store.listRows('weight_logs', U1, { from: '2026-11-13', to: '2026-11-18', includeDeleted: true })).map((r) => r.id)).toEqual(['b', 'c']);
  });

  it('folds repeated edits of one row into a single queued change, in its original position', async () => {
    await store.write([weight('a', U1, '2026-11-12', 73.0, 't1')], byId);
    await store.write([weight('b', U1, '2026-11-13', 72.9, 't2')], byId);
    await store.write([weight('a', U1, '2026-11-12', 73.2, 't3')], byId);
    const pending = await store.pendingMutations(U1, 10);
    expect(pending.map((m) => [m.row_id, m.version, m.payload.weight_kg])).toEqual([['a', 2, 73.2], ['b', 1, 72.9]]);
  });

  it('does not lose an edit made while the earlier version was being sent', async () => {
    await store.write([weight('a', U1, '2026-11-12', 73.0, 't1')], byId);
    const inFlight = (await store.pendingMutations(U1, 1))[0]!;
    await store.write([weight('a', U1, '2026-11-12', 73.4, 't2')], byId); // edit during the request
    await store.completeMutation(inFlight.seq, inFlight.version); // old version acknowledged
    const pending = await store.pendingMutations(U1, 10);
    expect(pending).toHaveLength(1);
    expect(pending[0]!.payload.weight_kg).toBe(73.4);
    await store.completeMutation(pending[0]!.seq, pending[0]!.version);
    expect(await store.counts(U1)).toEqual({ pending: 0, failed: 0 });
  });

  it('parks rejected changes without dropping them, and can retry them', async () => {
    await store.write([weight('a', U1, '2026-11-12', 73.0, 't1')], byId);
    const m = (await store.pendingMutations(U1, 1))[0]!;
    await store.failMutation(m.seq, 'temporary', false);
    expect((await store.pendingMutations(U1, 1))[0]).toMatchObject({ attempts: 1, last_error: 'temporary', status: 'pending' });
    await store.failMutation(m.seq, 'rejected', true);
    expect(await store.pendingMutations(U1, 10)).toHaveLength(0);
    expect(await store.counts(U1)).toEqual({ pending: 0, failed: 1 });
    await store.retryFailed(U1);
    expect(await store.counts(U1)).toEqual({ pending: 1, failed: 0 });
  });

  it('merges server rows: applies newer ones, keeps newer or unsent local ones', async () => {
    await store.write([weight('local-unsent', U1, '2026-11-12', 73.0, '2026-11-12T02:00:00.000Z')], byId);
    await store.write([weight('local-newer', U1, '2026-11-13', 72.9, '2026-11-13T05:00:00.000Z')], byId);
    const sent = (await store.pendingMutations(U1, 10)).find((m) => m.row_id === 'local-newer')!;
    await store.completeMutation(sent.seq, sent.version);

    const applied = await store.applyRemote([
      weight('local-unsent', U1, '2026-11-12', 99, '2026-11-20T00:00:00.000Z'), // local change not sent yet: skip
      weight('local-newer', U1, '2026-11-13', 99, '2026-11-13T04:00:00+00:00'), // older than local: skip
      weight('remote-new', U1, '2026-11-14', 72.7, '2026-11-14T02:00:00+00:00'), // unknown locally: apply
    ]);
    expect(applied).toBe(1);
    expect((await store.getRow('weight_logs', 'local-unsent'))!.data.weight_kg).toBe(73.0);
    expect((await store.getRow('weight_logs', 'local-newer'))!.data.weight_kg).toBe(72.9);
    expect((await store.getRow('weight_logs', 'remote-new'))!.data.weight_kg).toBe(72.7);
    // a newer server version of an already-synced row replaces it, and does not re-queue anything
    expect(await store.applyRemote([weight('local-newer', U1, '2026-11-13', 72.5, '2026-11-13T06:00:00+00:00')])).toBe(1);
    expect((await store.getRow('weight_logs', 'local-newer'))!.data.weight_kg).toBe(72.5);
    expect(await store.counts(U1)).toEqual({ pending: 1, failed: 0 });
  });

  it('queues rows written into a partner\'s account under the account that wrote them', async () => {
    await store.write([weight('p1', U2, '2026-11-19', 60, 't1')], byId, U1);
    expect(await store.pendingMutations(U1, 10)).toHaveLength(1);
    expect(await store.pendingMutations(U2, 10)).toHaveLength(0);
    expect((await store.pendingMutations(U1, 10))[0]!.payload.user_id).toBe(U2);
    expect(await store.listRows('weight_logs', U1)).toHaveLength(0); // still the partner's row
  });

  it('stores small settings', async () => {
    expect(await store.getMeta('k')).toBeNull();
    await store.setMeta('k', 'a');
    await store.setMeta('k', 'b');
    expect(await store.getMeta('k')).toBe('b');
  });
});
