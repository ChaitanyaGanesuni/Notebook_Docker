import { Client } from 'pg';

const url = process.env.TEST_DATABASE_URL;
if (!url) throw new Error('TEST_DATABASE_URL is not set. Run these tests with `npm run test:db`.');

/** Superuser connection: used only for setup, teardown and assertions that must bypass RLS. */
export const admin = new Client({ connectionString: url });

export interface Db {
  query<T extends Record<string, unknown> = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
  /** Runs a statement and returns how many rows it touched. */
  exec(sql: string, params?: unknown[]): Promise<number>;
}

function wrap(client: Client): Db {
  return {
    async query(sql, params) {
      return (await client.query(sql, params as unknown[])).rows;
    },
    async exec(sql, params) {
      return (await client.query(sql, params as unknown[])).rowCount ?? 0;
    },
  };
}

export const sudo: Db = wrap(admin);

/**
 * Runs `fn` exactly as the API would for a signed-in user: role `authenticated`
 * with the user's id in the JWT claims. Pass null for a signed-out (anon) caller.
 * The transaction commits on success and rolls back on error.
 */
export async function as<T>(userId: string | null, fn: (db: Db) => Promise<T>): Promise<T> {
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    await client.query('begin');
    await client.query(`set local role ${userId ? 'authenticated' : 'anon'}`);
    await client.query(`select set_config('request.jwt.claims', $1, true)`, [
      JSON.stringify(userId ? { sub: userId, role: 'authenticated' } : { role: 'anon' }),
    ]);
    const result = await fn(wrap(client));
    await client.query('commit');
    return result;
  } catch (e) {
    await client.query('rollback').catch(() => undefined);
    throw e;
  } finally {
    await client.end();
  }
}

/** Resolves to the Postgres error code of a failing call, or null if it succeeded. */
export async function errorCode(p: Promise<unknown>): Promise<string | null> {
  try {
    await p;
    return null;
  } catch (e) {
    return (e as { code?: string }).code ?? 'unknown';
  }
}

export const RLS_VIOLATION = '42501'; // also "permission denied"

let counter = 0;
export async function createUser(label: string): Promise<string> {
  counter += 1;
  const rows = await sudo.query<{ id: string }>(
    `insert into auth.users (id, email) values (gen_random_uuid(), $1) returning id`,
    [`${label}-${Date.now()}-${counter}@fittrack.test`],
  );
  return rows[0]!.id;
}

export async function deleteUsers(ids: string[]): Promise<void> {
  await sudo.exec(`delete from auth.users where id = any($1::uuid[])`, [ids]);
}
