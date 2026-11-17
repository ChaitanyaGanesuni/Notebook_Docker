/** Test-only SqlDriver backed by Node's built-in SQLite, so SqlStore's real SQL runs in unit tests. */
import { DatabaseSync } from 'node:sqlite';
import type { SqlDriver, SqlValue } from '../local/sqlStore';

export function nodeSqliteDriver(): SqlDriver {
  const db = new DatabaseSync(':memory:');
  return {
    async run(sql: string, params: SqlValue[] = []) {
      db.prepare(sql).run(...params);
    },
    async all<T>(sql: string, params: SqlValue[] = []) {
      return db.prepare(sql).all(...params) as T[];
    },
  };
}
