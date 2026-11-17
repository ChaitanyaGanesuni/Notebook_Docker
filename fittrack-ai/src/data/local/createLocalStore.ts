import * as SQLite from 'expo-sqlite';
import { SqlStore } from './sqlStore';
import type { LocalStore } from './store';

/** The phone's on-device database (SQLite). Survives restarts and works with no signal. */
export async function createLocalStore(): Promise<LocalStore> {
  const db = await SQLite.openDatabaseAsync('fittrack.db');
  await db.execAsync('pragma journal_mode = WAL');
  const store = new SqlStore({
    run: async (sql, params = []) => {
      await db.runAsync(sql, params);
    },
    all: <T,>(sql: string, params: (string | number | null)[] = []) => db.getAllAsync<T>(sql, params),
  });
  await store.init();
  return store;
}
