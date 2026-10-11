import type { ApiResponse } from '@orbit/shared';
import { getAccessToken, handleUnauthorized } from './auth';
import { getLocale, translate } from './i18n';

export const API_URL = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? 'http://localhost:4000/api';

export class ApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
    readonly retryable = false,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

type Body = Record<string, unknown> | unknown[] | FormData | undefined;

/** Upper bound for any request: long enough for CV analysis and agent answers, short enough that nothing spins forever. */
const REQUEST_TIMEOUT_MS = 90_000;

async function request<T>(method: string, path: string, body?: Body, signal?: AbortSignal): Promise<T> {
  const token = await getAccessToken();
  // The locale lets Orbit Agent and server-generated guidance answer in the user's language.
  const headers: Record<string, string> = { Accept: 'application/json', 'X-Orbit-Locale': getLocale() };
  if (token) headers.Authorization = `Bearer ${token}`;
  const isForm = typeof FormData !== 'undefined' && body instanceof FormData;
  if (body !== undefined && !isForm) headers['Content-Type'] = 'application/json';

  // One controller carries both the caller's cancellation (e.g. TanStack Query) and the timeout.
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, REQUEST_TIMEOUT_MS);
  const onAbort = () => controller.abort();
  if (signal?.aborted) controller.abort();
  else signal?.addEventListener('abort', onAbort, { once: true });

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : isForm ? (body as FormData) : JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (error) {
    if (timedOut) throw new ApiError('TIMEOUT', translate('error.timeout'), 0, true);
    if ((error as Error).name === 'AbortError') throw error;
    throw new ApiError('NETWORK_ERROR', translate('error.network'), 0, true);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }

  let payload: ApiResponse<T> | null = null;
  try {
    payload = (await res.json()) as ApiResponse<T>;
  } catch {
    payload = null;
  }

  // Only a 401 for the *current* session means it expired; a late response from a previous
  // session (e.g. right after switching accounts) must not sign the new one out.
  if (res.status === 401 && token && token === (await getAccessToken())) {
    handleUnauthorized();
  }
  if (!res.ok || !payload || payload.success === false) {
    const err = payload && payload.success === false ? payload.error : null;
    throw new ApiError(
      err?.code ?? 'REQUEST_FAILED',
      err?.message ?? translate('error.generic'),
      res.status,
      err?.retryable ?? res.status >= 500,
      err?.details,
    );
  }
  return payload.data;
}

export const api = {
  get: <T>(path: string, signal?: AbortSignal) => request<T>('GET', path, undefined, signal),
  post: <T>(path: string, body: Body = {}) => request<T>('POST', path, body),
  patch: <T>(path: string, body: Body = {}) => request<T>('PATCH', path, body),
  del: <T>(path: string) => request<T>('DELETE', path),
  upload: <T>(path: string, file: File, field = 'file') => {
    const form = new FormData();
    form.append(field, file);
    return request<T>('POST', path, form);
  },
  /** Authenticated binary download (files are private). */
  async blob(path: string): Promise<Blob> {
    const token = await getAccessToken();
    const res = await fetch(`${API_URL}${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
    if (!res.ok) throw new ApiError('DOWNLOAD_FAILED', translate('error.download'), res.status);
    return res.blob();
  },
};

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return translate('error.genericShort');
}
