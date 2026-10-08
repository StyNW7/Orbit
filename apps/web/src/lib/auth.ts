/**
 * Auth adapter.
 *  - Supabase Auth when VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY are set (JWT verified by NestJS)
 *  - Orbit local auth otherwise (NestJS-issued JWT)
 * The rest of the app only uses this module.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { AuthResult, SessionUser } from '@orbit/shared';
import { useSessionStore } from '@/stores/session';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
const API_URL = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? 'http://localhost:4000/api';

export const authMode: 'supabase' | 'local' = SUPABASE_URL && SUPABASE_ANON_KEY ? 'supabase' : 'local';

let supabase: SupabaseClient | null = null;
if (authMode === 'supabase') {
  supabase = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, { auth: { persistSession: true, autoRefreshToken: true } });
  supabase.auth.onAuthStateChange((_event, session) => {
    if (session) {
      useSessionStore.getState().setSession(session.access_token, {
        id: session.user.id,
        email: session.user.email ?? '',
        name: (session.user.user_metadata?.name as string) ?? session.user.email ?? '',
        avatarUrl: (session.user.user_metadata?.avatar_url as string) ?? null,
      });
    } else {
      useSessionStore.getState().clear();
    }
  });
}

export const DEMO_CREDENTIALS = { email: 'demo@orbit.app', password: 'OrbitDemo2026!' };

export async function getAccessToken(): Promise<string | null> {
  if (supabase) {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  }
  return useSessionStore.getState().token;
}

async function localAuth(path: 'signin' | 'signup', body: Record<string, string>): Promise<AuthResult> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}/auth/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  } catch {
    throw new Error('Orbit cannot reach the server. Is the API running?');
  }
  const payload = await res.json().catch(() => null);
  if (!res.ok || !payload?.success) throw new Error(payload?.error?.message ?? 'Authentication failed.');
  return payload.data as AuthResult;
}

export async function signIn(email: string, password: string): Promise<SessionUser> {
  if (supabase) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.session) throw new Error(error?.message ?? 'Sign in failed.');
    const user: SessionUser = { id: data.user.id, email: data.user.email ?? email, name: (data.user.user_metadata?.name as string) ?? email, avatarUrl: null };
    useSessionStore.getState().setSession(data.session.access_token, user);
    return user;
  }
  const result = await localAuth('signin', { email, password });
  useSessionStore.getState().setSession(result.accessToken, result.user);
  return result.user;
}

export async function signUp(name: string, email: string, password: string): Promise<SessionUser> {
  if (supabase) {
    const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { name } } });
    if (error) throw new Error(error.message);
    if (!data.session) throw new Error('Check your inbox to confirm your email, then sign in.');
    const user: SessionUser = { id: data.user!.id, email, name, avatarUrl: null };
    useSessionStore.getState().setSession(data.session.access_token, user);
    return user;
  }
  const result = await localAuth('signup', { name, email, password });
  useSessionStore.getState().setSession(result.accessToken, result.user);
  return result.user;
}

export async function signOut() {
  if (supabase) await supabase.auth.signOut();
  useSessionStore.getState().clear();
}

/** Restore a Supabase session on page load (local sessions are persisted by the store). */
export async function restoreSession(): Promise<void> {
  if (!supabase) return;
  const { data } = await supabase.auth.getSession();
  if (data.session) {
    useSessionStore.getState().setSession(data.session.access_token, {
      id: data.session.user.id,
      email: data.session.user.email ?? '',
      name: (data.session.user.user_metadata?.name as string) ?? '',
      avatarUrl: null,
    });
  }
}

let redirecting = false;
export function handleUnauthorized() {
  if (redirecting) return;
  redirecting = true;
  void signOut().finally(() => {
    redirecting = false;
    if (!window.location.pathname.startsWith('/signin')) window.location.assign('/signin?expired=1');
  });
}
