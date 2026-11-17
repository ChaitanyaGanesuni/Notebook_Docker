/**
 * The data the Edge Functions read and write, always as the signed-in user, so
 * row-level security applies to every query. Implemented with supabase-js in the
 * deployed functions and with plain SQL (same policies) in the tests.
 */
import type {
  CoachMessageRow, DayLogLite, MealLite, MeasurementLite, ProfileLite, ProgrammeLite, ReportRow, TargetsLite, WeightLite,
} from './types.ts';

export interface UserDb {
  readonly userId: string;
  getProfile(): Promise<ProfileLite | null>;
  getTargets(): Promise<TargetsLite | null>;
  getActiveProgramme(): Promise<ProgrammeLite | null>;
  listMeals(from: string, to: string): Promise<MealLite[]>;
  listDayLogs(from: string, to: string): Promise<DayLogLite[]>;
  listWeights(to: string): Promise<WeightLite[]>;
  listMeasurements(from: string, to: string): Promise<MeasurementLite[]>;
  /** Dates of the user's own finished workout sessions (guided or couples). */
  listWorkoutDates(from: string, to: string): Promise<string[]>;
  recentCoachMessages(limit: number): Promise<CoachMessageRow[]>;
  countUserMessagesSince(isoInstant: string): Promise<number>;
  /** created_at is set by the caller so the question always sorts before its answer. */
  insertCoachMessages(rows: { role: 'user' | 'assistant'; content: string; meta: Record<string, unknown>; created_at: string }[]): Promise<CoachMessageRow[]>;
  getReport(kind: 'daily' | 'weekly', periodStart: string): Promise<ReportRow | null>;
  upsertReport(row: Omit<ReportRow, 'id' | 'user_id' | 'created_at' | 'updated_at'>): Promise<ReportRow>;
  /** Reads a photo from the private meal-photos bucket. Null when it does not exist or is not the user's. */
  downloadPhoto(path: string): Promise<{ mimeType: string; base64: string } | null>;
}
