import { admin, as, createUser, deleteUsers, errorCode, RLS_VIOLATION, sudo } from './helpers';

/**
 * alice and bob link as partners; carol is an unrelated signed-in user.
 * Proves: linking shares couples sessions only; other categories are opt-in by
 * their owner; unlinking removes all cross-account access.
 */
let alice: string;
let bob: string;
let carol: string;
let linkId: string;
let code: string;

const ids: Record<string, string> = {};

const visible = (who: string, table: string, owner: string, extra = '') =>
  as(who, (db) => db.query(`select 1 from ${table} where user_id = $1 ${extra}`, [owner])).then((r) => r.length);

beforeAll(async () => {
  await admin.connect();
  alice = await createUser('alice');
  bob = await createUser('bob');
  carol = await createUser('carol');

  // alice's private data
  await as(alice, async (db) => {
    const entry = (await db.query<{ id: string }>(`insert into meal_entries (user_id, date, slot, kcal) values ($1, '2026-11-17', 'lunch', 650) returning id`, [alice]))[0]!.id;
    await db.exec(`insert into meal_items (user_id, entry_id, name) values ($1, $2, 'chicken curry')`, [alice, entry]);
    await db.exec(`insert into weight_logs (user_id, date, weight_kg) values ($1, '2026-11-12', 73.0)`, [alice]);
    await db.exec(`insert into body_measurements (user_id, date, waist_cm) values ($1, '2026-11-15', 88)`, [alice]);
    await db.exec(`insert into progress_photos (user_id, date, photo_path) values ($1, '2026-11-15', $2)`, [alice, `${alice}/front.jpg`]);
    await db.exec(`insert into coach_messages (user_id, role, content) values ($1, 'user', 'private question')`, [alice]);
    await db.exec(`insert into ai_reports (user_id, kind, period_start, period_end) values ($1, 'daily', '2026-11-17', '2026-11-17')`, [alice]);
    await db.exec(`insert into day_logs (user_id, date, note) values ($1, '2026-11-17', 'private note')`, [alice]);
    await db.exec(`insert into profiles (user_id, display_name, sex, age, height_cm) values ($1, 'Alice', 'female', 27, 160)`, [alice]);
    await db.exec(`insert into storage.objects (bucket_id, name) values ('progress-photos', $1), ('meal-photos', $2)`, [`${alice}/front.jpg`, `${alice}/lunch.jpg`]);
    // a solo session, which must never be shared
    ids.solo = (await db.query<{ id: string }>(`insert into workout_sessions (user_id, date, track_slug) values ($1, '2026-11-18', 'women') returning id`, [alice]))[0]!.id;
  });
});

afterAll(async () => {
  await sudo.exec(`delete from storage.objects where name like $1 or name like $2`, [`${alice}/%`, `${bob}/%`]);
  await deleteUsers([alice, bob, carol]);
  await admin.end();
});

const PRIVATE_TABLES = ['meal_entries', 'meal_items', 'weight_logs', 'body_measurements', 'progress_photos', 'coach_messages', 'ai_reports', 'day_logs', 'profiles'];

describe('inviting and accepting', () => {
  it('creates an invite that only its creator can see', async () => {
    const link = (await as(alice, (db) => db.query<{ id: string; invite_code: string; status: string }>(`select * from create_partner_invite()`)))[0]!;
    linkId = link.id;
    code = link.invite_code;
    expect(link.status).toBe('pending');
    expect(code).toMatch(/^[0-9A-F]{10}$/);
    expect(await as(bob, (db) => db.query(`select 1 from partner_links`))).toHaveLength(0);
  });

  it('shares nothing while the invite is only pending', async () => {
    for (const t of PRIVATE_TABLES) expect(await visible(bob, t, alice)).toBe(0);
  });

  it('cannot be written directly, accepted by its creator, or accepted with a wrong code', async () => {
    expect(await errorCode(as(bob, (db) => db.exec(`insert into partner_links (requester_id, addressee_id, invite_code, status) values ($1, $2, 'FORGED', 'accepted')`, [alice, bob])))).toBe(RLS_VIOLATION);
    expect(await errorCode(as(alice, (db) => db.exec(`update partner_links set status = 'accepted', addressee_id = $2 where id = $1`, [linkId, bob])))).toBe(RLS_VIOLATION);
    expect(await errorCode(as(alice, (db) => db.query(`select accept_partner_invite($1)`, [code])))).toBe('P0001');
    expect(await errorCode(as(bob, (db) => db.query(`select accept_partner_invite('NOPE')`)))).toBe('P0001');
    expect(await errorCode(as(null, (db) => db.query(`select accept_partner_invite($1)`, [code])))).toBe(RLS_VIOLATION);
  });

  it('links the two accounts once the invitee accepts', async () => {
    const link = (await as(bob, (db) => db.query<{ status: string; addressee_id: string }>(`select * from accept_partner_invite($1)`, [code.toLowerCase()])))[0]!;
    expect(link).toMatchObject({ status: 'accepted', addressee_id: bob });
    expect(await as(bob, (db) => db.query(`select 1 from partner_links`))).toHaveLength(1);
    expect(await as(carol, (db) => db.query(`select 1 from partner_links`))).toHaveLength(0);
  });

  it('refuses a second partner while one is linked', async () => {
    const other = (await as(carol, (db) => db.query<{ invite_code: string }>(`select * from create_partner_invite()`)))[0]!;
    expect(await errorCode(as(bob, (db) => db.query(`select accept_partner_invite($1)`, [other.invite_code])))).toBe('P0001');
  });
});

