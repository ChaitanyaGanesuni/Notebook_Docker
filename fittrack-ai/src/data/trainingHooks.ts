import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { EXERCISES, EXERCISE_BY_SLUG, TRACKS, type TrackSlug } from '../domain/training/exercises';
import type { MoveChoice } from '../domain/training/plan';
import { buildSessionRows, type FinishedSession } from '../domain/training/sessionRows';
import { useData } from './DataProvider';
import { naturalId } from './ids';
import { saveRows } from './repo';
import type { DayLogRow, ExerciseSetRow, SessionParticipantRow, TrackExerciseRow, WorkoutSessionRow, WorkoutTrackRow } from './tables';

const SLUG_BY_ID: Record<string, string> = Object.fromEntries(EXERCISES.map((e) => [e.id, e.slug]));

/** The user's own version of a track (swaps, levels, targets), or null to use the defaults. */
export function useTrackChoices(track: TrackSlug) {
  const { store, userId } = useData();
  return useQuery({
    queryKey: ['local', 'track-choices', userId, track],
    enabled: !!store && !!userId,
    queryFn: async (): Promise<MoveChoice[] | null> => {
      const trackId = naturalId(userId!, 'workout_tracks', track);
      const own = (await store!.getRow('workout_tracks', trackId))?.data as WorkoutTrackRow | undefined;
      if (!own) return null;
      const rows = (await store!.listRows('track_exercises', userId!)).map((r) => r.data as TrackExerciseRow)
        .filter((r) => r.track_id === trackId).sort((a, b) => a.position - b.position);
      if (rows.length !== TRACKS[track].moves.length) return null;
      return rows.map((r) => ({ slug: SLUG_BY_ID[r.exercise_id] ?? TRACKS[track].moves[r.position]!, level: r.level, target: r.target == null ? null : Number(r.target) }));
    },
  });
}

export function useSaveTrackChoices() {
  const { store, userId, engine } = useData();
  const queryClient = useQueryClient();
  return useCallback(async (track: TrackSlug, choices: MoveChoice[]) => {
    if (!store || !userId) return;
    const def = TRACKS[track];
    const trackId = naturalId(userId, 'workout_tracks', track);
    await saveRows(store, [
      { table: 'workout_tracks', data: { id: trackId, user_id: userId, slug: track, name: def.name, description: def.description, sets_per_move: def.setsPerMove, rest_seconds: def.restSeconds, is_couples: def.couples } },
      ...choices.map((c, position) => ({
        table: 'track_exercises' as const,
        data: {
          id: naturalId(userId, 'track_exercises', `${track}:${position}`), user_id: userId, track_id: trackId,
          exercise_id: EXERCISE_BY_SLUG[c.slug]!.id, position, sets: def.setsPerMove, target: c.target, level: c.level, target_note: '',
        },
      })),
    ]);
    await queryClient.invalidateQueries({ queryKey: ['local'] });
    void engine?.sync();
  }, [store, userId, engine, queryClient]);
}

export interface SessionSummary {
  session: WorkoutSessionRow;
  me: SessionParticipantRow | null;
  guest: SessionParticipantRow | null;
  sets: ExerciseSetRow[];
}

/** The user's finished sessions, newest first, with their own sets. */
export function useSessions() {
  const { store, userId } = useData();
  return useQuery({
    queryKey: ['local', 'sessions', userId],
    enabled: !!store && !!userId,
    queryFn: async (): Promise<SessionSummary[]> => {
      const [sessions, parts, sets] = await Promise.all([
        store!.listRows('workout_sessions', userId!), store!.listRows('session_participants', userId!), store!.listRows('exercise_sets', userId!),
      ]);
      const ps = parts.map((r) => r.data as SessionParticipantRow);
      const ss = sets.map((r) => r.data as ExerciseSetRow);
      return sessions.map((r) => r.data as WorkoutSessionRow).filter((s) => s.finished_at)
        .sort((a, b) => (b.finished_at ?? '').localeCompare(a.finished_at ?? ''))
        .map((session) => {
          const me = ps.find((p) => p.session_id === session.id && !p.is_guest) ?? null;
          return { session, me, guest: ps.find((p) => p.session_id === session.id && p.is_guest) ?? null, sets: ss.filter((x) => x.session_id === session.id && x.participant_id === me?.id) };
        });
    },
  });
}

/**
 * Saves a finished workout: the session (to both accounts for a linked partner) and
 * the day's workout tick. Everything goes through the offline queue.
 */
export function useSaveWorkout() {
  const { store, userId, engine } = useData();
  const queryClient = useQueryClient();
  return useCallback(async (f: Omit<FinishedSession, 'me' | 'newId'> & { difficulty: number | null; newId: () => string }) => {
    if (!store || !userId) throw new Error('Not ready');
    const rows = buildSessionRows({ ...f, me: { userId, difficulty: f.difficulty } });
    const logId = naturalId(userId, 'day_logs', f.date);
    const log = (await store.getRow('day_logs', logId))?.data as DayLogRow | undefined;
    rows.push({
      table: 'day_logs',
      data: { water_ml: 0, steps: null, steps_source: null, badminton: false, in_bed_on_time: false, chai_sugar: null, note: '', ...log, id: logId, user_id: userId, date: f.date, workout_done: true },
    });
    await saveRows(store, rows, new Date(), userId);
    await queryClient.invalidateQueries({ queryKey: ['local'] });
    await engine?.refreshCounts();
    void engine?.sync();
  }, [store, userId, engine, queryClient]);
}
