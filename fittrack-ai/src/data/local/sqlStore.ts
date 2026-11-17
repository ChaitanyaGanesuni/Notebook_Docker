import type { TableName } from '../tables';
import type { ListOptions, LocalRow, LocalStore, Mutation, OutboxCounts } from './store';

export type SqlValue = string | number | null;

/** The few SQLite operations the store needs; implemented by expo-sqlite on device and node:sqlite in tests. */
export interface SqlDriver {
  run(sql: string, params?: SqlValue[]): Promise<void>;
  all<T>(sql: string, params?: SqlValue[]): Promise<T[]>;
}

const SCHEMA = [
  `create table if not exists rows (
     tbl text not null, id text not null, user_id text not null, date text,
     data text not null, updated_at text not null, deleted integer not null default 0,
     primary key (tbl, id))`,
  `create index if not exists rows_user_date on rows (tbl, user_id, date)`,
  `create table if not exists outbox (
     seq integer primary key autoincrement,
     user_id text not null, tbl text not null, row_id text not null,
     payload text not null, on_conflict text not null,
     version integer not null default 1,
     status text not null default 'pending',
     attempts integer not null default 0, last_error text, created_at text not null)`,
  `create index if not exists outbox_user on outbox (user_id, status, seq)`,
  `create table if not exists meta (key text primary key, value text not null)`,
];

interface RowRecord {
  tbl: string; id: string; user_id: string; date: string | null; data: string; updated_at: string; deleted: number;
}
interface OutboxRecord {
  seq: number; user_id: string; tbl: string; row_id: string; payload: string; on_conflict: string;
  version: number; status: string; attempts: number; last_error: string | null; created_at: string;
}

const toRow = (r: RowRecord): LocalRow => ({
  table: r.tbl as TableName, id: r.id, user_id: r.user_id, date: r.date,
  data: JSON.parse(r.data) as Record<string, unknown>, updated_at: r.updated_at, deleted: r.deleted === 1,
});

const UPSERT_ROW = `insert into rows (tbl, id, user_id, date, data, updated_at, deleted) values (?, ?, ?, ?, ?, ?, ?)
  on conflict (tbl, id) do update set user_id = excluded.user_id, date = excluded.date, data = excluded.data,
    updated_at = excluded.updated_at, deleted = excluded.deleted`;

const rowParams = (r: LocalRow): SqlValue[] =>
  [r.table, r.id, r.user_id, r.date, JSON.stringify(r.data), r.updated_at, r.deleted ? 1 : 0];

export class SqlStore implements LocalStore {
  /** Serialises operations so a transaction never interleaves with another call. */
  private queue: Promise<unknown> = Promise.resolve();

  constructor(private readonly db: SqlDriver) {}

  private exclusive<T>(fn: () => Promise<T>): Promise<T> {
    const next = this.queue.then(fn, fn);
    this.queue = next.catch(() => undefined);
    return next;
  }

  private async transaction<T>(fn: () => Promise<T>): Promise<T> {
    await this.db.run('begin immediate');
    try {
      const result = await fn();
      await this.db.run('commit');
      return result;
    } catch (e) {
      await this.db.run('rollback').catch(() => undefined);
      throw e;
    }
  }

  init(): Promise<void> {
    return this.exclusive(async () => {
      for (const sql of SCHEMA) await this.db.run(sql);
    });
  }

  getRow(table: TableName, id: string): Promise<LocalRow | null> {
    return this.exclusive(async () => {
      const rows = await this.db.all<RowRecord>(`select * from rows where tbl = ? and id = ?`, [table, id]);
      return rows[0] ? toRow(rows[0]) : null;
    });
  }

  listRows(table: TableName, userId: string, o: ListOptions = {}): Promise<LocalRow[]> {
    return this.exclusive(async () => {
      const where = ['tbl = ?', 'user_id = ?'];
      const params: SqlValue[] = [table, userId];
      if (!o.includeDeleted) where.push('deleted = 0');
      if (o.date !== undefined) { where.push('date = ?'); params.push(o.date); }
      if (o.from !== undefined) { where.push('date >= ?'); params.push(o.from); }
      if (o.to !== undefined) { where.push('date <= ?'); params.push(o.to); }
      const rows = await this.db.all<RowRecord>(
        `select * from rows where ${where.join(' and ')} order by date, updated_at, id`, params);
      return rows.map(toRow);
    });
  }

