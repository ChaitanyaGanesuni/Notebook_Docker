/** Test-only UserDb: the same reads and writes as the deployed functions, in SQL, run as the user. */
import type { UserDb } from '../functions/_shared/db';
import type { CoachMessageRow, ReportRow } from '../functions/_shared/types';
import { as } from './helpers';

const num = <T extends Record<string, unknown>>(r: T): T => {
  const o: Record<string, unknown> = { ...r };
  for (const [k, v] of Object.entries(o)) if (typeof v === 'string' && /^-?\d+(\.\d+)?$/.test(v)) o[k] = Number(v);
  return o as T;
};
const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : String(v));
const rowOut = <T,>(r: Record<string, unknown>): T => ({ ...r, created_at: iso(r.created_at), updated_at: iso(r.updated_at) }) as T;

/** 1x1 JPEG, standing in for the photo bytes Storage would return. */
export const TINY_JPEG = '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==';

export function pgUserDb(userId: string): UserDb & { queries: string[] } {
  const queries: string[] = [];
  const q = <T extends Record<string, unknown>>(sql: string, params: unknown[] = []) => {
    queries.push(sql);
    return as(userId, (db) => db.query<T>(sql, params));
  };
  return {
    userId, queries,
    async getProfile() {
      const r = await q(`select display_name, sex, age, height_cm::float8 as height_cm, timezone, goal, diet, weak_spots, daily_activity, training from profiles where user_id = $1`, [userId]);
      return (r[0] as never) ?? null;
    },
    async getTargets() {
      const r = await q(`select kcal_target, protein_min_g, protein_target_g, protein_max_g, fat_min_g, fat_max_g, fibre_min_g, fibre_max_g, water_ml, steps, workouts_per_week, bedtime_target::text, add_exercise_calories from targets where user_id = $1`, [userId]);
      return (r[0] as never) ?? null;
    },
    async getActiveProgramme() {
      const r = await q(`select name, start_date::text, weeks, checkpoint_date::text, expectation from programmes where user_id = $1 and is_active`, [userId]);
      return (r[0] as never) ?? null;
    },
    // Deliberately no user_id filter here: row-level security alone must keep other users' rows out.
    async listMeals(from, to) {
      const r = await q(`select date::text, slot, source, name, junk, edited, confidence, kcal, protein_g, carbs_g, fat_g, fibre_g from meal_entries where date between $1 and $2 and deleted_at is null order by logged_at`, [from, to]);
      return r.map(num) as never;
    },
    async listDayLogs(from, to) {
      return (await q(`select date::text, water_ml, steps, badminton, workout_done, in_bed_on_time, chai_sugar from day_logs where date between $1 and $2`, [from, to])) as never;
    },
    async listWeights(to) {
      return (await q(`select date::text, weight_kg from weight_logs where date <= $1 and deleted_at is null order by date`, [to])).map(num) as never;
    },
    async listMeasurements(from, to) {
      return (await q(`select date::text, waist_cm from body_measurements where date between $1 and $2 and deleted_at is null`, [from, to])).map(num) as never;
    },
    async recentCoachMessages(limit) {
      return (await q(`select * from coach_messages order by created_at desc limit $1`, [limit])).map((r) => rowOut<CoachMessageRow>(r));
    },
    async countUserMessagesSince(since) {
      return Number((await q<{ n: string }>(`select count(*) as n from coach_messages where role = 'user' and created_at >= $1`, [since]))[0]!.n);
    },
    async insertCoachMessages(rows) {
      const out: CoachMessageRow[] = [];
      for (const r of rows) {
        const [row] = await q(`insert into coach_messages (user_id, role, content, meta, created_at) values ($1, $2, $3, $4, $5) returning *`, [userId, r.role, r.content, JSON.stringify(r.meta), r.created_at]);
        out.push(rowOut<CoachMessageRow>(row!));
      }
      return out;
    },
    async getReport(kind, start) {
      const r = await q(`select *, period_start::text, period_end::text from ai_reports where kind = $1 and period_start = $2`, [kind, start]);
      return r[0] ? rowOut<ReportRow>(r[0]) : null;
    },
    async upsertReport(row) {
      const [r] = await q(`insert into ai_reports (user_id, kind, period_start, period_end, content, body, model) values ($1, $2, $3, $4, $5, $6, $7)
        on conflict (user_id, kind, period_start) do update set content = excluded.content, body = excluded.body, model = excluded.model, updated_at = now()
        returning *, period_start::text, period_end::text`, [userId, row.kind, row.period_start, row.period_end, JSON.stringify(row.content), row.body, row.model]);
      return rowOut<ReportRow>(r!);
    },
    async downloadPhoto(path) {
      // Storage's own policies decide visibility, exactly as for supabase.storage.download().
      const r = await q(`select 1 from storage.objects where bucket_id = 'meal-photos' and name = $1`, [path]);
      return r.length ? { mimeType: 'image/jpeg', base64: TINY_JPEG } : null;
    },
  };
}
