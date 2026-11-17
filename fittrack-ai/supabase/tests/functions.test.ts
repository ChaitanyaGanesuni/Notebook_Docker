import { ESTIMATE_SYSTEM } from '../functions/_shared/ai/estimate';
import { AiUnavailableError, fakeProvider, fakeResponder, type GenerateRequest } from '../functions/_shared/ai/provider';
import { coachChat, DAILY_MESSAGE_LIMIT } from '../functions/_shared/handlers/coachChat';
import { estimateMeal } from '../functions/_shared/handlers/estimateMeal';
import { generateReport } from '../functions/_shared/handlers/generateReport';
import { admin, as, createUser, deleteUsers, sudo } from './helpers';
import { pgUserDb, TINY_JPEG } from './pgUserDb';

let me: string;
let other: string;
const NOW = new Date('2026-11-24T14:30:00Z'); // 20:00 in Asia/Kolkata, 24 Nov

async function onboard(uid: string, name: string) {
  await as(uid, async (db) => {
    await db.exec(`insert into profiles (user_id, display_name, sex, age, height_cm, goal, onboarded_at) values ($1, $2, 'male', 25, 168, 'Fat loss', now())`, [uid, name]);
    await db.exec(`insert into targets (user_id) values ($1)`, [uid]);
    await db.exec(`insert into programmes (user_id, name, start_date, weeks, checkpoint_date) values ($1, '12-week fat loss', '2026-11-17', 12, '2027-01-01')`, [uid]);
    await db.exec(`insert into weight_logs (user_id, date, weight_kg) values ($1, '2026-11-12', 73.0), ($1, '2026-11-23', 72.4)`, [uid]);
  });
}

beforeAll(async () => {
  await admin.connect();
  me = await createUser('me');
  other = await createUser('other');
  await onboard(me, 'Chaitanya');
  await onboard(other, 'Someone Else');
  await as(me, async (db) => {
    await db.exec(`insert into meal_entries (user_id, date, slot, name, kcal, protein_g, carbs_g, fat_g, fibre_g) values
      ($1, '2026-11-24', 'breakfast', 'Poha', 270, 5, 45, 8, 3),
      ($1, '2026-11-24', 'lunch', 'Grilled chicken', 250, 40, 1, 9, 0),
      ($1, '2026-11-23', 'dinner', 'Dal and roti', 380, 16, 54, 9, 8)`, [me]);
    await db.exec(`insert into day_logs (user_id, date, water_ml, steps, badminton) values ($1, '2026-11-24', 2000, 9000, true)`, [me]);
    await db.exec(`insert into storage.objects (bucket_id, name) values ('meal-photos', $1)`, [`${me}/meal-1.jpg`]);
  });
  await as(other, async (db) => {
    await db.exec(`insert into meal_entries (user_id, date, slot, name, kcal, protein_g) values ($1, '2026-11-24', 'dinner', 'SECRET PIZZA', 900, 30)`, [other]);
    await db.exec(`insert into storage.objects (bucket_id, name) values ('meal-photos', $1)`, [`${other}/theirs.jpg`]);
  });
});

afterAll(async () => {
  await sudo.exec(`delete from storage.objects where name like $1 or name like $2`, [`${me}/%`, `${other}/%`]);
  await deleteUsers([me, other]);
  await admin.end();
});

const userText = (req: GenerateRequest) => req.turns.flatMap((t) => t.parts).map((p) => ('text' in p ? p.text : '[image]')).join(' ');

