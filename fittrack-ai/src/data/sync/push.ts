import type { LocalStore } from '../local/store';
import type { Remote } from './remote';

export interface PushSummary {
  sent: number;
  /** Rejected by the server and parked; they need attention but no longer block the queue. */
  rejected: number;
  /** True when the run stopped early because the server could not be reached. */
  interrupted: boolean;
  error: string | null;
}

const BATCH = 25;

/**
 * Sends queued changes in the order they were made. Stops at the first
 * network-type failure (everything stays queued for the next run). A change
 * the server rejects outright is parked, never dropped, and the queue moves on.
 */
export async function pushOutbox(store: LocalStore, remote: Remote, userId: string): Promise<PushSummary> {
  const summary: PushSummary = { sent: 0, rejected: 0, interrupted: false, error: null };
  for (;;) {
    const batch = await store.pendingMutations(userId, BATCH);
    if (batch.length === 0) return summary;
    for (const m of batch) {
      let result;
      try {
        result = await remote.upsert(m.table, m.payload, m.on_conflict);
      } catch (e) {
        result = { ok: false as const, retryable: true, message: e instanceof Error ? e.message : String(e) };
      }
      if (result.ok) {
        await store.completeMutation(m.seq, m.version);
        summary.sent += 1;
      } else if (result.retryable) {
        await store.failMutation(m.seq, result.message, false);
        summary.interrupted = true;
        summary.error = result.message;
        return summary;
      } else {
        await store.failMutation(m.seq, result.message, true);
        summary.rejected += 1;
        summary.error = result.message;
      }
    }
  }
}
