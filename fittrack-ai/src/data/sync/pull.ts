import type { LocalRow, LocalStore } from '../local/store';
import { TABLES, type TableName } from '../tables';
import type { Remote } from './remote';

export interface PullSummary {
  applied: number;
  ok: boolean;
  error: string | null;
}

export function toLocalRow(table: TableName, data: Record<string, unknown>): LocalRow {
  const spec = TABLES[table];
  const date = spec.date ? data[spec.date] : null;
  return {
    table,
    id: String(data[spec.pk]),
    user_id: String(data.user_id),
    date: typeof date === 'string' ? date : null,
    data,
    updated_at: String(data.updated_at),
    deleted: data.deleted_at != null,
  };
}

/** Must match the limit used by the remote's fetchSince. */
export const PAGE_SIZE = 1000;
const MAX_PAGES = 50;

const cursorKey = (userId: string, table: TableName) => `pull:${userId}:${table}`;

/** Fetches rows changed on the server since the last pull and merges them (local unsent changes win). */
export async function pullTables(
  store: LocalStore, remote: Remote, userId: string, tables: readonly TableName[],
): Promise<PullSummary> {
  const summary: PullSummary = { applied: 0, ok: true, error: null };
  for (const table of tables) {
    // Page through in batches; the cursor moves to the newest row seen each time.
    for (let page = 0; page < MAX_PAGES; page++) {
      const since = await store.getMeta(cursorKey(userId, table));
      let result;
      try {
        result = await remote.fetchSince(table, userId, since);
      } catch (e) {
        result = { ok: false as const, message: e instanceof Error ? e.message : String(e) };
      }
      if (!result.ok) {
        summary.ok = false;
        summary.error = result.message;
        break;
      }
      // Never trust the server response to be scoped correctly: keep only this user's rows.
      const rows = result.rows.filter((r) => r.user_id === userId).map((r) => toLocalRow(table, r));
      summary.applied += await store.applyRemote(rows);
      const newest = rows.reduce<string | null>(
        (max, r) => (max === null || Date.parse(r.updated_at) > Date.parse(max) ? r.updated_at : max), since);
      const moved = newest !== null && newest !== since;
      if (moved) await store.setMeta(cursorKey(userId, table), newest);
      if (result.rows.length < PAGE_SIZE || !moved) break;
    }
  }
  return summary;
}
