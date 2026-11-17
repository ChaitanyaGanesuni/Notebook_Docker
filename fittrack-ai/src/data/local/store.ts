import type { TableName } from '../tables';

/** A row as held on the device. `data` is the full server-shaped row. */
export interface LocalRow {
  table: TableName;
  id: string;
  user_id: string;
  date: string | null;
  data: Record<string, unknown>;
  updated_at: string;
  deleted: boolean;
}

/** A change waiting to be sent to the server. */
export interface Mutation {
  seq: number;
  user_id: string;
  table: TableName;
  row_id: string;
  payload: Record<string, unknown>;
  on_conflict: string;
  /** Bumped when a newer change to the same row is folded into this one. */
  version: number;
  status: 'pending' | 'failed';
  attempts: number;
  last_error: string | null;
  created_at: string;
}

export interface ListOptions {
  date?: string;
  from?: string;
  to?: string;
  includeDeleted?: boolean;
}

export interface OutboxCounts {
  pending: number;
  failed: number;
}

/**
 * The on-device database. Every log write lands here first, together with an
 * outbox entry, in one atomic step; the UI reads only from here. Nothing in
 * this interface needs a network connection.
 */
export interface LocalStore {
  init(): Promise<void>;
  getRow(table: TableName, id: string): Promise<LocalRow | null>;
  listRows(table: TableName, userId: string, options?: ListOptions): Promise<LocalRow[]>;
  /** Saves rows and queues them for sync, all or nothing. */
  write(rows: LocalRow[], onConflict: (row: LocalRow) => string): Promise<void>;
  /**
   * Merges rows fetched from the server. A local row wins when it is newer or
   * still has an unsent change. Returns how many rows were applied.
   */
  applyRemote(rows: LocalRow[]): Promise<number>;
  pendingMutations(userId: string, limit: number): Promise<Mutation[]>;
  /** Removes a sent mutation, unless a newer change was folded in while it was in flight. */
  completeMutation(seq: number, version: number): Promise<void>;
  /** Records a failed attempt. `permanent` parks it so it stops blocking the queue. */
  failMutation(seq: number, error: string, permanent: boolean): Promise<void>;
  /** Puts parked mutations back in the queue. */
  retryFailed(userId: string): Promise<void>;
  counts(userId: string): Promise<OutboxCounts>;
  getMeta(key: string): Promise<string | null>;
  setMeta(key: string, value: string): Promise<void>;
}