describe('estimate-meal', () => {
  it('estimates from text and returns validated numbers', async () => {
    const ai = fakeProvider(fakeResponder);
    const r = await estimateMeal({ text: 'poha with peanuts' }, { db: pgUserDb(me), ai, now: NOW });
    expect(r.status).toBe(200);
    expect(r.body.estimate).toMatchObject({ name: 'Poha with peanuts', kcal: 325, protein_g: 7.5, confidence: 'medium', junk: false });
    expect(ai.calls[0]!.system).toBe(ESTIMATE_SYSTEM);
    expect(ai.calls[0]!.json).toBe(true);
  });
  it('sends the user\'s own photo to the model', async () => {
    const ai = fakeProvider(fakeResponder);
    const r = await estimateMeal({ text: '2 plates', photo_path: `${me}/meal-1.jpg` }, { db: pgUserDb(me), ai, now: NOW });
    expect(r.status).toBe(200);
    const parts = ai.calls[0]!.turns[0]!.parts;
    expect(parts).toContainEqual({ image: { mimeType: 'image/jpeg', base64: TINY_JPEG } });
    expect(userText(ai.calls[0]!)).toContain('overrides the photo');
  });
  it('refuses someone else\'s photo, by path and by storage policy', async () => {
    const ai = fakeProvider(fakeResponder);
    expect((await estimateMeal({ photo_path: `${other}/theirs.jpg` }, { db: pgUserDb(me), ai, now: NOW })).status).toBe(403);
    expect((await estimateMeal({ photo_path: `${me}/../${other}/theirs.jpg` }, { db: pgUserDb(me), ai, now: NOW })).status).toBe(403);
    // Even if the path check were bypassed, Storage's policy hides the object:
    expect(await pgUserDb(me).downloadPhoto(`${other}/theirs.jpg`)).toBeNull();
    expect(ai.calls).toHaveLength(0);
  });
  it('reports a photo that has not uploaded yet as retryable', async () => {
    const r = await estimateMeal({ photo_path: `${me}/not-yet.jpg` }, { db: pgUserDb(me), ai: fakeProvider(fakeResponder), now: NOW });
    expect(r).toMatchObject({ status: 404, body: { error: 'photo_not_found', retryable: true } });
  });
  it('returns no_food and adds nothing', async () => {
    const r = await estimateMeal({ text: 'no food here, just my desk' }, { db: pgUserDb(me), ai: fakeProvider(fakeResponder), now: NOW });
    expect(r).toMatchObject({ status: 422, body: { error: 'no_food', message: 'No food is visible in the photo.' } });
  });
  it('retries once on an invalid answer, then gives up without passing it on', async () => {
    let n = 0;
    const flaky = fakeProvider(() => (++n === 1 ? 'sorry, here is some prose' : fakeResponder({ system: ESTIMATE_SYSTEM, turns: [] })));
    expect((await estimateMeal({ text: 'poha' }, { db: pgUserDb(me), ai: flaky, now: NOW })).status).toBe(200);
    const broken = fakeProvider(() => JSON.stringify({ name: 'x', kcal: 99999, protein_g: 1, carbs_g: 1, fat_g: 1, junk: false, confidence: 'low' }));
    const r = await estimateMeal({ text: 'poha' }, { db: pgUserDb(me), ai: broken, now: NOW });
    expect(r).toMatchObject({ status: 502, body: { error: 'invalid_ai_response', retryable: true } });
    expect(broken.calls).toHaveLength(2);
    expect(JSON.stringify(r.body)).not.toContain('99999,');
  });
  it('maps a provider outage to a retryable 503', async () => {
    const down = fakeProvider(() => { throw new AiUnavailableError('busy', 503); });
    expect(await estimateMeal({ text: 'poha' }, { db: pgUserDb(me), ai: down, now: NOW })).toMatchObject({ status: 503, body: { retryable: true } });
  });
  it('validates input', async () => {
    const deps = { db: pgUserDb(me), ai: fakeProvider(fakeResponder), now: NOW };
    expect((await estimateMeal({}, deps)).status).toBe(400);
    expect((await estimateMeal({ text: 'x'.repeat(1001) }, deps)).status).toBe(400);
    expect((await estimateMeal('nonsense', deps)).status).toBe(400);
  });
});