describe('linked, default sharing', () => {
  it('keeps meals, weight, measurements, photos, coach chats, notes and profile private', async () => {
    for (const t of PRIVATE_TABLES) expect(await visible(bob, t, alice)).toBe(0);
    expect(await as(bob, (db) => db.query(`select 1 from storage.objects`))).toHaveLength(0);
  });

  it('lets the phone owner record a couples session to both accounts', async () => {
    await as(alice, async (db) => {
      const group = (await db.query<{ g: string }>(`select gen_random_uuid() as g`))[0]!.g;
      for (const [who, key, reps] of [[alice, 'a', 8], [bob, 'b', 5]] as const) {
        const s = (await db.query<{ id: string }>(`insert into workout_sessions (user_id, date, track_slug, is_couples, couple_group_id) values ($1, '2026-11-19', 'couples', true, $2) returning id`, [who, group]))[0]!.id;
        const p = (await db.query<{ id: string }>(`insert into session_participants (user_id, session_id, difficulty) values ($1, $2, 3) returning id`, [who, s]))[0]!.id;
        await db.exec(`insert into exercise_sets (user_id, session_id, participant_id, exercise_slug, set_number, reps) values ($1, $2, $3, 'you-go-i-go-push-ups', 1, $4)`, [who, s, p, reps]);
        ids[`session_${key}`] = s;
        ids[`participant_${key}`] = p;
      }
    });
    expect(await sudo.query(`select 1 from workout_sessions where user_id = $1 and is_couples`, [bob])).toHaveLength(1);
  });

  it('shows both partners the couples session with each person\'s own reps', async () => {
    const reps = await as(bob, (db) => db.query<{ user_id: string; reps: number }>(`select user_id, reps from exercise_sets where exercise_slug = 'you-go-i-go-push-ups' order by reps`));
    expect(reps).toEqual([{ user_id: bob, reps: 5 }, { user_id: alice, reps: 8 }]);
    expect(await visible(bob, 'workout_sessions', alice)).toBe(1);
    expect(await visible(alice, 'session_participants', bob)).toBe(1);
  });

  it('lets each person rate their own copy', async () => {
    expect(await as(bob, (db) => db.exec(`update session_participants set difficulty = 5 where id = $1`, [ids.participant_b]))).toBe(1);
    const rows = await sudo.query<{ id: string; difficulty: number }>(`select id, difficulty from session_participants where id = any($1::uuid[])`, [[ids.participant_a, ids.participant_b]]);
    expect(rows.find((r) => r.id === ids.participant_a)!.difficulty).toBe(3);
    expect(rows.find((r) => r.id === ids.participant_b)!.difficulty).toBe(5);
  });

  it('never shares a solo session, and never lets a partner write one into the other account', async () => {
    expect(await as(bob, (db) => db.query(`select 1 from workout_sessions where id = $1`, [ids.solo]))).toHaveLength(0);
    expect(await errorCode(as(alice, (db) => db.exec(`insert into workout_sessions (user_id, date, is_couples) values ($1, '2026-11-20', false)`, [bob])))).toBe(RLS_VIOLATION);
  });

  it('does not let a partner delete the other person\'s copy', async () => {
    expect(await as(alice, (db) => db.exec(`delete from workout_sessions where id = $1`, [ids.session_b]))).toBe(0);
  });

  it('gives an unrelated user none of it', async () => {
    expect(await visible(carol, 'workout_sessions', alice)).toBe(0);
    expect(await visible(carol, 'exercise_sets', bob)).toBe(0);
    expect(await errorCode(as(carol, (db) => db.exec(`insert into workout_sessions (user_id, date, is_couples) values ($1, '2026-11-20', true)`, [alice])))).toBe(RLS_VIOLATION);
  });
});

