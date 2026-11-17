import { FunctionsFetchError, FunctionsHttpError, FunctionsRelayError } from '@supabase/supabase-js';
import { supabase } from '../auth/supabase';

export type FnResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number | null; error: string; message: string; retryable: boolean };

/** Calls an Edge Function as the signed-in user and classifies failures as retry-later or give-up. */
export async function callFunction<T>(name: 'estimate-meal' | 'coach-chat' | 'generate-report', body: Record<string, unknown>): Promise<FnResult<T>> {
  if (!supabase) return { ok: false, status: null, error: 'unconfigured', message: 'The app is not connected to a backend.', retryable: false };
  try {
    const { data, error } = await supabase.functions.invoke<T>(name, { body });
    if (!error) return { ok: true, data: data as T };
    if (error instanceof FunctionsHttpError) {
      const res = error.context as Response;
      const payload = (await res.json().catch(() => ({}))) as { error?: string; message?: string; retryable?: boolean };
      const status = res.status;
      return {
        ok: false, status,
        error: payload.error ?? `http_${status}`,
        message: payload.message ?? `The server answered ${status}.`,
        retryable: payload.retryable ?? (status === 401 || status === 408 || status === 429 || status >= 500),
      };
    }
    if (error instanceof FunctionsFetchError || error instanceof FunctionsRelayError) {
      return { ok: false, status: null, error: 'network', message: 'No connection to the server.', retryable: true };
    }
    return { ok: false, status: null, error: 'unknown', message: error instanceof Error ? error.message : String(error), retryable: true };
  } catch (e) {
    return { ok: false, status: null, error: 'network', message: e instanceof Error ? e.message : String(e), retryable: true };
  }
}

export type UploadResult = { ok: true } | { ok: false; retryable: boolean; message: string };

/** Uploads a photo to the private meal-photos bucket under the user's own folder. */
export async function uploadMealPhoto(path: string, bytes: Uint8Array): Promise<UploadResult> {
  if (!supabase) return { ok: false, retryable: false, message: 'The app is not connected to a backend.' };
  try {
    const { error } = await supabase.storage.from('meal-photos').upload(path, bytes, { contentType: 'image/jpeg', upsert: true });
    if (!error) return { ok: true };
    const status = Number((error as { statusCode?: string | number }).statusCode ?? 0);
    return { ok: false, retryable: !status || status === 408 || status === 429 || status >= 500, message: error.message };
  } catch (e) {
    return { ok: false, retryable: true, message: e instanceof Error ? e.message : String(e) };
  }
}

/** A short-lived link for showing a photo that is not on this phone. Photos are never public. */
export async function signedPhotoUrl(path: string): Promise<string | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.storage.from('meal-photos').createSignedUrl(path, 3600);
  return error ? null : data.signedUrl;
}
