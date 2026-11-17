// Deno only. UserDb backed by supabase-js with the caller's JWT, so row-level security applies.
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { encodeBase64 } from 'jsr:@std/encoding@1/base64';
import type { UserDb } from '../db.ts';
import type { CoachMessageRow, ReportRow } from '../types.ts';

const MEAL_COLS = 'date, slot, source, name, junk, edited, confidence, kcal, protein_g, carbs_g, fat_g, fibre_g';
const PROFILE_COLS = 'display_name, sex, age, height_cm, timezone, goal, diet, weak_spots, daily_activity, training';
const TARGET_COLS = 'kcal_target, protein_min_g, protein_target_g, protein_max_g, fat_min_g, fat_max_g, fibre_min_g, fibre_max_g, water_ml, steps, workouts_per_week, bedtime_target, add_exercise_calories';

function must<T>(r: { data: T; error: { message: string } | null }): T {
  if (r.error) throw new Error(r.error.message);
  return r.data;
}

/** Postgres numeric columns arrive as strings; the shared code expects numbers. */
function numeric<T extends Record<string, unknown>>(row: T): T {
  const out: Record<string, unknown> = { ...row };
  for (const [k, v] of Object.entries(out)) if (typeof v === 'string' && /^-?\d+(\.\d+)?$/.test(v) && k !== 'date') out[k] = Number(v);
  return out as T;
}

export function supabaseDb(client: SupabaseClient, userId: string): UserDb {
  return {
    userId,
    async getProfile() {
      const row = must(await client.from('profiles').select(PROFILE_COLS).eq('user_id', userId).maybeSingle());
      return row ? numeric(row) : null;
    },
    async getTargets() {
      const row = must(await client.from('targets').select(TARGET_COLS).eq('user_id', userId).maybeSingle());
      return row ? numeric(row) : null;
    },
    async getActiveProgramme() {
      return must(await client.from('programmes').select('name, start_date, weeks, checkpoint_date, expectation')
        .eq('user_id', userId).eq('is_active', true).maybeSingle());
    },
    async listMeals(from, to) {
      const rows = must(await client.from('meal_entries').select(MEAL_COLS).eq('user_id', userId)
        .gte('date', from).lte('date', to).is('deleted_at', null).order('logged_at').limit(5000));
      return (rows ?? []).map(numeric);
    },
    async listDayLogs(from, to) {
      return (must(await client.from('day_logs').select('date, water_ml, steps, badminton, workout_done, in_bed_on_time, chai_sugar')
        .eq('user_id', userId).gte('date', from).lte('date', to).limit(1000))) ?? [];
    },
    async listWeights(to) {
      const rows = must(await client.from('weight_logs').select('date, weight_kg').eq('user_id', userId)
        .lte('date', to).is('deleted_at', null).order('date').limit(5000));
      return (rows ?? []).map(numeric);
    },
    async listMeasurements(from, to) {
      const rows = must(await client.from('body_measurements').select('date, waist_cm').eq('user_id', userId)
        .gte('date', from).lte('date', to).is('deleted_at', null).limit(1000));
      return (rows ?? []).map(numeric);
    },
    async listWorkoutDates(from, to) {
      const rows = must(await client.from('workout_sessions').select('date').eq('user_id', userId)
        .gte('date', from).lte('date', to).not('finished_at', 'is', null).is('deleted_at', null).limit(1000)) ?? [];
      return [...new Set(rows.map((r: { date: string }) => r.date))];
    },
    async recentCoachMessages(limit) {
      return (must(await client.from('coach_messages').select('*').eq('user_id', userId)
        .order('created_at', { ascending: false }).limit(limit)) ?? []) as CoachMessageRow[];
    },
    async countUserMessagesSince(iso) {
      const r = await client.from('coach_messages').select('id', { count: 'exact', head: true })
        .eq('user_id', userId).eq('role', 'user').gte('created_at', iso);
      if (r.error) throw new Error(r.error.message);
      return r.count ?? 0;
    },
    async insertCoachMessages(rows) {
      return (must(await client.from('coach_messages').insert(rows.map((r) => ({ ...r, user_id: userId }))).select('*')
        .order('created_at')) ?? []) as CoachMessageRow[];
    },
    async getReport(kind, periodStart) {
      return must(await client.from('ai_reports').select('*').eq('user_id', userId).eq('kind', kind)
        .eq('period_start', periodStart).maybeSingle()) as ReportRow | null;
    },
    async upsertReport(row) {
      return must(await client.from('ai_reports').upsert({ ...row, user_id: userId, updated_at: new Date().toISOString() },
        { onConflict: 'user_id,kind,period_start' }).select('*').single()) as ReportRow;
    },
    async downloadPhoto(path) {
      const { data, error } = await client.storage.from('meal-photos').download(path);
      if (error || !data) return null;
      return { mimeType: data.type || 'image/jpeg', base64: encodeBase64(new Uint8Array(await data.arrayBuffer())) };
    },
  };
}
