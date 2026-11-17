// Deno only. Turns a handler into an Edge Function: CORS, auth, JSON, errors.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { providerFromEnv } from '../ai/provider.ts';
import type { Handler } from '../handlers/common.ts';
import { supabaseDb } from './supabaseDb.ts';

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type',
  'access-control-allow-methods': 'POST, OPTIONS',
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'content-type': 'application/json' } });

export function serve(handler: Handler) {
  Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
    if (req.method !== 'POST') return json(405, { error: 'method_not_allowed', message: 'Use POST.' });

    const auth = req.headers.get('authorization') ?? '';
    if (!/^bearer\s+\S+/i.test(auth)) return json(401, { error: 'unauthorized', message: 'Sign in first.' });
    const url = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('SUPABASE_PUBLISHABLE_KEY');
    if (!url || !anonKey) return json(500, { error: 'misconfigured', message: 'Supabase environment is missing.' });

    // A client acting as the caller: every query runs under their row-level security.
    const client = createClient(url, anonKey, {
      global: { headers: { Authorization: auth } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: userData, error: userError } = await client.auth.getUser(auth.replace(/^bearer\s+/i, ''));
    if (userError || !userData.user) return json(401, { error: 'unauthorized', message: 'Your session has expired. Sign in again.' });

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return json(400, { error: 'bad_request', message: 'Body must be JSON.' });
    }

    try {
      const ai = providerFromEnv((k) => Deno.env.get(k), fetch);
      const result = await handler(body, { db: supabaseDb(client, userData.user.id), ai, now: new Date() });
      return json(result.status, result.body);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.error(message);
      const misconfigured = /not set|Unknown AI_PROVIDER/.test(message);
      return json(500, { error: misconfigured ? 'misconfigured' : 'internal', message: misconfigured ? message : 'Something went wrong.', retryable: !misconfigured });
    }
  });
}
