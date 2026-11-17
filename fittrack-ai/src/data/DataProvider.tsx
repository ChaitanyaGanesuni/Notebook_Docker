import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as Network from 'expo-network';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { useAuth } from '../auth/AuthProvider';
import { supabase } from '../auth/supabase';
import { createLocalStore } from './local/createLocalStore';
import type { LocalStore } from './local/store';
import { saveRows, type RowInput } from './repo';
import { callFunction, uploadMealPhoto } from '../ai/functions';
import { processEstimates } from '../ai/estimateQueue';
import { photoBytes } from '../ai/photos';
import { useEstimateNotices } from '../ai/notices';
import { SyncEngine, useSyncStatus } from './sync/engine';
import { supabaseRemote } from './sync/supabaseRemote';
import type { ProfileRow, ProgrammeRow, TableName, TargetsRow, WeightLogRow } from './tables';

interface DataValue {
  store: LocalStore | null;
  storeError: string | null;
  engine: SyncEngine | null;
  userId: string | null;
}

const DataContext = createContext<DataValue>({ store: null, storeError: null, engine: null, userId: null });

const RETRY_MS = 30_000;

export function DataProvider({ children }: { children: ReactNode }) {
  const { userId } = useAuth();
  const queryClient = useQueryClient();
  const [store, setStore] = useState<LocalStore | null>(null);
  const [storeError, setStoreError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    createLocalStore()
      .then((s) => active && setStore(s))
      .catch((e: unknown) => active && setStoreError(e instanceof Error ? e.message : String(e)));
    return () => { active = false; };
  }, []);

  const engine = useMemo(() => {
    if (!store || !userId || !supabase) return null;
    const refresh = () => void queryClient.invalidateQueries({ queryKey: ['local'] });
    const estimates = async () => {
      const run = await processEstimates({
        store, userId,
        save: (rows) => saveRows(store, rows),
        upload: async (path, uri) => {
          const bytes = await photoBytes(uri);
          return bytes ? uploadMealPhoto(path, bytes) : { ok: false, retryable: false, message: 'The photo is no longer on this phone.' };
        },
        estimate: (body) => callFunction('estimate-meal', body),
      });
      for (const message of run.removed) useEstimateNotices.getState().push(`${message} Nothing was added.`);
      return run.applied + run.failed + run.removed.length > 0;
    };
    return new SyncEngine(store, supabaseRemote(supabase), userId, refresh, estimates);
  }, [store, userId, queryClient]);

  useEffect(() => {
    if (!engine) return;
    void engine.start();
    // Sync again when the app returns to the foreground, when the connection comes back,
    // and periodically while anything is still waiting to be sent.
    const appState = AppState.addEventListener('change', (s) => { if (s === 'active') void engine.sync({ pull: true }); });
    const network = Network.addNetworkStateListener((s) => { if (s.isConnected) void engine.sync({ pull: true }); });
    const timer = setInterval(() => {
      const s = useSyncStatus.getState();
      if (s.pending > 0 || s.initialPull === 'failed') void engine.sync();
    }, RETRY_MS);
    return () => {
      appState.remove();
      network.remove();
      clearInterval(timer);
    };
  }, [engine]);

  const value = useMemo(() => ({ store, storeError, engine, userId }), [store, storeError, engine, userId]);
  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData(): DataValue {
  return useContext(DataContext);
}

/** Saves rows on the device first (works offline), refreshes the UI, then starts a sync in the background. */
export function useSaveRows(): (inputs: RowInput[]) => Promise<void> {
  const { store, engine } = useData();
  const queryClient = useQueryClient();
  return useCallback(async (inputs: RowInput[]) => {
    if (!store) throw new Error('Local storage is not ready yet.');
    await saveRows(store, inputs);
    await queryClient.invalidateQueries({ queryKey: ['local'] });
    await engine?.refreshCounts();
    void engine?.sync();
  }, [store, engine, queryClient]);
}

function useLocalRow<T>(table: TableName, id: string | null) {
  const { store } = useData();
  return useQuery({
    queryKey: ['local', table, id],
    enabled: !!store && !!id,
    queryFn: async () => ((await store!.getRow(table, id!))?.data as T | undefined) ?? null,
  });
}

export const useProfile = () => useLocalRow<ProfileRow>('profiles', useData().userId);
export const useTargets = () => useLocalRow<TargetsRow>('targets', useData().userId);

export function useActiveProgramme() {
  const { store, userId } = useData();
  return useQuery({
    queryKey: ['local', 'programmes', userId, 'active'],
    enabled: !!store && !!userId,
    queryFn: async () => {
      const rows = await store!.listRows('programmes', userId!);
      return (rows.map((r) => r.data as ProgrammeRow).filter((p) => p.is_active).pop()) ?? null;
    },
  });
}

export function useWeightLogs() {
  const { store, userId } = useData();
  return useQuery({
    queryKey: ['local', 'weight_logs', userId],
    enabled: !!store && !!userId,
    queryFn: async () => (await store!.listRows('weight_logs', userId!)).map((r) => r.data as WeightLogRow),
  });
}