  write(rows: LocalRow[], onConflict: (row: LocalRow) => string): Promise<void> {
    return this.exclusive(() => this.transaction(async () => {
      const now = new Date().toISOString();
      for (const r of rows) {
        await this.db.run(UPSERT_ROW, rowParams(r));
        // Fold into an unsent change for the same row when there is one (keeps its place in the queue).
        const existing = await this.db.all<{ seq: number }>(
          `select seq from outbox where user_id = ? and tbl = ? and row_id = ? and status = 'pending' order by seq desc limit 1`,
          [r.user_id, r.table, r.id]);
        const payload = JSON.stringify(r.data);
        if (existing[0]) {
          await this.db.run(`update outbox set payload = ?, version = version + 1 where seq = ?`, [payload, existing[0].seq]);
        } else {
          await this.db.run(
            `insert into outbox (user_id, tbl, row_id, payload, on_conflict, created_at) values (?, ?, ?, ?, ?, ?)`,
            [r.user_id, r.table, r.id, payload, onConflict(r), now]);
        }
      }
    }));
  }

  applyRemote(rows: LocalRow[]): Promise<number> {
    return this.exclusive(() => this.transaction(async () => {
      let applied = 0;
      for (const r of rows) {
        const unsent = await this.db.all<{ seq: number }>(
          `select seq from outbox where tbl = ? and row_id = ? limit 1`, [r.table, r.id]);
        if (unsent[0]) continue;
        const local = await this.db.all<{ updated_at: string }>(
          `select updated_at from rows where tbl = ? and id = ?`, [r.table, r.id]);
        if (local[0] && Date.parse(local[0].updated_at) >= Date.parse(r.updated_at)) continue;
        await this.db.run(UPSERT_ROW, rowParams(r));
        applied += 1;
      }
      return applied;
    }));
  }

  pendingMutations(userId: string, limit: number): Promise<Mutation[]> {
    return this.exclusive(async () => {
      const rows = await this.db.all<OutboxRecord>(
        `select * from outbox where user_id = ? and status = 'pending' order by seq limit ?`, [userId, limit]);
      return rows.map((r) => ({
        seq: r.seq, user_id: r.user_id, table: r.tbl as TableName, row_id: r.row_id,
        payload: JSON.parse(r.payload) as Record<string, unknown>, on_conflict: r.on_conflict,
        version: r.version, status: r.status as Mutation['status'], attempts: r.attempts,
        last_error: r.last_error, created_at: r.created_at,
      }));
    });
  }

  completeMutation(seq: number, version: number): Promise<void> {
    return this.exclusive(() => this.db.run(`delete from outbox where seq = ? and version = ?`, [seq, version]));
  }

  failMutation(seq: number, error: string, permanent: boolean): Promise<void> {
    return this.exclusive(() => this.db.run(
      `update outbox set attempts = attempts + 1, last_error = ?, status = ? where seq = ?`,
      [error.slice(0, 500), permanent ? 'failed' : 'pending', seq]));
  }

  retryFailed(userId: string): Promise<void> {
    return this.exclusive(() => this.db.run(
      `update outbox set status = 'pending' where user_id = ? and status = 'failed'`, [userId]));
  }

  counts(userId: string): Promise<OutboxCounts> {
    return this.exclusive(async () => {
      const rows = await this.db.all<{ status: string; n: number }>(
        `select status, count(*) as n from outbox where user_id = ? group by status`, [userId]);
      const n = (s: string) => rows.find((r) => r.status === s)?.n ?? 0;
      return { pending: n('pending'), failed: n('failed') };
    });
  }

  getMeta(key: string): Promise<string | null> {
    return this.exclusive(async () => {
      const rows = await this.db.all<{ value: string }>(`select value from meta where key = ?`, [key]);
      return rows[0]?.value ?? null;
    });
  }

  setMeta(key: string, value: string): Promise<void> {
    return this.exclusive(() => this.db.run(
      `insert into meta (key, value) values (?, ?) on conflict (key) do update set value = excluded.value`, [key, value]));
  }
}
