import type { Session } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AppState, Platform } from 'react-native';
import { supabase } from './supabase';

export type AuthStatus = 'unconfigured' | 'loading' | 'signedOut' | 'signedIn';
type Result = { error: string | null; needsEmailConfirmation?: boolean };

interface AuthValue {
  status: AuthStatus;
  userId: string | null;
  email: string | null;
  signIn(email: string, password: string): Promise<Result>;
  signUp(email: string, password: string): Promise<Result>;
  signOut(): Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

function friendly(message: string): string {
  if (/network|fetch/i.test(message)) return 'No connection. Check your signal and try again.';
  if (/invalid login credentials/i.test(message)) return 'Email or password is incorrect.';
  if (/already registered/i.test(message)) return 'That email already has an account. Sign in instead.';
  if (/email not confirmed/i.test(message)) return 'Confirm your email first: open the link we sent you.';
  return message;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(supabase === null);

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    // Reads the stored session from the device; works with no signal.
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setReady(true);
    }).catch(() => active && setReady(true));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));

    // Refresh tokens only while the app is in the foreground.
    const appState = Platform.OS === 'web' ? null : AppState.addEventListener('change', (state) => {
      if (state === 'active') void supabase?.auth.startAutoRefresh();
      else void supabase?.auth.stopAutoRefresh();
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
      appState?.remove();
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string): Promise<Result> => {
    if (!supabase) return { error: 'The app is not connected to a backend yet.' };
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      return { error: error ? friendly(error.message) : null };
    } catch (e) {
      return { error: friendly(e instanceof Error ? e.message : String(e)) };
    }
  }, []);

  const signUp = useCallback(async (email: string, password: string): Promise<Result> => {
    if (!supabase) return { error: 'The app is not connected to a backend yet.' };
    try {
      const { data, error } = await supabase.auth.signUp({ email: email.trim(), password });
      if (error) return { error: friendly(error.message) };
      return { error: null, needsEmailConfirmation: data.session === null };
    } catch (e) {
      return { error: friendly(e instanceof Error ? e.message : String(e)) };
    }
  }, []);

  const signOut = useCallback(async () => {
    // "local" clears this device even when offline.
    await supabase?.auth.signOut({ scope: 'local' }).catch(() => undefined);
    setSession(null);
  }, []);

  const value = useMemo<AuthValue>(() => ({
    status: supabase === null ? 'unconfigured' : !ready ? 'loading' : session ? 'signedIn' : 'signedOut',
    userId: session?.user.id ?? null,
    email: session?.user.email ?? null,
    signIn, signUp, signOut,
  }), [ready, session, signIn, signUp, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const v = useContext(AuthContext);
  if (!v) throw new Error('useAuth must be used inside AuthProvider');
  return v;
}
