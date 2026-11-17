import type { SupabaseClient } from '@supabase/supabase-js';
import type { Remote } from './remote';

/** Statuses worth retrying later: no response, timeouts, rate limits, expired session, server errors. */
function isRetryable(status: number | undefined): boolean {
  return status === undefined || status === 0 || status === 401 || status === 408 || status === 429 || status >= 500;
}

export function supabaseRemote(client: SupabaseClient): Remote {
  return {
    async upsert(table, row, onConflict) {
      const { error, status } = await client.from(table).upsert(row, { onConflict });
      if (!error) return { ok: true };
      return { ok: false, retryable: isRetryable(status), message: error.message || `HTTP ${status}` };
    },
    async fetchSince(table, userId, since) {
      let query = client.from(table).select('*').eq('user_id', userId).order('updated_at', { ascending: true }).limit(1000);
      if (since) query = query.gte('updated_at', since);
      const { data, error } = await query;
      if (error) return { ok: false, message: error.message };
      return { ok: true, rows: (data ?? []) as Record<string, unknown>[] };
    },
  };
}
