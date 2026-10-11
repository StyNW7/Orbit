/**
 * Auth adapter.
 *  - Supabase Auth when VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY are set (JWT verified by NestJS)
 *  - Orbit local auth otherwise (NestJS-issued JWT)
 * The rest of the app only uses this module.
 */
import { createClient, type AuthError, type Session, type SupabaseClient } from '@supabase/supabase-js';
import type { AuthResult, SessionUser } from '@orbit/shared';
import { useSessionStore } from '@/stores/session';
import { getLocale, translate, type MessageKey } from '@/lib/i18n';

// Only the project origin is valid (a URL copied with `/rest/v1/` breaks every auth call).
const SUPABASE_URL = toOrigin(import.meta.env.VITE_SUPABASE_URL as string | undefined);
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
const API_URL = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? 'http://localhost:4000/api';

function toOrigin(value: string | undefined): string | undefined {
  if (!value?.trim()) return undefined;
  try {
    return new URL(value.trim()).origin;
  } catch {
    return value.trim();
  }
}

export const authMode: 'supabase' | 'local' = SUPABASE_URL && SUPABASE_ANON_KEY ? 'supabase' : 'local';

let supabase: SupabaseClient | null = null;
if (authMode === 'supabase') {
  supabase = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, { auth: { persistSession: true, autoRefreshToken: true } });
  supabase.auth.onAuthStateChange((_event, session) => {
    if (session) {
      applySupabaseSession(session);
    } else {
      useSessionStore.getState().clear();
    }
  });
}

/** One mapping from a Supabase session to Orbit's session store (sign-in, refresh and restore). */
function applySupabaseSession(session: Session) {
  const meta = session.user.user_metadata ?? {};
  useSessionStore.getState().setSession(session.access_token, {
    id: session.user.id,
    email: session.user.email ?? '',
    name: (meta.name as string) || (meta.full_name as string) || session.user.email || '',
    avatarUrl: (meta.avatar_url as string) ?? null,
  });
}

/** An auth failure with a stable code, so the UI can react to the cause (not the wording). */
export class AuthFailure extends Error {
  constructor(
    readonly code: 'INVALID_CREDENTIALS' | 'EMAIL_IN_USE' | 'EMAIL_NOT_CONFIRMED' | 'WEAK_PASSWORD' | 'RATE_LIMITED' | 'NETWORK' | 'UNKNOWN',
    message: string,
  ) {
    super(message);
    this.name = 'AuthFailure';
  }
}

const AUTH_MESSAGE: Record<AuthFailure['code'], MessageKey | null> = {
  INVALID_CREDENTIALS: 'error.invalidCredentials',
  EMAIL_IN_USE: 'error.emailInUse',
  EMAIL_NOT_CONFIRMED: 'error.confirmEmail',
  WEAK_PASSWORD: 'auth.err.passwordMin',
  RATE_LIMITED: 'error.rateLimited',
  NETWORK: 'error.network',
  UNKNOWN: null,
};

function authFailure(code: AuthFailure['code'], fallback: string): AuthFailure {
  const key = AUTH_MESSAGE[code];
  return new AuthFailure(code, key ? translate(key) : fallback);
}

/** Supabase answers in English; map its error codes to Orbit's bilingual messages. */
function fromSupabase(error: AuthError): AuthFailure {
  const code = error.code ?? '';
  if (code === 'invalid_credentials' || /invalid login credentials/i.test(error.message)) return authFailure('INVALID_CREDENTIALS', error.message);
  if (code === 'user_already_exists' || code === 'email_exists') return authFailure('EMAIL_IN_USE', error.message);
  if (code === 'email_not_confirmed') return authFailure('EMAIL_NOT_CONFIRMED', error.message);
  if (code === 'weak_password') return authFailure('WEAK_PASSWORD', error.message);
  if (code.startsWith('over_') || error.status === 429) return authFailure('RATE_LIMITED', error.message);
  if (error.name === 'AuthRetryableFetchError' || error.status === 0) return authFailure('NETWORK', error.message);
  return authFailure('UNKNOWN', error.message || translate('error.authFailed'));
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
    res = await fetch(`${API_URL}/auth/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Orbit-Locale': getLocale() },
      body: JSON.stringify(body),
    });
  } catch {
    throw new AuthFailure('NETWORK', translate('error.apiUnreachable'));
  }
  const payload = await res.json().catch(() => null);
  if (!res.ok || !payload?.success) {
    const code = payload?.error?.code as string | undefined;
    const fallback = payload?.error?.message ?? translate('error.authFailed');
    if (code === 'INVALID_CREDENTIALS' || code === 'EMAIL_IN_USE') throw authFailure(code, fallback);
    if (res.status === 429) throw authFailure('RATE_LIMITED', fallback);
    throw new AuthFailure('UNKNOWN', fallback);
  }
  return payload.data as AuthResult;
}

export async function signIn(email: string, password: string): Promise<SessionUser> {
  if (supabase) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw fromSupabase(error);
    if (!data.session) throw new AuthFailure('UNKNOWN', translate('error.signInFailed'));
    applySupabaseSession(data.session);
    return useSessionStore.getState().user!;
  }
  const result = await localAuth('signin', { email, password });
  useSessionStore.getState().setSession(result.accessToken, result.user);
  return result.user;
}

export async function signUp(name: string, email: string, password: string): Promise<SessionUser> {
  if (supabase) {
    const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { name } } });
    if (error) throw fromSupabase(error);
    // Supabase hides an existing address behind a user with no identities (when email confirmation is on).
    if (data.user && data.user.identities?.length === 0) throw authFailure('EMAIL_IN_USE', translate('error.emailInUse'));
    if (!data.session) throw authFailure('EMAIL_NOT_CONFIRMED', translate('error.confirmEmail'));
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

/**
 * Restore a Supabase session on page load (local sessions are persisted by the store).
 * Bounded so a stalled token refresh on a bad network can never keep the app from rendering;
 * `onAuthStateChange` still applies the session if it arrives later.
 */
export async function restoreSession(timeoutMs = 4000): Promise<void> {
  if (!supabase) return;
  const result = await Promise.race([
    supabase.auth.getSession().catch(() => null),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs)),
  ]);
  if (result?.data.session) applySupabaseSession(result.data.session);
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
