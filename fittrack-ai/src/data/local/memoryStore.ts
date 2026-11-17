import type { TableName } from '../tables';
import type { ListOptions, LocalRow, LocalStore, Mutation, OutboxCounts } from './store';

/**
 * In-memory LocalStore with the same behaviour as SqlStore (both run the same
 * contract tests). Used on web, where it does NOT survive a page reload, and in
 * unit tests. The phone builds use SqlStore.
 */
export class MemoryStore implements LocalStore {
  private rows = new Map<string, LocalRow>();
  private outbox: Mutation[] = [];
  private meta = new Map<string, string>();
  private seq = 0;

  private static key = (table: TableName, id: string) => `${table}/${id}`;
  private static clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

  async init(): Promise<void> {}

  async getRow(table: TableName, id: string): Promise<LocalRow | null> {
    const r = this.rows.get(MemoryStore.key(table, id));
    return r ? MemoryStore.clone(r) : null;
  }

  async listRows(table: TableName, userId: string, o: ListOptions = {}): Promise<LocalRow[]> {
    return [...this.rows.values()]
      .filter((r) => r.table === table && r.user_id === userId)
      .filter((r) => o.includeDeleted || !r.deleted)
      .filter((r) => o.date === undefined || r.date === o.date)
      .filter((r) => o.from === undefined || (r.date !== null && r.date >= o.from))
      .filter((r) => o.to === undefined || (r.date !== null && r.date <= o.to))
      .sort((a, b) => (a.date ?? '').localeCompare(b.date ?? '') || a.updated_at.localeCompare(b.updated_at) || a.id.localeCompare(b.id))
      .map(MemoryStore.clone);
  }

  async write(rows: LocalRow[], onConflict: (row: LocalRow) => string): Promise<void> {
    const prepared = rows.map((r) => ({ row: MemoryStore.clone(r), conflict: onConflict(r) })); // may throw before any change
    const now = new Date().toISOString();
    for (const { row, conflict } of prepared) {
      this.rows.set(MemoryStore.key(row.table, row.id), row);
      const existing = [...this.outbox].reverse().find(
        (m) => m.user_id === row.user_id && m.table === row.table && m.row_id === row.id && m.status === 'pending');
      if (existing) {
        existing.payload = MemoryStore.clone(row.data);
        existing.version += 1;
      } else {
        this.outbox.push({
          seq: ++this.seq, user_id: row.user_id, table: row.table, row_id: row.id,
          payload: MemoryStore.clone(row.data), on_conflict: conflict, version: 1,
          status: 'pending', attempts: 0, last_error: null, created_at: now,
        });
      }
    }
  }

  async applyRemote(rows: LocalRow[]): Promise<number> {
    let applied = 0;
    for (const r of rows) {
      if (this.outbox.some((m) => m.table === r.table && m.row_id === r.id)) continue;
      const local = this.rows.get(MemoryStore.key(r.table, r.id));
      if (local && Date.parse(local.updated_at) >= Date.parse(r.updated_at)) continue;
      this.rows.set(MemoryStore.key(r.table, r.id), MemoryStore.clone(r));
      applied += 1;
    }
    return applied;
  }

  async pendingMutations(userId: string, limit: number): Promise<Mutation[]> {
    return this.outbox.filter((m) => m.user_id === userId && m.status === 'pending').slice(0, limit).map(MemoryStore.clone);
  }

  async completeMutation(seq: number, version: number): Promise<void> {
    this.outbox = this.outbox.filter((m) => !(m.seq === seq && m.version === version));
  }

  async failMutation(seq: number, error: string, permanent: boolean): Promise<void> {
    const m = this.outbox.find((x) => x.seq === seq);
    if (!m) return;
    m.attempts += 1;
    m.last_error = error.slice(0, 500);
    m.status = permanent ? 'failed' : 'pending';
  }

  async retryFailed(userId: string): Promise<void> {
    for (const m of this.outbox) if (m.user_id === userId && m.status === 'failed') m.status = 'pending';
  }

  async counts(userId: string): Promise<OutboxCounts> {
    const mine = this.outbox.filter((m) => m.user_id === userId);
    return {
      pending: mine.filter((m) => m.status === 'pending').length,
      failed: mine.filter((m) => m.status === 'failed').length,
    };
  }

  async getMeta(key: string): Promise<string | null> {
    return this.meta.get(key) ?? null;
  }

  async setMeta(key: string, value: string): Promise<void> {
    this.meta.set(key, value);
  }
}
