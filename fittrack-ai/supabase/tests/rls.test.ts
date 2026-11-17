import { admin, as, createUser, deleteUsers, errorCode, RLS_VIOLATION, sudo, type Db } from './helpers';

let alice: string;
let bob: string;
let carol: string;

beforeAll(async () => {
  await admin.connect();
  alice = await createUser('alice');
  bob = await createUser('bob');
  carol = await createUser('carol');
});

afterAll(async () => {
  await deleteUsers([alice, bob, carol]);
  await admin.end();
});

/** Inserts one valid row owned by `uid` into `table` and returns its primary key column and value. */
type Fixture = { key: string; insert: (db: Db, uid: string) => Promise<string>; touch: string };

const one = async (db: Db, sql: string, params: unknown[]): Promise<string> => {
  const rows = await db.query<{ k: string }>(sql, params);
  return rows[0]!.k;
};

const OWN_TABLES: Record<string, Fixture> = {
  profiles: {
    key: 'user_id', touch: `goal = 'x'`,
    insert: (db, u) => one(db, `insert into profiles (user_id, display_name, sex, age, height_cm) values ($1, 'T', 'male', 25, 168) returning user_id as k`, [u]),
  },
  targets: {
    key: 'user_id', touch: `steps = 9000`,
    insert: (db, u) => one(db, `insert into targets (user_id) values ($1) returning user_id as k`, [u]),
  },
  programmes: {
    key: 'id', touch: `name = 'x'`,
    insert: (db, u) => one(db, `insert into programmes (user_id, start_date, weeks, checkpoint_date) values ($1, '2026-11-17', 12, '2027-01-01') returning id as k`, [u]),
  },
  day_logs: {
    key: 'id', touch: `water_ml = 500`,
    insert: (db, u) => one(db, `insert into day_logs (user_id, date) values ($1, '2026-11-17') returning id as k`, [u]),
  },
  weight_logs: {
    key: 'id', touch: `weight_kg = 72.5`,
    insert: (db, u) => one(db, `insert into weight_logs (user_id, date, weight_kg) values ($1, '2026-11-12', 73.0) returning id as k`, [u]),
  },
  body_measurements: {
    key: 'id', touch: `waist_cm = 85`,
    insert: (db, u) => one(db, `insert into body_measurements (user_id, date, waist_cm) values ($1, '2026-11-15', 88) returning id as k`, [u]),
  },
  sleep_logs: {
    key: 'id', touch: `duration_min = 400`,
    insert: (db, u) => one(db, `insert into sleep_logs (user_id, date, duration_min) values ($1, '2026-11-17', 450) returning id as k`, [u]),
  },
  progress_photos: {
    key: 'id', touch: `note = 'x'`,
    insert: (db, u) => one(db, `insert into progress_photos (user_id, date, photo_path) values ($1, '2026-11-17', $2) returning id as k`, [u, `${u}/front.jpg`]),
  },
  notification_preferences: {
    key: 'id', touch: `enabled = true`,
    insert: (db, u) => one(db, `insert into notification_preferences (user_id, kind, time) values ($1, 'weigh_in', '07:15') returning id as k`, [u]),
  },
  meal_entries: {
    key: 'id', touch: `kcal = 300`,
    insert: (db, u) => one(db, `insert into meal_entries (user_id, date, slot, text, kcal, protein_g) values ($1, '2026-11-17', 'breakfast', 'poha', 270, 5) returning id as k`, [u]),
  },
  meal_items: {
    key: 'id', touch: `qty = '2 plates'`,
    insert: async (db, u) => {
      const entry = await one(db, `insert into meal_entries (user_id, date, slot) values ($1, '2026-11-17', 'lunch') returning id as k`, [u]);
      return one(db, `insert into meal_items (user_id, entry_id, name, kcal) values ($1, $2, 'dal', 180) returning id as k`, [u, entry]);
    },
  },
  saved_meals: {
    key: 'id', touch: `name = 'x'`,
    insert: (db, u) => one(db, `insert into saved_meals (user_id, name, kcal) values ($1, 'Whey scoop', 120) returning id as k`, [u]),
  },
  ai_reports: {
    key: 'id', touch: `body = 'x'`,
    insert: (db, u) => one(db, `insert into ai_reports (user_id, kind, period_start, period_end) values ($1, 'daily', '2026-11-17', '2026-11-17') returning id as k`, [u]),
  },
  coach_messages: {
    key: 'id', touch: `content = 'x'`,
    insert: (db, u) => one(db, `insert into coach_messages (user_id, role, content) values ($1, 'user', 'Am I in a deficit?') returning id as k`, [u]),
  },
  workout_sessions: {
    key: 'id', touch: `duration_s = 1500`,
    insert: (db, u) => one(db, `insert into workout_sessions (user_id, date, track_slug) values ($1, '2026-11-17', 'men') returning id as k`, [u]),
  },
  session_participants: {
    key: 'id', touch: `difficulty = 3`,
    insert: async (db, u) => {
      const s = await one(db, `insert into workout_sessions (user_id, date) values ($1, '2026-11-18') returning id as k`, [u]);
      return one(db, `insert into session_participants (user_id, session_id) values ($1, $2) returning id as k`, [u, s]);
    },
  },
  exercise_sets: {
    key: 'id', touch: `reps = 6`,
    insert: async (db, u) => {
      const s = await one(db, `insert into workout_sessions (user_id, date) values ($1, '2026-11-19') returning id as k`, [u]);
      const p = await one(db, `insert into session_participants (user_id, session_id) values ($1, $2) returning id as k`, [u, s]);
      return one(db, `insert into exercise_sets (user_id, session_id, participant_id, exercise_slug, set_number, reps) values ($1, $2, $3, 'incline-push-up', 1, 5) returning id as k`, [u, s, p]);
    },
  },
  food_items: {
    key: 'id', touch: `kcal = 100`,
    insert: (db, u) => one(db, `insert into food_items (user_id, name, kcal) values ($1, 'My dal', 150) returning id as k`, [u]),
  },
  exercises: {
    key: 'id', touch: `name = 'x'`,
    insert: (db, u) => one(db, `insert into exercises (user_id, slug, name, kind) values ($1, 'my-move', 'My move', 'reps') returning id as k`, [u]),
  },
  workout_tracks: {
    key: 'id', touch: `name = 'x'`,
    insert: (db, u) => one(db, `insert into workout_tracks (user_id, slug, name) values ($1, 'my-track', 'My track') returning id as k`, [u]),
  },
  track_exercises: {
    key: 'id', touch: `target = 12`,
    insert: async (db, u) => {
      const t = await one(db, `insert into workout_tracks (user_id, slug, name) values ($1, 'my-track-2', 'T2') returning id as k`, [u]);
      const e = await one(db, `insert into exercises (user_id, slug, name, kind) values ($1, 'my-move-2', 'M2', 'reps') returning id as k`, [u]);
      return one(db, `insert into track_exercises (user_id, track_id, exercise_id, position) values ($1, $2, $3, 1) returning id as k`, [u, t, e]);
    },
  },
};