describe('coach-chat', () => {
  it('answers from the user\'s own data only, and stores the exchange', async () => {
    const ai = fakeProvider(() => 'You are about 1,600 kcal under your burn so far today. Eat a proper dinner.');
    const db = pgUserDb(me);
    const r = await coachChat({ message: 'Am I in a deficit today?' }, { db, ai, now: NOW });
    expect(r.status).toBe(200);
    const system = ai.calls[0]!.system;
    expect(system).toContain('TODAY: 2026-11-24 (Asia/Kolkata)');
    expect(system).toContain('2026-11-24 (today, still in progress): eaten ~520 kcal est., protein 45 g');
    expect(system).toContain('badminton yes');
    expect(system).toContain('2026-11-23 (only 1 of 3 main meals logged)');
    expect(system).not.toContain('SECRET PIZZA');
    expect(system).not.toContain('Someone Else');
    // the data queries rely on row-level security alone (no user filter), and still saw only my rows
    expect(db.queries.some((sql) => sql.includes('from meal_entries where date between'))).toBe(true);

    const messages = r.body.messages as { role: string; content: string; meta: Record<string, unknown>; user_id: string }[];
    expect(messages.map((m) => m.role)).toEqual(['user', 'assistant']);
    expect(messages[1]!.meta).toMatchObject({ model: 'fake:test', guardrails: [], data_through: '2026-11-24' });
    expect(messages.every((m) => m.user_id === me)).toBe(true);
    // the other user cannot read them
    expect(await as(other, (d) => d.query(`select 1 from coach_messages where user_id = $1`, [me]))).toHaveLength(0);
  });
  it('sends earlier turns as conversation history, oldest first', async () => {
    const ai = fakeProvider(() => 'Two eggs at breakfast.');
    await coachChat({ message: 'What should I add?' }, { db: pgUserDb(me), ai, now: new Date(NOW.getTime() + 60_000) });
    const roles = ai.calls[0]!.turns.map((t) => t.role);
    expect(roles).toEqual(['user', 'assistant', 'user']);
    expect(userText(ai.calls[0]!)).toMatch(/Am I in a deficit today\?.*What should I add\?/);
  });
  it('enforces the 1,400 kcal floor in code even when the model ignores the prompt', async () => {
    const ai = fakeProvider(() => 'To speed things up, eat 1,100 kcal a day.');
    const r = await coachChat({ message: 'How do I lose faster?' }, { db: pgUserDb(me), ai, now: new Date(NOW.getTime() + 120_000) });
    const reply = (r.body.messages as { content: string; meta: { guardrails: string[] } }[])[1]!;
    expect(reply.content).toContain('never recommends eating under 1,400 kcal a day. Your target is 2,050 kcal.');
    expect(reply.meta.guardrails).toEqual(['low_kcal']);
  });
  it('limits questions per day', async () => {
    await as(me, (d) => d.exec(`insert into coach_messages (user_id, role, content, created_at) select $1, 'user', 'q', $2::timestamptz from generate_series(1, $3)`, [me, NOW.toISOString(), DAILY_MESSAGE_LIMIT]));
    const r = await coachChat({ message: 'One more?' }, { db: pgUserDb(me), ai: fakeProvider(fakeResponder), now: new Date(NOW.getTime() + 180_000) });
    expect(r.status).toBe(429);
    await sudo.exec(`delete from coach_messages where user_id = $1 and content = 'q'`, [me]);
  });
  it('asks a user who has not onboarded to finish setup', async () => {
    const fresh = await createUser('fresh');
    const r = await coachChat({ message: 'hi' }, { db: pgUserDb(fresh), ai: fakeProvider(fakeResponder), now: NOW });
    expect(r).toMatchObject({ status: 409, body: { error: 'not_onboarded' } });
    await deleteUsers([fresh]);
  });
});

