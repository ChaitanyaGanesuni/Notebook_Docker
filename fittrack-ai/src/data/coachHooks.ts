import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import { callFunction, type FnResult } from '../ai/functions';
import { addDays } from '../domain/dates';
import type { UserHistory } from '../../supabase/functions/_shared/types.ts';
import { useActiveProgramme, useData, useProfile, useTargets, useWeightLogs } from './DataProvider';
import { useRangeData } from './dayHooks';
import { toLocalRow } from './sync/pull';
import type { CoachMessageRow, ReportRow } from './tables';

export function useCoachMessages() {
  const { store, userId } = useData();
  return useQuery({
    queryKey: ['local', 'coach_messages', userId],
    enabled: !!store && !!userId,
    queryFn: async () => (await store!.listRows('coach_messages', userId!)).map((r) => r.data as unknown as CoachMessageRow)
      .sort((a, b) => a.created_at.localeCompare(b.created_at)),
  });
}

export function useStoredReports() {
  const { store, userId } = useData();
  return useQuery({
    queryKey: ['local', 'ai_reports', userId],
    enabled: !!store && !!userId,
    queryFn: async () => (await store!.listRows('ai_reports', userId!)).map((r) => r.data as unknown as ReportRow),
  });
}

/** Asks the coach. The question and answer are stored on the server and copied to this phone. */
export function useAskCoach() {
  const { store } = useData();
  const queryClient = useQueryClient();
  return useCallback(async (message: string): Promise<FnResult<{ messages: CoachMessageRow[] }>> => {
    const res = await callFunction<{ messages: CoachMessageRow[] }>('coach-chat', { message });
    if (res.ok && store) {
      await store.applyRemote(res.data.messages.map((m) => toLocalRow('coach_messages', m as unknown as Record<string, unknown>)));
      await queryClient.invalidateQueries({ queryKey: ['local', 'coach_messages'] });
    }
    return res;
  }, [store, queryClient]);
}

export function useWriteReport() {
  const { store } = useData();
  const queryClient = useQueryClient();
  return useCallback(async (kind: 'daily' | 'weekly', date: string, force: boolean): Promise<FnResult<{ report: ReportRow }>> => {
    const res = await callFunction<{ report: ReportRow }>('generate-report', { kind, date, force });
    if (res.ok && store) {
      await store.applyRemote([toLocalRow('ai_reports', res.data.report as unknown as Record<string, unknown>)]);
      await queryClient.invalidateQueries({ queryKey: ['local', 'ai_reports'] });
    }
    return res;
  }, [store, queryClient]);
}

/** The same history the Edge Functions build, from this phone's data, so report numbers work offline. */
export function useLocalHistory(today: string, days = 21): { history: UserHistory | null; loading: boolean } {
  const profile = useProfile();
  const targets = useTargets();
  const programme = useActiveProgramme();
  const weights = useWeightLogs();
  const range = useRangeData(addDays(today, -(days - 1)), today);
  const history = useMemo<UserHistory | null>(() => {
    if (!profile.data || !targets.data || !range.data) return null;
    return {
      today,
      profile: profile.data,
      targets: targets.data,
      programme: programme.data ?? null,
      meals: range.data.meals.filter((m) => m.estimate_status !== 'pending' || m.kcal != null),
      logs: range.data.logs,
      weights: (weights.data ?? []).filter((w) => w.date <= today).map((w) => ({ date: w.date, weight_kg: Number(w.weight_kg) })),
      measurements: range.data.measurements.map((m) => ({ date: m.date, waist_cm: m.waist_cm == null ? null : Number(m.waist_cm) })),
    };
  }, [today, profile.data, targets.data, programme.data, range.data, weights.data]);
  return { history, loading: profile.isPending || targets.isPending || range.isPending || weights.isPending };
}
