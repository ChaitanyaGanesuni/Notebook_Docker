import type { LocalRow, LocalStore } from './local/store';
import { toLocalRow } from './sync/pull';
import { TABLES, type TableName } from './tables';

export interface RowInput {
  table: TableName;
  /** Full row in server shape. Must include the primary key and user_id. */
  data: Record<string, unknown>;
}

/** Stamps a row with the time of the change, which is what sync conflict resolution compares. */
export function stampRow(input: RowInput, now: Date): LocalRow {
  const spec = TABLES[input.table];
  if (input.data[spec.pk] == null || input.data.user_id == null) {
    throw new Error(`${input.table} row is missing ${spec.pk} or user_id`);
  }
  const iso = now.toISOString();
  return toLocalRow(input.table, { ...input.data, created_at: input.data.created_at ?? iso, updated_at: iso });
}

/** Saves rows on the device and queues them for sync in one atomic step. Works offline. */
export async function saveRows(store: LocalStore, inputs: RowInput[], now: Date = new Date()): Promise<LocalRow[]> {
  const rows = inputs.map((i) => stampRow(i, now));
  await store.write(rows, (r) => TABLES[r.table].pk);
  return rows;
}