describe('generate-report', () => {
  it('writes a daily report from computed numbers and stores it', async () => {
    const ai = fakeProvider(fakeResponder);
    const r = await generateReport({ kind: 'daily' }, { db: pgUserDb(me), ai, now: NOW });
    expect(r.status).toBe(200);
    expect(r.body.cached).toBe(false);
    const report = r.body.report as { kind: string; period_start: string; content: { data: { day: Record<string, unknown> }; narrative: { headline: string } }; body: string; model: string };
    expect(report).toMatchObject({ kind: 'daily', period_start: '2026-11-24', model: 'fake:test' });
    expect(report.content.data.day).toMatchObject({ kcal: 520, protein_g: 45, water_ml: 2000, steps: 9000, badminton: true });
    expect(report.body).toContain('A steady day with room for more protein.');
    expect(ai.calls[0]!.system).toContain('Eaten (estimate): 520 kcal (target 2050)');
    expect(ai.calls[0]!.system).not.toContain('SECRET PIZZA');
  });
  it('returns the stored report instead of regenerating, unless forced', async () => {
    const ai = fakeProvider(fakeResponder);
    const again = await generateReport({ kind: 'daily', date: '2026-11-24' }, { db: pgUserDb(me), ai, now: NOW });
    expect(again.body.cached).toBe(true);
    expect(ai.calls).toHaveLength(0);
    const forced = await generateReport({ kind: 'daily', force: true }, { db: pgUserDb(me), ai, now: NOW });
    expect(forced.body.cached).toBe(false);
    expect(ai.calls).toHaveLength(1);
    expect(Number((await sudo.query<{ n: string }>(`select count(*) as n from ai_reports where user_id = $1`, [me]))[0]!.n)).toBe(1);
  });
  it('treats a past day as past, not in progress', async () => {
    const ai = fakeProvider(fakeResponder);
    const r = await generateReport({ kind: 'daily', date: '2026-11-23' }, { db: pgUserDb(me), ai, now: NOW });
    expect(ai.calls[0]!.system).toContain('Only 1 of 3 meals logged, so this may be off.');
    expect((r.body.report as { content: { data: { day: { verdict: string } } } }).content.data.day.verdict).toBe('Deficit');
  });
  it('writes a weekly report over the 7 days ending on the date', async () => {
    const ai = fakeProvider(fakeResponder);
    const r = await generateReport({ kind: 'weekly', date: '2026-11-24' }, { db: pgUserDb(me), ai, now: NOW });
    const report = r.body.report as { period_start: string; period_end: string; content: { data: { week: Record<string, unknown> } } };
    expect(report).toMatchObject({ period_start: '2026-11-18', period_end: '2026-11-24' });
    expect(report.content.data.week).toMatchObject({ daysWithMeals: 2, avg_kcal: 450, workouts: 0, badmintonDays: 1, weighIns: 1, weight_avg: 72.4, weight_avg_previous: 73 });
    expect(ai.calls[0]!.system).toContain('Meals logged on 2 of 7 days');
  });
  it('rejects bad input and future dates', async () => {
    const deps = { db: pgUserDb(me), ai: fakeProvider(fakeResponder), now: NOW };
    expect((await generateReport({ kind: 'monthly' }, deps)).status).toBe(400);
    expect((await generateReport({ kind: 'daily', date: '2026-11-25' }, deps)).status).toBe(400);
    expect((await generateReport({ kind: 'daily', date: '25/11/2026' }, deps)).status).toBe(400);
    expect((await generateReport({ kind: 'daily', date: '2026-01-01' }, deps)).status).toBe(400);
  });
  it('a report written for one user is invisible to another', async () => {
    expect(await as(other, (d) => d.query(`select 1 from ai_reports where user_id = $1`, [me]))).toHaveLength(0);
    const theirs = await generateReport({ kind: 'daily' }, { db: pgUserDb(other), ai: fakeProvider(fakeResponder), now: NOW });
    expect((theirs.body.report as { content: { data: { day: { kcal: number } } } }).content.data.day.kcal).toBe(900);
  });
});
