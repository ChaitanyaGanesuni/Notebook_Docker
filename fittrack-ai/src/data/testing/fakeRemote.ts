import type { FetchResult, PushResult, Remote } from '../sync/remote';
import type { TableName } from '../tables';

/** Test double for the server: stores upserts in memory and can be told to fail. */
export class FakeRemote implements Remote {
  tables = new Map<TableName, Map<string, Record<string, unknown>>>();
  calls: { table: TableName; row: Record<string, unknown> }[] = [];
  online = true;
  /** Return a rejection message for rows the server should refuse outright. */
  reject: (table: TableName, row: Record<string, unknown>) => string | null = () => null;
  onUpsert: (() => Promise<void>) | null = null;

  async upsert(table: TableName, row: Record<string, unknown>, onConflict: string): Promise<PushResult> {
    this.calls.push({ table, row });
    if (!this.online) return { ok: false, retryable: true, message: 'Network request failed' };
    if (this.onUpsert) await this.onUpsert();
    const rejection = this.reject(table, row);
    if (rejection) return { ok: false, retryable: false, message: rejection };
    const t = this.tables.get(table) ?? new Map<string, Record<string, unknown>>();
    this.tables.set(table, t);
    t.set(String(row[onConflict]), row);
    return { ok: true };
  }

  async fetchSince(table: TableName, userId: string, since: string | null): Promise<FetchResult> {
    if (!this.online) return { ok: false, message: 'Network request failed' };
    const rows = [...(this.tables.get(table)?.values() ?? [])].filter(
      (r) => r.user_id === userId && (since === null || Date.parse(String(r.updated_at)) >= Date.parse(since)));
    return { ok: true, rows };
  }

  rows(table: TableName): Record<string, unknown>[] {
    return [...(this.tables.get(table)?.values() ?? [])];
  }
}
