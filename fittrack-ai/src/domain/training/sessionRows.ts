/**
 * The rows a finished workout writes. Solo: one session in the user's account.
 * With a guest: the guest's sets live in the user's account under a guest
 * participant. With a linked partner: the session is written to both accounts,
 * each with their own sets and difficulty rating, joined by couple_group_id.
 */
import type { RowInput } from '../../data/repo';
import { EXERCISE_BY_SLUG, TRACKS, type TrackSlug } from './exercises';
import { bestReps, type SetResult, type Who } from './player';

export const PUSH_UP_SLUGS = ['incline-push-up', 'you-go-i-go-push-ups'];

export type PartnerInfo =
  | null
  | { kind: 'guest'; name: string; difficulty: number | null }
  | { kind: 'linked'; userId: string; name: string; difficulty: number | null };

export interface FinishedSession {
  date: string;
  track: TrackSlug;
  programmeWeek: number | null;
  startedAt: number;
  finishedAt: number;
  results: SetResult[];
  me: { userId: string; difficulty: number | null };
  partner: PartnerInfo;
  newId: () => string;
}

function sets(f: FinishedSession, who: Who, userId: string, sessionId: string, participantId: string): RowInput[] {
  return f.results.filter((r) => r.who === who).map((r) => ({
    table: 'exercise_sets' as const,
    data: {
      id: f.newId(), user_id: userId, session_id: sessionId, participant_id: participantId,
      exercise_id: EXERCISE_BY_SLUG[r.slug]?.id ?? null, exercise_slug: r.slug, set_number: r.set,
      reps: r.reps, hold_seconds: r.holdSeconds, level: r.level, completed: true, deleted_at: null,
    },
  }));
}

export function buildSessionRows(f: FinishedSession): RowInput[] {
  const couples = TRACKS[f.track].couples;
  const linked = f.partner?.kind === 'linked' ? f.partner : null;
  const groupId = linked ? f.newId() : null;
  const durationS = Math.max(0, Math.round((f.finishedAt - f.startedAt) / 1000));
  const session = (id: string, userId: string) => ({
    table: 'workout_sessions' as const,
    data: {
      id, user_id: userId, date: f.date, track_id: TRACKS[f.track].id, track_slug: f.track, is_couples: couples,
      couple_group_id: groupId, programme_week: f.programmeWeek,
      started_at: new Date(f.startedAt).toISOString(), finished_at: new Date(f.finishedAt).toISOString(),
      duration_s: durationS, deleted_at: null,
    },
  });
  const participant = (id: string, userId: string, sessionId: string, who: Who, extra: Record<string, unknown>) => ({
    table: 'session_participants' as const,
    data: { id, user_id: userId, session_id: sessionId, is_guest: false, guest_name: null, best_pushup_set: bestReps(f.results, who, PUSH_UP_SLUGS), ...extra },
  });

  const rows: RowInput[] = [];
  const mySession = f.newId();
  const myPart = f.newId();
  rows.push(session(mySession, f.me.userId));
  rows.push(participant(myPart, f.me.userId, mySession, 'me', { difficulty: f.me.difficulty }));
  rows.push(...sets(f, 'me', f.me.userId, mySession, myPart));

  if (couples && f.partner?.kind === 'guest') {
    const guestPart = f.newId();
    rows.push(participant(guestPart, f.me.userId, mySession, 'partner', { is_guest: true, guest_name: f.partner.name.trim().slice(0, 60) || 'Guest', difficulty: f.partner.difficulty }));
    rows.push(...sets(f, 'partner', f.me.userId, mySession, guestPart));
  }
  if (couples && linked) {
    const theirSession = f.newId();
    const theirPart = f.newId();
    rows.push(session(theirSession, linked.userId));
    rows.push(participant(theirPart, linked.userId, theirSession, 'partner', { difficulty: linked.difficulty }));
    rows.push(...sets(f, 'partner', linked.userId, theirSession, theirPart));
  }
  return rows;
}