describe('schema safety net', () => {
  it('has row-level security enabled on every public table', async () => {
    const rows = await sudo.query<{ relname: string; relrowsecurity: boolean }>(
      `select relname, relrowsecurity from pg_class where relnamespace = 'public'::regnamespace and relkind = 'r'`,
    );
    expect(rows).toHaveLength(22);
    expect(rows.filter((r) => !r.relrowsecurity).map((r) => r.relname)).toEqual([]);
  });

  it('covers every table with an isolation test below', async () => {
    const rows = await sudo.query<{ relname: string }>(
      `select relname from pg_class where relnamespace = 'public'::regnamespace and relkind = 'r'`,
    );
    const untested = rows.map((r) => r.relname).filter((t) => !(t in OWN_TABLES) && t !== 'partner_links');
    expect(untested).toEqual([]);
  });

  it('gives a signed-out caller nothing', async () => {
    for (const table of [...Object.keys(OWN_TABLES), 'partner_links']) {
      expect(await errorCode(as(null, (db) => db.query(`select * from ${table}`)))).toBe(RLS_VIOLATION);
    }
  });
});

describe.each(Object.entries(OWN_TABLES))('%s: one user cannot reach another user\'s rows', (table, fx) => {
  let id: string;

  it('lets the owner insert and read their row', async () => {
    id = await as(alice, (db) => fx.insert(db, alice));
    const rows = await as(alice, (db) => db.query(`select 1 from ${table} where ${fx.key} = $1`, [id]));
    expect(rows).toHaveLength(1);
  });

  it('hides it from another user', async () => {
    expect(await as(bob, (db) => db.query(`select 1 from ${table} where ${fx.key} = $1`, [id]))).toHaveLength(0);
    expect(await as(bob, (db) => db.query(`select 1 from ${table} where user_id = $1`, [alice]))).toHaveLength(0);
  });

  it('ignores another user\'s update and delete', async () => {
    expect(await as(bob, (db) => db.exec(`update ${table} set ${fx.touch} where ${fx.key} = $1`, [id]))).toBe(0);
    expect(await as(bob, (db) => db.exec(`delete from ${table} where ${fx.key} = $1`, [id]))).toBe(0);
    expect(await sudo.query(`select 1 from ${table} where ${fx.key} = $1`, [id])).toHaveLength(1);
  });

  it('rejects a row written in someone else\'s name', async () => {
    // bob tries to create a row owned by alice
    const code = await errorCode(as(bob, (db) => fx.insert(db, alice)));
    expect(code).toBe(RLS_VIOLATION);
  });

  it('rejects handing an own row to someone else', async () => {
    if (fx.key === 'user_id') return; // the owner column is the primary key
    const code = await errorCode(as(alice, (db) => db.exec(`update ${table} set user_id = $2 where ${fx.key} = $1`, [id, bob])));
    expect(code).not.toBeNull();
    expect(await sudo.query(`select 1 from ${table} where ${fx.key} = $1 and user_id = $2`, [id, alice])).toHaveLength(1);
  });

  it('lets the owner update and delete', async () => {
    expect(await as(alice, (db) => db.exec(`update ${table} set ${fx.touch} where ${fx.key} = $1`, [id]))).toBe(1);
    expect(await as(alice, (db) => db.exec(`delete from ${table} where ${fx.key} = $1`, [id]))).toBe(1);
  });
});

