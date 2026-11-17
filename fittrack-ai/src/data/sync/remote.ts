import type { TableName } from '../tables';

export type PushResult =
  | { ok: true }
  /** retryable: network or server trouble, try again later. Otherwise the server rejected the row itself. */
  | { ok: false; retryable: boolean; message: string };

export type FetchResult =
  | { ok: true; rows: Record<string, unknown>[] }
  | { ok: false; message: string };

/** The server, as the sync engine sees it. Implemented by Supabase; faked in tests. */
export interface Remote {
  upsert(table: TableName, row: Record<string, unknown>, onConflict: string): Promise<PushResult>;
  /** Rows for this user changed at or after `since` (all rows when null). */
  fetchSince(table: TableName, userId: string, since: string | null): Promise<FetchResult>;
}