describe('opt-in category sharing', () => {
  it('is controlled only by the owner of the data', async () => {
    // bob tries to switch on alice's sharing: it only ever changes bob's own side
    await as(bob, (db) => db.query(`select set_partner_sharing($1, array['meals','weight','photos'])`, [linkId]));
    const link = (await sudo.query<{ requester_shares: string[]; addressee_shares: string[] }>(`select requester_shares, addressee_shares from partner_links where id = $1`, [linkId]))[0]!;
    expect(link.requester_shares).toEqual([]); // alice's side untouched
    expect(link.addressee_shares).toEqual(['meals', 'weight', 'photos']);
    expect(await visible(bob, 'weight_logs', alice)).toBe(0);
    await as(bob, (db) => db.query(`select set_partner_sharing($1, '{}')`, [linkId]));
  });

  it('rejects unknown categories and outsiders', async () => {
    expect(await errorCode(as(alice, (db) => db.query(`select set_partner_sharing($1, array['bank_details'])`, [linkId])))).toBe('23514');
    expect(await errorCode(as(carol, (db) => db.query(`select set_partner_sharing($1, array['weight'])`, [linkId])))).toBe('P0001');
  });

  it('shares exactly the category the owner turns on, read-only', async () => {
    await as(alice, (db) => db.query(`select set_partner_sharing($1, array['weight'])`, [linkId]));
    expect(await visible(bob, 'weight_logs', alice)).toBe(1);
    for (const t of PRIVATE_TABLES.filter((x) => x !== 'weight_logs')) expect(await visible(bob, t, alice)).toBe(0);
    expect(await as(bob, (db) => db.exec(`update weight_logs set weight_kg = 60 where user_id = $1`, [alice]))).toBe(0);
    expect(await as(bob, (db) => db.exec(`delete from weight_logs where user_id = $1`, [alice]))).toBe(0);
    expect(await visible(carol, 'weight_logs', alice)).toBe(0);
  });

  it('shares photos and their files only when photos are turned on', async () => {
    await as(alice, (db) => db.query(`select set_partner_sharing($1, array['weight','photos'])`, [linkId]));
    expect(await visible(bob, 'progress_photos', alice)).toBe(1);
    const files = await as(bob, (db) => db.query<{ bucket_id: string }>(`select bucket_id from storage.objects`));
    expect(files).toEqual([{ bucket_id: 'progress-photos' }]); // meal photos still private
    expect(await errorCode(as(bob, (db) => db.exec(`insert into storage.objects (bucket_id, name) values ('progress-photos', $1)`, [`${alice}/planted.jpg`])))).toBe(RLS_VIOLATION);
  });

  it('stops sharing a category when the owner turns it off', async () => {
    await as(alice, (db) => db.query(`select set_partner_sharing($1, array['weight'])`, [linkId]));
    expect(await visible(bob, 'progress_photos', alice)).toBe(0);
    expect(await as(bob, (db) => db.query(`select 1 from storage.objects`))).toHaveLength(0);
  });
});

describe('unlinking', () => {
  it('can be done by either person and removes all cross-account access', async () => {
    const link = (await as(bob, (db) => db.query<{ status: string; requester_shares: string[] }>(`select * from unlink_partner($1)`, [linkId])))[0]!;
    expect(link).toMatchObject({ status: 'revoked', requester_shares: [] });

    for (const t of [...PRIVATE_TABLES, 'workout_sessions', 'session_participants', 'exercise_sets']) {
      expect(await visible(bob, t, alice)).toBe(0);
    }
    expect(await visible(alice, 'workout_sessions', bob)).toBe(0);
    expect(await visible(alice, 'exercise_sets', bob)).toBe(0);
  });

  it('leaves each person their own copy of past couples sessions', async () => {
    expect(await visible(bob, 'workout_sessions', bob)).toBe(1);
    expect(await visible(bob, 'exercise_sets', bob)).toBe(1);
    expect(await visible(alice, 'workout_sessions', alice, 'and is_couples')).toBe(1);
  });

  it('stops writes into the former partner\'s account', async () => {
    expect(await errorCode(as(alice, (db) => db.exec(`insert into workout_sessions (user_id, date, is_couples) values ($1, '2026-11-22', true)`, [bob])))).toBe(RLS_VIOLATION);
    expect(await as(alice, (db) => db.exec(`update session_participants set difficulty = 1 where id = $1`, [ids.participant_b]))).toBe(0);
  });

  it('cannot be undone by re-using the old invite code', async () => {
    expect(await errorCode(as(bob, (db) => db.query(`select accept_partner_invite($1)`, [code])))).toBe('P0001');
  });
});