describe('shared library rows', () => {
  let foodId: string;
  beforeAll(async () => {
    foodId = (await sudo.query<{ id: string }>(`insert into food_items (user_id, name, kcal) values (null, 'Test poha', 270) returning id`))[0]!.id;
  });
  afterAll(async () => {
    await sudo.exec(`delete from food_items where id = $1`, [foodId]);
  });

  it('are readable by any signed-in user', async () => {
    expect(await as(bob, (db) => db.query(`select 1 from food_items where id = $1`, [foodId]))).toHaveLength(1);
  });
  it('cannot be changed, removed or created through the API', async () => {
    expect(await as(bob, (db) => db.exec(`update food_items set kcal = 1 where id = $1`, [foodId]))).toBe(0);
    expect(await as(bob, (db) => db.exec(`delete from food_items where id = $1`, [foodId]))).toBe(0);
    expect(await errorCode(as(bob, (db) => db.exec(`insert into food_items (user_id, name, kcal) values (null, 'Fake', 1)`)))).toBe(RLS_VIOLATION);
  });
});

describe('constraints', () => {
  it('stores the first weigh-in exactly: 73.0 kg on 12 November 2026', async () => {
    await as(carol, (db) => db.exec(`insert into weight_logs (user_id, date, weight_kg) values ($1, '2026-11-12', 73.0)`, [carol]));
    const rows = await as(carol, (db) => db.query<{ weight_kg: string; date: string }>(`select weight_kg::text, date::text from weight_logs where user_id = $1`, [carol]));
    expect(rows).toEqual([{ weight_kg: '73.0', date: '2026-11-12' }]);
    await sudo.exec(`delete from weight_logs where user_id = $1`, [carol]);
  });
  it('refuses under-18 profiles and calorie targets under 1,400', async () => {
    expect(await errorCode(as(carol, (db) => db.exec(`insert into profiles (user_id, display_name, sex, age, height_cm) values ($1, 'C', 'female', 17, 160)`, [carol])))).toBe('23514');
    expect(await errorCode(as(carol, (db) => db.exec(`insert into targets (user_id, kcal_target, kcal_min) values ($1, 1200, 1200)`, [carol])))).toBe('23514');
  });
  it('refuses a meal item attached to another user\'s entry', async () => {
    const entry = await as(alice, (db) => one(db, `insert into meal_entries (user_id, date, slot) values ($1, '2026-11-20', 'dinner') returning id as k`, [alice]));
    const code = await errorCode(as(bob, (db) => db.exec(`insert into meal_items (user_id, entry_id, name) values ($1, $2, 'sneaky')`, [bob, entry])));
    expect(code).toBe('23503');
    await sudo.exec(`delete from meal_entries where id = $1`, [entry]);
  });
});

describe('offline sync: last write wins on updated_at', () => {
  it('keeps the newer row when an older offline write arrives late', async () => {
    const id = await as(carol, (db) => one(db, `insert into day_logs (user_id, date, water_ml, updated_at) values ($1, '2026-11-21', 500, '2026-11-10T10:00:00Z') returning id as k`, [carol]));
    const created = (await sudo.query<{ created_at: Date }>(`select created_at from day_logs where id = $1`, [id]))[0]!.created_at;

    // stale write (made at 09:00, synced late) is ignored
    await as(carol, (db) => db.exec(`update day_logs set water_ml = 250, updated_at = '2026-11-10T09:00:00Z' where id = $1`, [id]));
    expect((await sudo.query<{ water_ml: number }>(`select water_ml from day_logs where id = $1`, [id]))[0]!.water_ml).toBe(500);

    // newer write is applied, created_at is never changed
    await as(carol, (db) => db.exec(`update day_logs set water_ml = 750, updated_at = '2026-11-10T11:00:00Z', created_at = '2000-01-01' where id = $1`, [id]));
    const row = (await sudo.query<{ water_ml: number; created_at: Date }>(`select water_ml, created_at from day_logs where id = $1`, [id]))[0]!;
    expect(row.water_ml).toBe(750);
    expect(row.created_at.getTime()).toBe(created.getTime());
    await sudo.exec(`delete from day_logs where id = $1`, [id]);
  });
});

describe('account deletion', () => {
  it('removes every row the user owned', async () => {
    const dave = await createUser('dave');
    await as(dave, async (db) => {
      for (const fx of Object.values(OWN_TABLES)) await fx.insert(db, dave);
    });
    await deleteUsers([dave]);
    for (const table of Object.keys(OWN_TABLES)) {
      expect(await sudo.query(`select 1 from ${table} where user_id = $1`, [dave])).toHaveLength(0);
    }
  });
});
